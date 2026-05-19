import { prisma } from "@/lib/prisma";
import type { LoanCreateInput, LoanPaymentInput } from "@/types";
import { eventStore } from "./eventStore";

export class LoanService {
  async create(data: LoanCreateInput, storeId: string, userId: string) {
    const transactionType = data.type === "GIVE" ? "HAWLAT_GIVEN" : "HAWLAT_RECEIVED";

    return prisma.$transaction(async (tx) => {
      const loan = await tx.loan.create({
        data: {
          borrower: data.personName,
          type: data.type,
          amount: data.amount,
          remaining: data.amount,
          storeId,
        },
      });

      if (data.mode && data.mode !== "DUE") {
        await tx.transaction.create({
          data: {
            type: transactionType,
            amount: data.amount,
            mode: data.mode,
            description: data.description,
            loanId: loan.id,
            userId,
            storeId,
          },
        });
      }

      await eventStore.append({
        aggregateType: "Loan",
        aggregateId: loan.id,
        type: "CREATED",
        payload: {
          borrower: loan.borrower,
          type: loan.type,
          amount: loan.amount,
        },
        userId,
        storeId,
      }, tx);

      return loan;
    });
  }

  async findAll(storeId?: string, filter?: "active" | "settled") {
    const where: any = { storeId };
    
    if (filter === "active") {
      where.remaining = { gt: 0 };
    } else if (filter === "settled") {
      where.remaining = 0;
    }

    return prisma.loan.findMany({
      where,
      orderBy: { date: "desc" },
    });
  }

  async findById(id: string) {
    return prisma.loan.findUnique({ where: { id } });
  }

  async payment(id: string, data: LoanPaymentInput, userId: string, storeId: string) {
    return prisma.$transaction(async (tx) => {
      // Security: Validate loan belongs to store inside transaction
      const loan = await tx.loan.findFirst({
        where: { id, storeId }
      });
      if (!loan) throw new Error("Loan not found or unauthorized");

      const transactionType = loan.type === "GIVE" ? "HAWLAT_RECEIVED" : "HAWLAT_GIVEN";

      const currentPaid = Number(loan.paid);
      const currentRemaining = Number(loan.remaining);
      const cappedAmount = Math.min(data.amount, currentRemaining);

      if (data.amount > currentRemaining) {
        throw new Error(`Payment (${data.amount}) exceeds remaining balance (${currentRemaining}). Overpayment not allowed.`);
      }

      const [updated] = await Promise.all([
        tx.loan.update({
          where: { id },
          data: {
            paid: { increment: cappedAmount },
            remaining: { decrement: cappedAmount },
          },
        }),
      ]);

      if (data.mode && data.mode !== "DUE") {
        await tx.transaction.create({
          data: {
            type: transactionType,
            amount: cappedAmount,
            mode: data.mode,
            description: data.note,
            loanId: id,
            userId,
            storeId,
          },
        });
      }

      await eventStore.append({
        aggregateType: "Loan",
        aggregateId: id,
        type: "UPDATED",
        payload: {
          paymentAmount: cappedAmount,
          paid: currentPaid + cappedAmount,
          remaining: currentRemaining - cappedAmount,
        },
        userId,
        storeId,
      }, tx);

      return updated;
    });
  }

  async getTotalOutstanding(storeId?: string, type?: "GIVE" | "TAKE") {
    const where: any = { storeId, remaining: { gt: 0 } };
    if (type) where.type = type;

    const result = await prisma.loan.aggregate({
      where,
      _sum: { remaining: true },
    });

    return Number(result._sum.remaining || 0);
  }
}