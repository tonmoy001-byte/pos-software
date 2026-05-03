import { prisma } from "@/lib/prisma";
import { eventStore, EventStoreData, calculateProfit } from "./eventStore";

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
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod?: string;
  discount?: number;
}

export class SaleService {
  async create(input: SaleCreateInput, storeId: string, userId: string) {
    const { items, customerId, totalAmount, paidAmount, dueAmount, paymentMethod, discount } = input;

    return prisma.$transaction(async (tx) => {
      let totalCost = 0;
      let totalProfit = 0;
      const eventPayloads = [];

      // Fetch products to ensure we have costs if not provided
      const productIds = items.map(i => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } }
      });

      const invoiceId = `INV-${Date.now()}`;

      // 1. Create the Sale record first to get the ID
      const sale = await tx.sale.create({
        data: {
          invoiceId,
          totalAmount,
          paidAmount,
          dueAmount,
          discount: discount || 0,
          costAmount: 0, // Will update after calculating from items
          profit: 0,     // Will update after calculating from items
          status: dueAmount > 0 ? (paidAmount > 0 ? "PARTIAL" : "DUE") : "PAID",
          customerId: customerId || null,
          storeId,
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

      // 2. Create Sale Items and update cost/profit
      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        const itemCost = item.cost ?? Number(product?.cost || 0);
        const itemProfit = (item.price - itemCost) * item.quantity;

        totalCost += itemCost * item.quantity;
        totalProfit += itemProfit;

        const saleItem = await tx.saleItem.create({
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

        if (item.imeis && item.imeis.length > 0) {
          await tx.serializedItem.updateMany({
            where: { imei: { in: item.imeis }, productId: item.productId },
            data: {
              status: "SOLD",
              saleItemId: saleItem.id,
            },
          });
        }
      }

      // 3. Update the Sale record with calculated cost and profit
      await tx.sale.update({
        where: { id: sale.id },
        data: {
          costAmount: totalCost,
          profit: totalProfit,
        }
      });

      // 4. Create a transaction record for the sale
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

      // 5. Update customer due
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

      return sale;
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

      return { success: true };
    });
  }
}