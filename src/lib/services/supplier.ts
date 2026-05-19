import { prisma } from "@/lib/prisma";
import type { SupplierCreateInput, SupplierUpdateInput, SupplierProductInput } from "@/types";
import { eventStore, EventStoreData } from "./eventStore";

export class SupplierService {
  async create(data: SupplierCreateInput, storeId: string) {
    const supplier = await prisma.supplier.create({
      data: {
        name: data.name,
        phone: data.phone,
        address: data.address,
        storeId,
      },
    });

    await eventStore.append({
      aggregateType: "Supplier",
      aggregateId: supplier.id,
      type: "CREATED",
      payload: { name: data.name, phone: data.phone },
      storeId,
    } as EventStoreData);

    return supplier;
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
      const adjustment = data.dueAdjustment;

      const [updated] = await prisma.$transaction(async (tx) => {
        const updatedSupplier = await tx.supplier.update({
          where: { id },
          data: { dueAmount: newDue },
        });

        await tx.transaction.create({
          data: {
            type: adjustment > 0 ? "PURCHASE" : "DUE_PAYMENT",
            amount: Math.abs(adjustment),
            mode: "DUE",
            description: `Due adjustment: ${data.note || "Manual"}`,
            supplierId: id,
            userId,
            storeId,
          },
        });

        await eventStore.append({
          aggregateType: "Supplier",
          aggregateId: id,
          type: "UPDATED",
          payload: { dueAmount: newDue, adjustment },
          metadata: { previousState: { dueAmount: currentDue } },
          userId,
          storeId,
        } as EventStoreData, tx);

        return [updatedSupplier];
      });

      return updated;
    }

    const updatedSupplier = await prisma.supplier.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone,
        address: data.address,
      },
    });

    await eventStore.append({
      aggregateType: "Supplier",
      aggregateId: id,
      type: "UPDATED",
      payload: { name: data.name, phone: data.phone },
      storeId,
    } as EventStoreData);

    return updatedSupplier;
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

    const productEntries: { supplierId: string; productName: string; productId?: string }[] = [];

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
      await prisma.$transaction(async (tx) => {
        for (const entry of productEntries) {
          await tx.supplierProduct.upsert({
            where: {
              supplierId_productName: {
                supplierId: entry.supplierId,
                productName: entry.productName,
              },
            },
            update: { productId: entry.productId },
            create: entry,
          });
        }

        await eventStore.append({
          aggregateType: "Supplier",
          aggregateId: supplierId,
          type: "UPDATED",
          payload: { productsAdded: productEntries.map(e => e.productName) },
          storeId,
        }, tx);
      });
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

    await eventStore.append({
      aggregateType: "Supplier",
      aggregateId: link.supplierId,
      type: "UPDATED",
      payload: { productRemoved: link.productName },
      storeId,
    });
  }

  async delete(id: string, storeId: string) {
    const supplier = await prisma.supplier.findFirst({
      where: { id, storeId },
    });
    if (!supplier) throw new Error("Supplier not found");

    return prisma.$transaction(async (tx) => {
      await tx.supplierProduct.deleteMany({ where: { supplierId: id } });
      const result = await tx.supplier.delete({ where: { id } });

      await eventStore.append({
        aggregateType: "Supplier",
        aggregateId: id,
        type: "DELETED",
        payload: { name: supplier.name },
        storeId,
      } as EventStoreData, tx);

      return result;
    });
  }
}