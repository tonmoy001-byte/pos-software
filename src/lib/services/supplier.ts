import { prisma } from "@/lib/prisma";
import type { SupplierCreateInput, SupplierUpdateInput, SupplierProductInput } from "@/types";

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
      take: 100,
      include: {
        products: { orderBy: { productName: "asc" } },
      },
    });
  }

  async findById(id: string, storeId: string) {
    return prisma.supplier.findFirst({
      where: { id, storeId },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });
  }

  async update(id: string, data: SupplierUpdateInput, userId: string, storeId: string) {
    // Security: Verify supplier belongs to store
    const supplier = await prisma.supplier.findFirst({ where: { id, storeId } });
    if (!supplier) throw new Error("Supplier not found");

    if (data.dueAdjustment !== undefined) {
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

  async getProductsBySupplier(supplierId: string, storeId: string) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, storeId },
    });
    if (!supplier) throw new Error("Supplier not found");

    return prisma.supplierProduct.findMany({
      where: { supplierId },
      orderBy: { productName: "asc" },
    });
  }

  async addProducts(supplierId: string, data: SupplierProductInput, storeId: string) {
    // Security: Verify supplier belongs to store
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, storeId },
    });
    if (!supplier) throw new Error("Supplier not found");

    const productEntries = [];

    if (data.productIds?.length) {
      for (const productId of data.productIds) {
        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (product) {
          productEntries.push({
            supplierId,
            productId: product.id,
            productName: product.name,
          });
        }
      }
    }

    if (data.newProducts?.length) {
      for (const name of data.newProducts) {
        productEntries.push({ supplierId, productName: name });
      }
    }

    // Bulk create all entries
    if (productEntries.length > 0) {
      await prisma.$transaction(
        productEntries.map(entry =>
          prisma.supplierProduct.upsert({
            where: {
              supplierId_productName: {
                supplierId: entry.supplierId,
                productName: entry.productName,
              },
            },
            update: { productId: entry.productId },
            create: entry,
          })
        )
      );
    }

    return this.getProductsBySupplier(supplierId, storeId);
  }

  async removeProduct(linkId: string, storeId: string) {
    const link = await prisma.supplierProduct.findUnique({
      where: { id: linkId },
      include: { supplier: { select: { storeId: true } } },
    });
    if (!link || link.supplier.storeId !== storeId) {
      throw new Error("Product link not found");
    }
    await prisma.supplierProduct.delete({ where: { id: linkId } });
  }

  async delete(id: string, storeId: string) {
    const supplier = await prisma.supplier.findFirst({
      where: { id, storeId },
    });
    if (!supplier) throw new Error("Supplier not found");

    await prisma.supplierProduct.deleteMany({ where: { supplierId: id } });
    return prisma.supplier.delete({ where: { id } });
  }
}