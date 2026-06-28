import { prisma } from "@/lib/prisma";
import { eventStore, EventStoreData } from "./eventStore";
import { postPurchaseEntry, postTransactionEntry } from "./posting";

export interface PurchaseItemInput {
  productId?: string;
  productName: string;
  quantity: number;
  unitCost: number;
  imeis?: string[];
}

export interface PurchaseCreateInput {
  supplierId: string;
  items: PurchaseItemInput[];
  paidAmount?: number;
  paymentMethod?: string;
  notes?: string;
}

export interface ReceiveItemInput {
  itemId: string;
  quantity: number;
  imeis?: string[];
}

export class PurchaseService {
  async generatePurchaseId(storeId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const prefix = `PUR-${dateStr}-`;

    const last = await prisma.purchase.findFirst({
      where: { storeId, purchaseId: { startsWith: prefix } },
      orderBy: { purchaseId: "desc" },
    });

    if (!last) return `${prefix}001`;
    const lastNum = parseInt(last.purchaseId.split("-").pop() || "0", 10);
    return `${prefix}${String(lastNum + 1).padStart(3, "0")}`;
  }

  async create(data: PurchaseCreateInput, storeId: string, userId: string) {
    const purchaseId = await this.generatePurchaseId(storeId);
    const totalAmount = data.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
    const paidAmount = data.paidAmount || 0;
    const dueAmount = totalAmount - paidAmount;

    const purchase = await prisma.$transaction(async (tx) => {
      const p = await tx.purchase.create({
        data: {
          purchaseId,
          supplierId: data.supplierId,
          totalAmount,
          paidAmount,
          dueAmount,
          status: "DRAFT",
          notes: data.notes,
          storeId,
          userId,
        },
      });

      for (const item of data.items) {
        const totalCost = item.quantity * item.unitCost;
        await tx.purchaseItem.create({
          data: {
            purchaseId: p.id,
            productId: item.productId || null,
            productName: item.productName,
            quantity: item.quantity,
            receivedQuantity: 0,
            unitCost: item.unitCost,
            totalCost,
            storeId,
          },
        });
      }

      await eventStore.append({
        aggregateType: "Purchase",
        aggregateId: p.id,
        type: "CREATED",
        payload: { purchaseId, totalAmount, supplierId: data.supplierId },
        userId,
        storeId,
      } as EventStoreData, tx);

      return p;
    });

    return this.findById(purchase.id, storeId);
  }

  async submit(id: string, storeId: string) {
    const purchase = await prisma.purchase.findFirst({ where: { id, storeId } });
    if (!purchase) throw new Error("Purchase not found");
    if (purchase.status !== "DRAFT") throw new Error("Only DRAFT purchases can be submitted");

    return prisma.purchase.update({
      where: { id },
      data: { status: "PENDING" },
    });
  }

  async receivePartial(id: string, items: ReceiveItemInput[], storeId: string, userId: string) {
    const purchase = await prisma.purchase.findFirst({
      where: { id, storeId },
      include: { items: true },
    });
    if (!purchase) throw new Error("Purchase not found");
    if (purchase.status === "CANCELLED") throw new Error("Cannot receive a cancelled purchase");
    if (purchase.status === "RECEIVED") throw new Error("Purchase already fully received");

    const updatedPurchase = await prisma.$transaction(async (tx) => {
      for (const receiveItem of items) {
        const purchaseItem = purchase.items.find(i => i.id === receiveItem.itemId);
        if (!purchaseItem) throw new Error(`Purchase item ${receiveItem.itemId} not found`);

        const remainingQty = purchaseItem.quantity - purchaseItem.receivedQuantity;
        if (receiveItem.quantity > remainingQty) {
          throw new Error(`Cannot receive ${receiveItem.quantity} units. Only ${remainingQty} remaining.`);
        }

        // Update receivedQuantity
        await tx.purchaseItem.update({
          where: { id: receiveItem.itemId },
          data: { receivedQuantity: { increment: receiveItem.quantity } },
        });

        // Update product stock
        if (purchaseItem.productId) {
          const product = await tx.product.findUnique({ where: { id: purchaseItem.productId } });
          if (product) {
            const oldStock = product.stock;
            const newQty = receiveItem.quantity;
            const newStock = oldStock + newQty;

            // Weighted average cost
            const oldCost = Number(product.cost) || 0;
            const unitCost = Number(purchaseItem.unitCost);
            const newCost = oldStock > 0
              ? ((oldStock * oldCost) + (newQty * unitCost)) / newStock
              : unitCost;

            await tx.product.update({
              where: { id: purchaseItem.productId },
              data: {
                stock: newStock,
                cost: newCost,
              },
            });

            // Create StockMovement
            await tx.stockMovement.create({
              data: {
                productId: purchaseItem.productId,
                quantityChange: newQty,
                stockBefore: oldStock,
                stockAfter: newStock,
                reason: "Purchase receive",
                referenceId: purchase.id,
                referenceType: "Purchase",
                storeId,
              },
            });
          }
        }

        // Create StockUnit records
        const productCode = purchaseItem.productId
          ? (await tx.product.findUnique({ where: { id: purchaseItem.productId } }))?.barcode || "TRK"
          : "TRK";

        for (let i = 0; i < receiveItem.quantity; i++) {
          const seq = await tx.stockUnit.count({
            where: { purchaseItemId: receiveItem.itemId },
          }) + 1;

          const trackingNumber = `${productCode}-${String(seq).padStart(3, "0")}`;
          const imei = receiveItem.imeis?.[i] || null;

          await tx.stockUnit.create({
            data: {
              purchaseItemId: receiveItem.itemId,
              trackingNumber,
              imei,
              status: "RECEIVED",
              storeId,
            },
          });
        }

        // Create PurchaseReceive record
        await tx.purchaseReceive.create({
          data: {
            purchaseId: id,
            itemId: receiveItem.itemId,
            quantity: receiveItem.quantity,
            storeId,
            userId,
          },
        });
      }

      // Determine new status
      const allItems = await tx.purchaseItem.findMany({ where: { purchaseId: id } });
      const allReceived = allItems.every(i => i.receivedQuantity >= i.quantity);
      const anyReceived = allItems.some(i => i.receivedQuantity > 0);
      const newStatus = allReceived ? "RECEIVED" : anyReceived ? "PARTIALLY_RECEIVED" : purchase.status;

      // Update purchase status
      const updated = await tx.purchase.update({
        where: { id },
        data: { status: newStatus as any },
      });

      // Update supplier dueAmount (recalculate from ledger)
      const supplierPurchases = await tx.purchase.aggregate({
        where: { supplierId: purchase.supplierId, status: { not: "CANCELLED" } },
        _sum: { dueAmount: true },
      });
      const supplierPayments = await tx.supplierPayment.aggregate({
        where: { supplierId: purchase.supplierId },
        _sum: { amount: true },
      });
      const supplierReturns = await tx.supplierReturn.aggregate({
        where: { supplierId: purchase.supplierId },
        _sum: { totalCost: true },
      });

      const totalDue = Number(supplierPurchases._sum.dueAmount || 0);
      const totalPaid = Number(supplierPayments._sum.amount || 0);
      const totalReturned = Number(supplierReturns._sum.totalCost || 0);
      const newDueAmount = totalDue - totalPaid - totalReturned;

      await tx.supplier.update({
        where: { id: purchase.supplierId },
        data: { dueAmount: newDueAmount },
      });

      // Create Transaction for the received amount
      const receivedAmount = items.reduce((sum, ri) => {
        const pi = purchase.items.find(i => i.id === ri.itemId);
        return sum + (pi ? ri.quantity * Number(pi.unitCost) : 0);
      }, 0);

      if (receivedAmount > 0) {
        const transaction = await tx.transaction.create({
          data: {
            type: "PURCHASE",
            amount: receivedAmount,
            mode: Number(purchase.paidAmount) > 0 ? "CASH" : "DUE",
            description: `Purchase receive: ${purchase.purchaseId}`,
            supplierId: purchase.supplierId,
            storeId,
            userId,
          },
        });

        // Post journal entry
        await postPurchaseEntry(
          transaction.id,
          receivedAmount,
          Number(purchase.paidAmount) || 0,
          Number(purchase.paidAmount) > 0 ? "CASH" : "DUE",
          `Purchase: ${purchase.purchaseId}`,
          storeId,
          tx
        );
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          action: "RECEIVE",
          entity: "Purchase",
          entityId: id,
          userId,
          storeId,
          details: { items: items.map(i => ({ itemId: i.itemId, quantity: i.quantity })) },
        },
      });

      await eventStore.append({
        aggregateType: "Purchase",
        aggregateId: id,
        type: "UPDATED",
        payload: { status: newStatus, receivedItems: items.length },
        userId,
        storeId,
      } as EventStoreData, tx);

      return updated;
    });

    return this.findById(updatedPurchase.id, storeId);
  }

  async cancel(id: string, storeId: string, userId: string) {
    const purchase = await prisma.purchase.findFirst({ where: { id, storeId } });
    if (!purchase) throw new Error("Purchase not found");
    if (purchase.status === "RECEIVED") throw new Error("Cannot cancel a received purchase");
    if (purchase.status === "CANCELLED") throw new Error("Purchase already cancelled");

    return prisma.$transaction(async (tx) => {
      const updated = await tx.purchase.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      await tx.auditLog.create({
        data: {
          action: "CANCEL",
          entity: "Purchase",
          entityId: id,
          userId,
          storeId,
        },
      });

      await eventStore.append({
        aggregateType: "Purchase",
        aggregateId: id,
        type: "UPDATED",
        payload: { status: "CANCELLED" },
        userId,
        storeId,
      } as EventStoreData, tx);

      return updated;
    });
  }

  async findAll(storeId: string, filters?: {
    status?: string;
    supplierId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const where: any = { storeId };

    if (filters?.status) where.status = filters.status;
    if (filters?.supplierId) where.supplierId = filters.supplierId;
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo + "T23:59:59.999Z");
    }

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        include: {
          supplier: { select: { name: true, phone: true } },
          items: { select: { productName: true, quantity: true, receivedQuantity: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.purchase.count({ where }),
    ]);

    return {
      purchases,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string, storeId: string) {
    return prisma.purchase.findFirst({
      where: { id, storeId },
      include: {
        supplier: { select: { name: true, phone: true, address: true } },
        items: {
          include: {
            product: { select: { name: true, barcode: true } },
            imeis: true,
            receives: { orderBy: { createdAt: "desc" } },
          },
        },
        payments: { orderBy: { createdAt: "desc" } },
        returns: { orderBy: { createdAt: "desc" } },
        receives: { orderBy: { createdAt: "desc" } },
      },
    });
  }

  async recalculateSupplierDue(supplierId: string, tx: any) {
    const [purchases, payments, returns] = await Promise.all([
      tx.purchase.aggregate({
        where: { supplierId, status: { not: "CANCELLED" } },
        _sum: { dueAmount: true },
      }),
      tx.supplierPayment.aggregate({
        where: { supplierId },
        _sum: { amount: true },
      }),
      tx.supplierReturn.aggregate({
        where: { supplierId },
        _sum: { totalCost: true },
      }),
    ]);

    const totalDue = Number(purchases._sum.dueAmount || 0);
    const totalPaid = Number(payments._sum.amount || 0);
    const totalReturned = Number(returns._sum.totalCost || 0);
    const newDueAmount = totalDue - totalPaid - totalReturned;

    await tx.supplier.update({
      where: { id: supplierId },
      data: { dueAmount: newDueAmount },
    });

    return newDueAmount;
  }
}
