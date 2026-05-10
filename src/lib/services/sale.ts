import { prisma } from "@/lib/prisma";
import { eventStore, EventStoreData } from "./eventStore";
import { generateInvoiceNumber } from "@/lib/server/invoice";

interface SaleItem {
  productId: string;
  quantity: number;
  price: number;
  cost?: number;
  imeis?: string[];
}

interface SaleCreateInput {
  items: SaleItem[];
  customerId?: string;
  customerName?: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod?: string;
  discount?: number;
  saleType?: string;
  deliveryDate?: string | null;
}

export class SaleService {
  async create(input: SaleCreateInput, storeId: string, userId: string) {
    const { items, customerId, totalAmount, paidAmount, dueAmount, paymentMethod, discount, saleType, deliveryDate } = input;

    return prisma.$transaction(async (tx) => {
      // 1. Fetch products and validate stock/existence
      const uniqueProductIds = Array.from(new Set(items.map(i => i.productId)));
      const products = await tx.product.findMany({
        where: { id: { in: uniqueProductIds }, storeId }
      });

      if (products.length !== uniqueProductIds.length) {
        throw new Error("One or more products not found");
      }

      // 2. Validate stock for non-advance orders
      if (saleType !== "ADVANCE_ORDER") {
        for (const item of items) {
          const product = products.find(p => p.id === item.productId);
          if (!product || product.stock < item.quantity) {
            throw new Error(`Insufficient stock for product: ${product?.name || "Unknown"}`);
          }
        }
      }

      // 3. Resolve customer name (snapshot)
      let resolvedCustomerName = input.customerName || "Walking Customer";
      if (customerId) {
        const customer = await tx.customer.findUnique({ where: { id: customerId } });
        if (customer) {
          resolvedCustomerName = customer.name;
        }
      }

      // 4. Generate atomic invoice number
      const invoiceId = await generateInvoiceNumber(storeId, tx);

      let totalCost = 0;
      let totalProfit = 0;
      const eventPayloads = [];

      // 5. Create Sale record
      const sale = await tx.sale.create({
        data: {
          invoiceId,
          saleType: saleType || "REGULAR",
          totalAmount,
          paidAmount,
          dueAmount,
          discount: discount || 0,
          costAmount: 0,
          profit: 0,
          status: dueAmount > 0 ? (paidAmount > 0 ? "PARTIAL" : "DUE") : "PAID",
          customerId: customerId || null,
          customerName: resolvedCustomerName,
          storeId,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          payments: paidAmount > 0
            ? {
                create: {
                  amount: paidAmount,
                  method: paymentMethod || "CASH",
                  storeId,
                },
              }
            : undefined,
        },
      });

      // 6. Create Sale Items, update stock, and calculate financials
      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        const itemCost = item.cost ?? Number(product?.cost || 0);
        const itemProfit = (item.price - itemCost) * item.quantity;

        totalCost += itemCost * item.quantity;
        totalProfit += itemProfit;

        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            cost: itemCost,
            profit: itemProfit,
          },
        });

        eventPayloads.push({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          cost: itemCost,
          profit: itemProfit,
        });

        if (saleType !== "ADVANCE_ORDER") {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } }
          });
        }
      }

      // 7. Update Sale record with final financials
      await tx.sale.update({
        where: { id: sale.id },
        data: {
          costAmount: totalCost,
          profit: totalProfit,
        }
      });

      // 8. Create financial transaction
      if (paidAmount > 0) {
        await tx.transaction.create({
          data: {
            type: "SALE",
            amount: paidAmount,
            costAmount: totalCost,
            profit: totalProfit,
            mode: (paymentMethod as any) || "CASH",
            description: `Sale: ${invoiceId}`,
            customerId: customerId || null,
            referenceId: sale.id,
            referenceType: "SALE",
            userId,
            storeId,
            status: "COMPLETED"
          }
        });
      }

      // 9. Update customer due
      if (customerId && dueAmount > 0) {
        const customer = await tx.customer.findUnique({ where: { id: customerId } });
        if (customer) {
          const newDueAmount = Number(customer.dueAmount || 0) + dueAmount;
          await tx.customer.update({
            where: { id: customerId },
            data: { dueAmount: newDueAmount },
          });

          await eventStore.append({
            aggregateType: "Customer",
            aggregateId: customerId,
            type: "UPDATED",
            payload: { dueAmount: newDueAmount },
            userId,
            storeId,
          } as EventStoreData);
        }
      }

      // 10. Audit event
      await eventStore.append({
        aggregateType: "Sale",
        aggregateId: sale.id,
        type: "SALE_CREATED",
        payload: {
          invoiceId,
          totalAmount,
          paidAmount,
          dueAmount,
          costAmount: totalCost,
          profit: totalProfit,
          status: sale.status,
          items: eventPayloads,
        },
        userId,
        storeId,
      } as EventStoreData);

      return tx.sale.findUnique({
        where: { id: sale.id },
        include: {
          items: { include: { product: true } },
          customer: true,
          payments: true
        }
      });
    });
  }

  async findAll(storeId?: string) {
    return prisma.sale.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true, phone: true } },
        items: { include: { product: true } },
        payments: true
      },
    });
  }

  async findById(id: string) {
    return prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { product: true } },
        payments: { orderBy: { date: "desc" } },
      },
    });
  }

  async getDueSales(storeId?: string) {
    return prisma.sale.findMany({
      where: { storeId, dueAmount: { gt: 0 } },
      include: {
        customer: true,
        items: { include: { product: true } },
        payments: { orderBy: { date: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async collectPayment(saleId: string, amount: number, method: string, userId: string, storeId: string) {
    const sale = await prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) throw new Error("Sale not found");
    if (amount > Number(sale.dueAmount)) throw new Error("Amount exceeds due");

    const newDue = Number(sale.dueAmount) - amount;
    const newPaid = Number(sale.paidAmount) + amount;
    const newStatus = newDue <= 0 ? "PAID" : "PARTIAL";

    return prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          amount,
          method,
          saleId,
          storeId,
        },
      });

      await tx.sale.update({
        where: { id: saleId },
        data: {
          dueAmount: newDue,
          paidAmount: newPaid,
          status: newStatus as any,
        },
      });

      await eventStore.append({
        aggregateType: "Sale",
        aggregateId: saleId,
        type: "PAYMENT_RECEIVED",
        payload: {
          amount,
          method,
          paidAmount: newPaid,
          dueAmount: newDue,
          status: newStatus,
        },
        userId,
        storeId,
      } as EventStoreData);

      if (sale.customerId) {
        const customer = await tx.customer.findUnique({ where: { id: sale.customerId } });
        if (customer) {
          const newCustomerDue = Math.max(0, Number(customer.dueAmount) - amount);
          await tx.customer.update({
            where: { id: sale.customerId },
            data: { dueAmount: newCustomerDue },
          });
        }
      }

      if (method !== "DUE") {
        await tx.transaction.create({
          data: {
            type: "DUE_PAYMENT",
            amount,
            mode: method as any,
            description: `Payment for ${sale.invoiceId}`,
            customerId: sale.customerId,
            referenceId: saleId,
            referenceType: "SALE",
            userId,
            storeId,
          },
        });
      }

      return { success: true };
    });
  }

  async refund(saleId: string, reason: string, userId: string, storeId: string) {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: { include: { product: true } } },
    });
    if (!sale) throw new Error("Sale not found");
    if (sale.status === "CANCELLED") throw new Error("Sale already cancelled");

    return prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id: saleId },
        data: {
          status: "CANCELLED",
          profit: 0,
        },
      });

      await eventStore.append({
        aggregateType: "Sale",
        aggregateId: saleId,
        type: "REFUND_PROCESSED",
        payload: {
          amount: sale.totalAmount,
          reason,
        },
        metadata: { previousState: { status: sale.status, profit: sale.profit } },
        userId,
        storeId,
      } as EventStoreData);

      await tx.transaction.create({
        data: {
          type: "SALE_REFUND",
          amount: Number(sale.totalAmount),
          mode: "CASH",
          description: `Refund for ${sale.invoiceId}: ${reason}`,
          referenceId: saleId,
          referenceType: "SALE",
          userId,
          storeId,
        },
      });

      // Restore stock
      for (const item of sale.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } }
        });
      }

      return { success: true };
    });
  }
}
