import { prisma } from "@/lib/prisma";
import { eventStore, EventStoreData } from "./eventStore";
import { postSupplierReturnEntry } from "./posting";
import { PurchaseService } from "./purchase";

export interface SupplierReturnCreateInput {
  purchaseId?: string;
  productId?: string;
  productName: string;
  quantity: number;
  unitCost: number;
  reason?: string;
}

export class SupplierReturnService {
  private purchaseService = new PurchaseService();

  async create(supplierId: string, data: SupplierReturnCreateInput, storeId: string, userId: string) {
    if (data.quantity <= 0) throw new Error("Quantity must be positive");
    if (data.unitCost <= 0) throw new Error("Unit cost must be positive");

    const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, storeId } });
    if (!supplier) throw new Error("Supplier not found");

    const totalCost = data.quantity * data.unitCost;

    const returnRecord = await prisma.$transaction(async (tx) => {
      const r = await tx.supplierReturn.create({
        data: {
          supplierId,
          purchaseId: data.purchaseId || null,
          productId: data.productId || null,
          productName: data.productName,
          quantity: data.quantity,
          unitCost: data.unitCost,
          totalCost,
          reason: data.reason,
          storeId,
          userId,
        },
      });

      // Decrease product stock
      if (data.productId) {
        const product = await tx.product.findUnique({ where: { id: data.productId } });
        if (product) {
          const oldStock = product.stock;
          const newStock = Math.max(0, oldStock - data.quantity);

          await tx.product.update({
            where: { id: data.productId },
            data: { stock: newStock },
          });

          // Create StockMovement
          await tx.stockMovement.create({
            data: {
              productId: data.productId,
              quantityChange: -data.quantity,
              stockBefore: oldStock,
              stockAfter: newStock,
              reason: "Supplier return",
              referenceId: r.id,
              referenceType: "SupplierReturn",
              storeId,
            },
          });
        }
      }

      // Create Transaction
      const transaction = await tx.transaction.create({
        data: {
          type: "PURCHASE_RETURN",
          amount: totalCost,
          mode: "CASH",
          description: `Supplier return: ${data.productName}`,
          supplierId,
          storeId,
          userId,
        },
      });

      // Post journal entry
      await postSupplierReturnEntry(
        transaction.id,
        totalCost,
        `Return: ${data.productName}`,
        storeId,
        tx
      );

      // Recalculate supplier due
      await this.purchaseService.recalculateSupplierDue(supplierId, tx);

      // Audit log
      await tx.auditLog.create({
        data: {
          action: "RETURN",
          entity: "SupplierReturn",
          entityId: r.id,
          userId,
          storeId,
          details: { productName: data.productName, quantity: data.quantity, unitCost: data.unitCost },
        },
      });

      await eventStore.append({
        aggregateType: "SupplierReturn",
        aggregateId: r.id,
        type: "CREATED",
        payload: { supplierId, productName: data.productName, quantity: data.quantity, totalCost },
        userId,
        storeId,
      } as EventStoreData, tx);

      return r;
    });

    return returnRecord;
  }

  async findBySupplier(supplierId: string, storeId: string) {
    return prisma.supplierReturn.findMany({
      where: { supplierId, storeId },
      include: {
        purchase: { select: { purchaseId: true } },
        product: { select: { name: true, barcode: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }
}
