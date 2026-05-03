import { prisma } from "@/lib/prisma";
import type { SupplierCreateInput, SupplierUpdateInput } from "@/types";

export class SupplierService {
  async create(data: SupplierCreateInput, storeId: string) {
    return prisma.supplier.create({
      data: {
        name: data.name,
        phone: data.phone,
        address: data.address,
        storeId,
      },
    });
  }

  async findAll(storeId?: string) {
    return prisma.supplier.findMany({
      where: { storeId },
      orderBy: { name: "asc" },
    });
  }

  async findById(id: string) {
    return prisma.supplier.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });
  }

  async update(id: string, data: SupplierUpdateInput, userId: string, storeId: string) {
    if (data.dueAdjustment !== undefined) {
      const supplier = await prisma.supplier.findUnique({ where: { id } });
      if (!supplier) throw new Error("Supplier not found");

      const currentDue = Number(supplier.dueAmount) || 0;
      const newDue = currentDue + data.dueAdjustment;

      const [updated] = await prisma.$transaction([
        prisma.supplier.update({
          where: { id },
          data: { dueAmount: newDue },
        }),
        prisma.transaction.create({
          data: {
            type: data.dueAdjustment > 0 ? "PURCHASE" : "DUE_PAYMENT",
            amount: Math.abs(data.dueAdjustment),
            mode: "DUE",
            description: `Due adjustment: ${data.note || "Manual"}`,
            supplierId: id,
            userId,
            storeId,
          },
        }),
      ]);

      return updated;
    }

    return prisma.supplier.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone,
        address: data.address,
      },
    });
  }

  async getTotalDue(storeId?: string) {
    const result = await prisma.supplier.aggregate({
      where: { storeId },
      _sum: { dueAmount: true },
    });
    return Number(result._sum.dueAmount || 0);
  }
}