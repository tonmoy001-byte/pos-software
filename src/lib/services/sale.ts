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
}

export class SaleService {
  async create(input: SaleCreateInput, storeId: string, userId: string) {
    const { items, customerId, totalAmount, paidAmount, dueAmount, paymentMethod } = input;

    return prisma.$transaction(async (tx) => {
      let totalCost = 0;
      let totalProfit = 0;
      const saleItemsData = [];
      const eventPayloads = [];

      for (const item of items) {
        if (item.cost) {
          totalCost += item.cost * item.quantity;
          totalProfit += calculateProfit(item.price, item.cost) * item.quantity;
        }

        const saleItem = await tx.saleItem.create({
          data: {
            saleId: "", 
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            cost: item.cost ?? 0,
            profit: item.cost ? calculateProfit(item.price, item.cost) * item.quantity : 0,
          },
        });

        saleItemsData.push(saleItem);

        eventPayloads.push({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          cost: item.cost,
          profit: saleItem.profit,
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

      const invoiceId = `INV-${Date.now()}`;
      const sale = await tx.sale.create({
        data: {
          invoiceId,
          totalAmount,
          paidAmount,
          dueAmount,
          costAmount: totalCost,
          profit: totalProfit,
          status: dueAmount > 0 ? (paidAmount > 0 ? "PARTIAL" : "DUE") : "PAID",
          customerId: customerId || null,
          storeId,
          items: {
            create: items.map((item, idx) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              cost: item.cost ?? 0,
              profit: item.cost ? calculateProfit(item.price, item.cost) * item.quantity : 0,
            })),
          },
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
        include: { items: true, payments: true },
      });

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

      if (customerId) {
        const customer = await tx.customer.findUnique({ where: { id: customerId } });
        if (customer && dueAmount > 0) {
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

      const [updatedSale] = await Promise.all([
        tx.sale.update({
          where: { id: saleId },
          data: {
            dueAmount: newDue,
            paidAmount: newPaid,
            status: newStatus as any,
          },
        }),
      ]);

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
      const [updatedSale] = await Promise.all([
        tx.sale.update({
          where: { id: saleId },
          data: {
            status: "CANCELLED",
            profit: 0,
          },
        }),
      ]);

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

  async getDailyTotals(storeId?: string) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const result = await prisma.sale.aggregate({
      where: { storeId, createdAt: { gte: start, lte: end } },
      _sum: { totalAmount: true, paidAmount: true, dueAmount: true, profit: true },
    });

    return {
      total: Number(result._sum.totalAmount || 0),
      paid: Number(result._sum.paidAmount || 0),
      due: Number(result._sum.dueAmount || 0),
      profit: Number(result._sum.profit || 0),
    };
  }
}