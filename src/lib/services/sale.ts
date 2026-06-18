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
  exchangeItems?: Array<{
    productId?: string;
    description: string;
    estimatedValue: number;
    condition?: string;
  }>;
  emiMonths?: number;
  interestRate?: number;
  downPayment?: number;
  monthlyAmount?: number;
}

export class SaleService {
  async create(input: SaleCreateInput, storeId: string, userId: string) {
    const { items, customerId, customerName, totalAmount, paidAmount, dueAmount, paymentMethod, discount, saleType, deliveryDate, dueDate, exchangeItems, emiMonths, interestRate, downPayment, monthlyAmount } = input;

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

      // 2.5. Validate totalAmount matches item sum (accounting for discount and interest)
      const itemSum = items.reduce((sum, item) => sum.plus(new Decimal(item.price).times(item.quantity)), new Decimal(0)).toNumber();
      const discountNum = Number(discount) || 0;
      const interestRateNum = Number(interestRate) || 0;
      const expectedTotal = new Decimal(itemSum).minus(discountNum).times(1 + interestRateNum / 100).toNumber();
      if (Math.abs(expectedTotal - totalAmount) > 1) {
        throw new Error(`Total amount (${totalAmount}) does not match expected total (${Math.round(expectedTotal)}) after discount and interest`);
      }

      // 2.6. Validate paidAmount + dueAmount === totalAmount
      if (Math.abs(new Decimal(paidAmount).plus(dueAmount).minus(totalAmount).toNumber()) > 1) {
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
          emiMonths: emiMonths || null,
          interestRate: interestRate || null,
          downPayment: downPayment || null,
          monthlyAmount: monthlyAmount || null,
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

      // 9.1. Create exchange items if present
      if (exchangeItems && exchangeItems.length > 0) {
        await tx.exchangeItem.createMany({
          data: exchangeItems.map(item => ({
            saleId: sale.id,
            productId: item.productId || null,
            description: item.description,
            estimatedValue: item.estimatedValue,
            condition: item.condition || "good",
          })),
        });
      }

      // 9.5. Generate EMI schedule if EMI sale
      if (saleType === "EMI" && emiMonths && downPayment !== undefined) {
        await this.generateEmiSchedule(tx, sale.id, emiMonths, totalAmount, downPayment, sale.createdAt);
      }

      // Update stock for non-advance orders
      if (saleType !== "ADVANCE_ORDER") {
        const stockMovements = [];
        for (const item of items) {
          const product = products.find(p => p.id === item.productId);
          const currentStock = product ? Number(product.stock) : 0;
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } }
          });
          stockMovements.push({
            productId: item.productId,
            quantityChange: -item.quantity,
            stockBefore: currentStock,
            stockAfter: currentStock - item.quantity,
            reason: "SALE",
            referenceId: sale.id,
            referenceType: "Sale",
            storeId,
          });
        }
        if (stockMovements.length > 0) {
          await tx.stockMovement.createMany({ data: stockMovements });
        }
      }

      // 10. Create financial transaction
      // Normalise paymentMethod to a valid DB enum value (EMI is not a payment mode)
      const validModes = ["CASH", "BANK", "BKASH", "NAGAD", "CARD", "DUE"];
      const txMode = (validModes.includes(paymentMethod || "") ? paymentMethod : "CASH") as
        "CASH" | "BANK" | "BKASH" | "NAGAD" | "CARD" | "DUE";
      if (paidAmount > 0) {
        await tx.transaction.create({
          data: {
            type: "SALE",
            amount: paidAmount,
            costAmount: totalCost,
            profit: totalProfit,
            mode: txMode,
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
          exchangeItems: true,
          customer: true,
          payments: true,
          emiSchedules: true,
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
          items: { select: { id: true, productId: true, quantity: true, price: true, profit: true, product: { select: { name: true, model: true } } } },
          payments: { select: { id: true, amount: true, method: true, date: true, status: true } }
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

      if (sale.saleType !== "ADVANCE_ORDER") {
        const refundRatio = new Decimal(refundAmountNum).dividedBy(totalAmount).toNumber();
        const stockMovements = [];
        for (const item of sale.items) {
          const currentStock = Number((await tx.product.findUnique({ where: { id: item.productId } }))?.stock || 0);
          const stockToRestore = Math.round(item.quantity * refundRatio);
          if (stockToRestore > 0) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: stockToRestore } }
            });
            stockMovements.push({
              productId: item.productId,
              quantityChange: stockToRestore,
              stockBefore: currentStock,
              stockAfter: currentStock + stockToRestore,
              reason: "REFUND",
              referenceId: saleId,
              referenceType: "Sale",
              storeId,
            });
          }
        }
        if (stockMovements.length > 0) {
          await tx.stockMovement.createMany({ data: stockMovements });
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
          where: { customerId: sale.customerId, dueAmount: { gt: 0 } },
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

  private async generateEmiSchedule(tx: any, saleId: string, emiMonths: number, totalAmount: number, downPayment: number, saleDate: Date): Promise<void> {
    const scheduleData: Array<{
      saleId: string;
      installmentNo: number;
      dueDate: Date;
      amount: any;
      status: string;
    }> = [];

    // Installment 1 = down payment, due on sale date
    scheduleData.push({
      saleId,
      installmentNo: 1,
      dueDate: saleDate,
      amount: downPayment,
      status: "PAID",
    });

    // Remaining installments
    const remaining = totalAmount - downPayment;
    const monthlyAmount = remaining / (emiMonths - 1);

    for (let i = 2; i <= emiMonths; i++) {
      const dueDate = new Date(saleDate);
      dueDate.setMonth(dueDate.getMonth() + (i - 1));

      scheduleData.push({
        saleId,
        installmentNo: i,
        dueDate,
        amount: monthlyAmount,
        status: "PENDING",
      });
    }

    await tx.eMISchedule.createMany({ data: scheduleData });
  }

  async payInstallment(saleId: string, installmentNo: number, amount: number, method: string, userId: string, storeId: string): Promise<{ sale: any; installment: any }> {
    return prisma.$transaction(async (tx) => {
      // Find the installment
      const installment = await tx.eMISchedule.findFirst({
        where: { saleId, installmentNo, status: "PENDING" },
      });

      if (!installment) {
        throw new Error(`Installment #${installmentNo} not found or already paid`);
      }

      // Mark installment as paid
      const updatedInstallment = await tx.eMISchedule.update({
        where: { id: installment.id },
        data: {
          status: "PAID",
          paidDate: new Date(),
        },
      });

      // Update sale paid amount
      const sale = await tx.sale.update({
        where: { id: saleId },
        data: {
          paidAmount: { increment: amount },
          dueAmount: { decrement: amount },
        },
      });

      // Check if all installments are paid
      const pendingCount = await tx.eMISchedule.count({
        where: { saleId, status: "PENDING" },
      });

      if (pendingCount === 0) {
        await tx.sale.update({
          where: { id: saleId },
          data: { status: "PAID" },
        });
      }

      // Create payment record
      await tx.payment.create({
        data: {
          saleId,
          amount,
          method,
          storeId,
        },
      });

      // Create transaction record
      await tx.transaction.create({
        data: {
          type: "SALE",
          amount,
          mode: method as "CASH" | "BANK" | "BKASH" | "NAGAD" | "CARD" | "DUE",
          description: `EMI installment #${installmentNo} for ${sale.invoiceId}`,
          referenceId: saleId,
          referenceType: "SALE",
          userId,
          storeId,
          status: "COMPLETED",
        },
      });

      // Audit event
      await eventStore.append({
        aggregateType: "Sale",
        aggregateId: saleId,
        type: "EMI_INSTALLMENT_PAID",
        payload: {
          installmentNo,
          amount,
          method,
          paidAmount: sale.paidAmount,
          dueAmount: sale.dueAmount,
        },
        userId,
        storeId,
      } as EventStoreData, tx);

      return { sale, installment: updatedInstallment };
    });
  }

  async payAllInstallments(saleId: string, method: string, userId: string, storeId: string): Promise<{ sale: any; paidCount: number }> {
    return prisma.$transaction(async (tx) => {
      // Find all pending installments
      const pendingInstallments = await tx.eMISchedule.findMany({
        where: { saleId, status: "PENDING" },
        orderBy: { installmentNo: "asc" },
      });

      if (pendingInstallments.length === 0) {
        throw new Error("No pending installments found");
      }

      const totalRemaining = pendingInstallments.reduce(
        (sum: number, inst: any) => sum + Number(inst.amount),
        0
      );

      // Mark all as paid
      await tx.eMISchedule.updateMany({
        where: { saleId, status: "PENDING" },
        data: {
          status: "PAID",
          paidDate: new Date(),
        },
      });

      // Update sale
      const sale = await tx.sale.update({
        where: { id: saleId },
        data: {
          paidAmount: { increment: totalRemaining },
          dueAmount: 0,
          status: "PAID",
        },
      });

      // Create payment record
      await tx.payment.create({
        data: {
          saleId,
          amount: totalRemaining,
          method,
          storeId,
        },
      });

      // Create transaction record
      await tx.transaction.create({
        data: {
          type: "SALE",
          amount: totalRemaining,
          mode: method as "CASH" | "BANK" | "BKASH" | "NAGAD" | "CARD" | "DUE",
          description: `EMI early payoff for ${sale.invoiceId}`,
          referenceId: saleId,
          referenceType: "SALE",
          userId,
          storeId,
          status: "COMPLETED",
        },
      });

      // Audit event
      await eventStore.append({
        aggregateType: "Sale",
        aggregateId: saleId,
        type: "EMI_EARLY_PAYOFF",
        payload: {
          paidCount: pendingInstallments.length,
          totalAmount: totalRemaining,
          method,
        },
        userId,
        storeId,
      } as EventStoreData, tx);

      return { sale, paidCount: pendingInstallments.length };
    });
  }
}
