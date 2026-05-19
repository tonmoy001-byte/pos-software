import { prisma } from "@/lib/prisma";
import { eventStore, EventStoreData } from "./eventStore";
import { generateInvoiceNumber } from "@/lib/server/invoice";
import { recordStockMovement } from "./stockMovement";
import { postSaleEntry, postRefundEntry, postDueCollectionEntry } from "./posting";
import Decimal from "decimal.js";

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
  dueDate?: string | null;
}

export class SaleService {
  async create(input: SaleCreateInput, storeId: string, userId: string) {
    const { items, customerId, customerName, totalAmount, paidAmount, dueAmount, paymentMethod, discount, saleType, deliveryDate, dueDate } = input;

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

      // 2.5. Validate totalAmount matches item sum
      const calculatedTotal = new Decimal(items.reduce((sum, item) => sum + item.price * item.quantity, 0)).toNumber();
      if (Math.abs(calculatedTotal - totalAmount) > 0.01) {
        throw new Error(`Total amount (${totalAmount}) does not match item sum (${calculatedTotal})`);
      }

      // 2.6. Validate paidAmount + dueAmount === totalAmount
      if (Math.abs((paidAmount + dueAmount) - totalAmount) > 0.01) {
        throw new Error("Paid amount + Due amount must equal Total Amount");
      }

      // 3. Resolve customer name (snapshot)
      let resolvedCustomerName = customerName || "Walking Customer";
      if (customerId) {
        const customer = await tx.customer.findUnique({ where: { id: customerId } });
        if (customer) {
          resolvedCustomerName = customer.name;
        }
      }

      // 5. Calculate cost and profit before creating sale (avoids double-write)
      let totalCost = 0;
      let totalProfit = 0;
      const saleItemsData = items.map((item) => {
        const product = products.find(p => p.id === item.productId);
        const itemCost = item.cost ?? Number(product?.cost || 0);
        const itemProfit = new Decimal(item.price).minus(itemCost).times(item.quantity).toNumber();

        totalCost = new Decimal(totalCost).plus(new Decimal(itemCost).times(item.quantity)).toNumber();
        totalProfit = new Decimal(totalProfit).plus(itemProfit).toNumber();

        return {
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          cost: itemCost,
          profit: itemProfit,
          imeis: item.imeis ? JSON.stringify(item.imeis) : null,
        };
      });

      // 6. Generate atomic invoice number
      const invoiceId = await generateInvoiceNumber(storeId, tx);

      // 7. Calculate due date
      let calculatedDueDate: Date | null = null;
      if (dueDate) {
        calculatedDueDate = new Date(dueDate);
      } else if (deliveryDate) {
        const delivery = new Date(deliveryDate);
        delivery.setDate(delivery.getDate() + 7);
        calculatedDueDate = delivery;
      } else if (dueAmount > 0) {
        const defaultDueDate = new Date();
        defaultDueDate.setDate(defaultDueDate.getDate() + 7);
        calculatedDueDate = defaultDueDate;
      }

      // 8. Create Sale record
      const sale = await tx.sale.create({
        data: {
          invoiceId,
          saleType: saleType || "REGULAR",
          totalAmount,
          paidAmount,
          dueAmount,
          discount: discount || 0,
          costAmount: totalCost,
          profit: totalProfit,
          status: dueAmount > 0 ? (paidAmount > 0 ? "PARTIAL" : "DUE") : "PAID",
          customerId: customerId || null,
          customerName: resolvedCustomerName,
          storeId,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          dueDate: calculatedDueDate,
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

      // 9. Bulk create all sale items
      await tx.saleItem.createMany({
        data: saleItemsData.map(item => ({ saleId: sale.id, ...item })),
      });

      // Update stock for non-advance orders
      if (saleType !== "ADVANCE_ORDER") {
        await Promise.all(items.map(async (item) => {
          const product = products.find(p => p.id === item.productId);
          const currentStock = product ? Number(product.stock) : 0;
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } }
          });
          await recordStockMovement(item.productId, -item.quantity, "SALE", storeId, {
            referenceId: sale.id,
            referenceType: "Sale",
            tx,
            stockBefore: currentStock,
          });
        }));
      }

      // 10. Create financial transaction
      if (paidAmount > 0) {
        await tx.transaction.create({
          data: {
            type: "SALE",
            amount: paidAmount,
            costAmount: totalCost,
            profit: totalProfit,
            mode: (paymentMethod as "CASH" | "BANK" | "BKASH" | "NAGAD" | "CARD" | "DUE") || "CASH",
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

      // 10. Update customer due
      if (customerId && dueAmount > 0) {
        await tx.customer.update({
          where: { id: customerId },
          data: { dueAmount: { increment: dueAmount } },
        });

        await eventStore.append({
          aggregateType: "Customer",
          aggregateId: customerId,
          type: "UPDATED",
          payload: { dueAmountIncrement: dueAmount },
          userId,
          storeId,
        } as EventStoreData, tx);
      }

      // 11. Audit event
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
          items: saleItemsData.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            cost: item.cost,
            profit: item.profit,
          })),
        },
        userId,
        storeId,
      } as EventStoreData, tx);

      // 12. Post journal entry
      if (saleType !== "ADVANCE_ORDER") {
        await postSaleEntry(
          sale.id,
          totalAmount,
          totalCost,
          paidAmount,
          paymentMethod || "CASH",
          storeId,
          tx
        );
      }

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

  async findAll(storeId?: string, options?: { page?: number; limit?: number; status?: string }) {
    const { page = 1, limit = 20, status } = options || {};
    const skip = (page - 1) * limit;

    const where: any = { storeId };
    if (status) where.status = status;

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
        include: {
          customer: { select: { name: true, phone: true } },
          items: { include: { product: true } },
          payments: true
        },
      }),
      prisma.sale.count({ where }),
    ]);

    return { sales, total, page, limit, totalPages: Math.ceil(total / limit) };
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

  async getDueSales(storeId: string, options?: { page?: number; limit?: number; search?: string; status?: string }) {
    const { page = 1, limit = 20, search, status } = options || {};
    const skip = (page - 1) * limit;

    const where: any = {
      storeId,
      dueAmount: { gt: 0 }
    };

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { invoiceId: { contains: search } },
        { customerName: { contains: search } },
        { customer: { phone: { contains: search } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          customer: true,
          items: { include: { product: true } },
          payments: { orderBy: { date: "desc" } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.sale.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit,
    };
  }

  async getDueSalesStats(storeId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    const [totalOutstanding, expectedToday, lastMonthDues, thisMonthDues, lastMonthCollected] = await Promise.all([
      prisma.sale.aggregate({
        where: { storeId, dueAmount: { gt: 0 } },
        _sum: { dueAmount: true },
      }),
      prisma.sale.aggregate({
        where: {
          storeId,
          dueAmount: { gt: 0 },
          dueDate: { lte: today },
          status: { not: "PAID" },
        },
        _sum: { dueAmount: true },
      }),
      prisma.sale.aggregate({
        where: {
          storeId,
          createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
          dueAmount: { gt: 0 },
        },
        _sum: { totalAmount: true },
      }),
      prisma.sale.aggregate({
        where: {
          storeId,
          createdAt: { gte: monthStart },
          dueAmount: { gt: 0 },
        },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      prisma.payment.aggregate({
        where: {
          storeId,
          date: { gte: lastMonthStart, lte: lastMonthEnd },
          sale: { status: { in: ["PARTIAL", "DUE"] } },
        },
        _sum: { amount: true },
      }),
    ]);

    const lastMonthTotal = Number(lastMonthDues._sum.totalAmount || 0);
    const lastMonthCollectionRate = lastMonthTotal > 0
      ? Number(lastMonthCollected._sum.amount || 0) / lastMonthTotal
      : 0;

    return {
      totalOutstanding: Number(totalOutstanding._sum.dueAmount || 0),
      expectedToday: Number(expectedToday._sum.dueAmount || 0),
      lastMonthCollectionRate: Math.round(lastMonthCollectionRate * 100),
      thisMonthBilled: Number(thisMonthDues._sum.totalAmount || 0),
      thisMonthCollected: Number(thisMonthDues._sum.paidAmount || 0),
    };
  }

  async collectPayment(saleId: string, amount: number, method: string, userId: string, storeId: string) {
    // ── Paranoid guard: amount must be a real, finite positive number ─────────
    if (!isFinite(Number(amount)) || Number(amount) <= 0) {
      throw new Error(`Invalid payment amount: ${amount}`);
    }
    const amountNum = Number(amount);

    return prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ where: { id: saleId, storeId } });
      if (!sale) throw new Error("Sale not found");

      if (amountNum > Number(sale.dueAmount)) throw new Error("Amount exceeds due");

      const newDue = Number(sale.dueAmount) - amountNum;
      const newPaid = Number(sale.paidAmount) + amountNum;
      const newStatus = newDue <= 0 ? "PAID" : "PARTIAL";
      await tx.payment.create({
        data: {
          amount: amountNum,
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
            status: newStatus as "PAID" | "PARTIAL" | "DUE" | "PENDING" | "COMPLETED" | "CANCELLED",
        },
      });

      await eventStore.append({
        aggregateType: "Sale",
        aggregateId: saleId,
        type: "PAYMENT_RECEIVED",
        payload: {
          amount: amountNum,
          method,
          paidAmount: newPaid,
          dueAmount: newDue,
          status: newStatus,
        },
        userId,
        storeId,
      } as EventStoreData, tx);

      if (sale.customerId) {
        const customer = await tx.customer.findUnique({ where: { id: sale.customerId } });
        if (customer) {
          const newCustomerDue = Math.max(0, Number(customer.dueAmount) - amountNum);
          await tx.customer.update({
            where: { id: sale.customerId },
            data: { dueAmount: newCustomerDue },
          });
        }
      }

      let paymentRecord: any = null;
      if (method !== "DUE") {
        paymentRecord = await tx.transaction.create({
          data: {
            type: "DUE_PAYMENT",
            amount: amountNum,
            mode: method as "CASH" | "BANK" | "BKASH" | "NAGAD" | "CARD" | "DUE",
            description: `Payment for ${sale.invoiceId}`,
            customerId: sale.customerId,
            referenceId: saleId,
            referenceType: "SALE",
            userId,
            storeId,
          },
        });
      }

      if (paymentRecord) {
        await postDueCollectionEntry(paymentRecord.id, amountNum, method, storeId, tx);
      }

      return { success: true };
    });
  }

  async refund(saleId: string, reason: string, userId: string, storeId: string, refundAmount?: number) {
    return prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: saleId, storeId },
        include: { items: { include: { product: true } }, payments: true },
      });
      if (!sale) throw new Error("Sale not found");
      if (sale.status === "CANCELLED") throw new Error("Sale already cancelled");

      const totalAmount = Number(sale.totalAmount);
      const paidAmount = Number(sale.paidAmount);
      const dueAmount = Number(sale.dueAmount);

      const refundAmountNum = refundAmount ?? totalAmount;

      if (!isFinite(refundAmountNum) || isNaN(refundAmountNum) || refundAmountNum <= 0) {
        throw new Error("Invalid refund amount");
      }

      if (refundAmountNum > totalAmount) {
        throw new Error(`Refund amount (${refundAmountNum}) exceeds sale total (${totalAmount})`);
      }

      const isFullRefund = refundAmountNum >= totalAmount;

      if (isFullRefund && sale.saleType !== "ADVANCE_ORDER") {
        for (const item of sale.items) {
          const currentStock = Number((await tx.product.findUnique({ where: { id: item.productId } }))?.stock || 0);
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } }
          });
          await recordStockMovement(item.productId, item.quantity, "REFUND", storeId, {
            referenceId: saleId,
            referenceType: "Sale",
            tx,
            stockBefore: currentStock,
          });
        }
      }

      // Only mark payments as refunded for full refunds
      if (isFullRefund && sale.payments.length > 0) {
        await tx.payment.updateMany({
          where: { saleId, status: "ACTIVE" },
          data: { status: "REFUNDED" },
        });
      }

      // Determine original payment mode from first payment
      const originalMode = sale.payments.length > 0
        ? (sale.payments[0].method as "CASH" | "BANK" | "BKASH" | "NAGAD" | "CARD" | "DUE")
        : "CASH";

      const refunded = isFullRefund ? totalAmount : refundAmountNum;

      if (!isFullRefund) {
        if (refunded > paidAmount) {
          throw new Error(`Refund amount (${refunded}) exceeds paid amount (${paidAmount})`);
        }
        if (refunded > (totalAmount - dueAmount)) {
          throw new Error("Refund amount exceeds paid portion of sale");
        }
      }

      await tx.sale.update({
        where: { id: saleId },
        data: isFullRefund ? {
          status: "CANCELLED",
          dueAmount: 0,
          paidAmount: 0,
          profit: 0,
          refundedAmount: { increment: refunded },
        } : {
          refundedAmount: { increment: refunded },
          paidAmount: { decrement: refunded },
          dueAmount: dueAmount,
        },
      });

      // Adjust customer due if applicable
      if (sale.customerId) {
        const remainingDues = await tx.sale.aggregate({
          where: { customerId: sale.customerId, dueAmount: { gt: 0 }, id: { not: saleId } },
          _sum: { dueAmount: true },
        });
        await tx.customer.update({
          where: { id: sale.customerId },
          data: { dueAmount: Number(remainingDues._sum.dueAmount || 0) },
        });
      }

      await eventStore.append({
        aggregateType: "Sale",
        aggregateId: saleId,
        type: "REFUND_PROCESSED",
        payload: {
          amount: refunded,
          totalAmount: sale.totalAmount,
          reason,
          isFullRefund,
        },
        metadata: { previousState: { status: sale.status, profit: sale.profit } },
        userId,
        storeId,
      } as EventStoreData, tx);

      await postRefundEntry(
        saleId,
        refundAmountNum,
        Number(sale.costAmount),
        originalMode,
        isFullRefund,
        storeId,
        tx
      );

      await tx.transaction.create({
        data: {
          type: "SALE_REFUND",
          amount: refunded,
          mode: originalMode,
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
