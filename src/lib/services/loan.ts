import { prisma } from "@/lib/prisma";
import type { LoanCreateInput, LoanPaymentInput } from "@/types";

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
    const loan = await prisma.loan.findUnique({ where: { id } });
    if (!loan) throw new Error("Loan not found");

    const transactionType = loan.type === "GIVE" ? "HAWLAT_RECEIVED" : "HAWLAT_GIVEN";

    return prisma.$transaction(async (tx) => {
      const [updated] = await Promise.all([
        tx.loan.update({
          where: { id },
          data: {
            paid: { increment: data.amount },
            remaining: { decrement: data.amount },
          },
        }),
      ]);

      if (data.mode && data.mode !== "DUE") {
        await tx.transaction.create({
          data: {
            type: transactionType,
            amount: data.amount,
            mode: data.mode,
            description: data.note,
            loanId: id,
            userId,
            storeId,
          },
        });
      }

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