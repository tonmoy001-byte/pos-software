import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, subDays } from "date-fns";
import type { TransactionCreateInput, TransactionFilter, DailySummary, CapitalSummary } from "@/types";
import { eventStore, EventStoreData, calculateProfit } from "./eventStore";
import { getTenantFilter } from "./tenant";

export class TransactionService {
  async create(data: TransactionCreateInput, userId: string, storeId: string) {
    return prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          type: data.type,
          amount: data.amount,
          costAmount: data.costAmount,
          profit: data.costAmount ? calculateProfit(data.amount, data.costAmount) : 0,
          mode: data.mode,
          description: data.description,
          barcode: data.barcode,
          productId: data.productId,
          customerId: data.customerId,
          supplierId: data.supplierId,
          loanId: data.loanId,
          referenceId: data.referenceId,
          referenceType: data.referenceType,
          userId,
          storeId,
        },
      });

      await eventStore.append({
        aggregateType: "Transaction",
        aggregateId: transaction.id,
        type: "CREATED",
        payload: {
          type: data.type,
          amount: data.amount,
          costAmount: data.costAmount,
          profit: transaction.profit,
          mode: data.mode,
        },
        userId,
        storeId,
      } as EventStoreData);

      if (data.type === "PURCHASE" && data.supplierId) {
        const supplier = await tx.supplier.findFirst({ where: { id: data.supplierId, storeId } });
        if (!supplier) throw new Error("Supplier not found or unauthorized");
        const currentDue = Number(supplier.dueAmount) || 0;
        const isPaid = data.mode !== "DUE";

        await tx.supplier.update({
          where: { id: data.supplierId },
          data: {
            dueAmount: isPaid
              ? currentDue   // Cash purchase: supplier due stays the same (new purchase is separate)
              : currentDue + data.amount  // Due purchase: increases supplier due
          },
        });

        await eventStore.append({
          aggregateType: "Supplier",
          aggregateId: data.supplierId,
          type: "UPDATED",
          payload: { dueAmount: isPaid ? currentDue - data.amount : currentDue + data.amount },
          metadata: { previousState: { dueAmount: currentDue } },
          userId,
          storeId,
        } as EventStoreData);
      }

      if ((data.type === "HAWLAT_GIVEN" || data.type === "HAWLAT_RECEIVED") && data.loanId) {
        const loan = await tx.loan.findFirst({ where: { id: data.loanId, storeId } });
        if (loan) {
          const newPaid = Number(loan.paid) + data.amount;
          const newRemaining = Math.max(0, Number(loan.remaining) - data.amount);

          await tx.loan.update({
            where: { id: data.loanId },
            data: {
              paid: newPaid,
              remaining: newRemaining,
            },
          });

          await eventStore.append({
            aggregateType: "Loan",
            aggregateId: data.loanId,
            type: "UPDATED",
            payload: { paid: newPaid, remaining: newRemaining },
            userId,
            storeId,
          } as EventStoreData);
        }
      }

      return transaction;
    });
  }

  async findAll(filter: TransactionFilter, storeId?: string, isAdmin?: boolean) {
    const storeFilter = getTenantFilter(storeId, !isAdmin);
    const where: any = { ...storeFilter };

    if (filter.days) {
      const daysAgo = subDays(new Date(), filter.days);
      where.createdAt = { gte: daysAgo };
    } else if (filter.startDate && filter.endDate) {
      where.createdAt = {
        gte: startOfDay(new Date(filter.startDate)),
        lte: endOfDay(new Date(filter.endDate)),
      };
    } else {
      const today = new Date();
      where.createdAt = { gte: startOfDay(today), lte: endOfDay(today) };
    }

    if (filter.type) where.type = filter.type;

    return prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        supplier: { select: { name: true } },
      },
    });
  }

  async getFinancialSummary(storeId: string, startDate?: Date, endDate?: Date, isAdmin?: boolean): Promise<DailySummary> {
    const today = new Date();
    const start = startDate ? startOfDay(startDate) : startOfDay(today);
    const end = endDate ? endOfDay(endDate) : endOfDay(today);
    
    const storeFilter = getTenantFilter(storeId, !isAdmin);
    const dateRange = { gte: start, lte: end };

    const [sales, collections, transactionCount] = await Promise.all([
      prisma.sale.aggregate({
        where: { ...storeFilter, createdAt: dateRange },
        _sum: { totalAmount: true, paidAmount: true, dueAmount: true, profit: true },
      }),
      prisma.payment.aggregate({
        where: { ...storeFilter, date: dateRange },
        _sum: { amount: true },
      }),
      prisma.transaction.count({
        where: { ...storeFilter, createdAt: dateRange },
      }),
    ]);

    // Calculate all cash outflows
    const outflowsAgg = await prisma.transaction.aggregate({
      where: { 
        ...storeFilter, 
        createdAt: dateRange, 
        type: { in: ["PURCHASE", "SECONDHAND_BUY", "HAWLAT_GIVEN", "EXPENSE"] },
        mode: { not: "DUE" }
      },
      _sum: { amount: true },
    });

    const totalCashOut = Number(outflowsAgg._sum.amount || 0);
    const totalProfit = Number(sales._sum.profit || 0);

    return {
      totalSales: Number(sales._sum.totalAmount || 0),
      cashSales: Number(sales._sum.paidAmount || 0),
      dueSales: Number(sales._sum.dueAmount || 0),
      collections: Number(collections._sum.amount || 0),
      expenses: totalCashOut,
      netCash: Number(collections._sum.amount || 0) - totalCashOut,
      transactionCount,
      profit: totalProfit,
    };
  }
}

export class CapitalService {
  async getCapitalSummary(storeId: string, isAdmin?: boolean): Promise<CapitalSummary> {
    const storeFilter = getTenantFilter(storeId, !isAdmin);

    const [suppliers, loans, products] = await Promise.all([
      prisma.supplier.aggregate({
        where: storeFilter,
        _sum: { dueAmount: true },
      }),
      prisma.loan.aggregate({
        where: { ...storeFilter, remaining: { gt: 0 } },
        _sum: { remaining: true },
      }),
      prisma.product.findMany({
        where: storeFilter,
      }),
    ]);

    const supplierDue = Number(suppliers._sum.dueAmount || 0);
    const loansOutstanding = Number(loans._sum.remaining || 0);

    const ownedStockValue = products.reduce((sum, product) => {
      return sum + (Number(product.cost) * product.stock);
    }, 0);

    return {
      ownedStockValue,
      supplierDue,
      loansOutstanding,
      netCapital: ownedStockValue - supplierDue - loansOutstanding,
    };
  }
}