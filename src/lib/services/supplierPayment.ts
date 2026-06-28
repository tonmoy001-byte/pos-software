import { prisma } from "@/lib/prisma";
import { eventStore, EventStoreData } from "./eventStore";
import { postSupplierPaymentEntry } from "./posting";
import { PurchaseService } from "./purchase";

export interface SupplierPaymentCreateInput {
  purchaseId?: string;
  amount: number;
  mode: string;
  notes?: string;
}

export class SupplierPaymentService {
  private purchaseService = new PurchaseService();

  async create(supplierId: string, data: SupplierPaymentCreateInput, storeId: string, userId: string) {
    if (data.amount <= 0) throw new Error("Payment amount must be positive");

    const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, storeId } });
    if (!supplier) throw new Error("Supplier not found");

    if (data.purchaseId) {
      const purchase = await prisma.purchase.findFirst({ where: { id: data.purchaseId, storeId } });
      if (!purchase) throw new Error("Purchase not found");
      if (Number(purchase.dueAmount) < data.amount) {
        throw new Error(`Payment amount exceeds due. Due: ${purchase.dueAmount}`);
      }
    }

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.supplierPayment.create({
        data: {
          supplierId,
          purchaseId: data.purchaseId || null,
          amount: data.amount,
          mode: data.mode as any,
          notes: data.notes,
          storeId,
          userId,
        },
      });

      // Create Transaction
      const transaction = await tx.transaction.create({
        data: {
          type: "DUE_PAYMENT",
          amount: data.amount,
          mode: data.mode as any,
          description: `Supplier payment: ${supplier.name}`,
          supplierId,
          storeId,
          userId,
        },
      });

      // Post journal entry
      await postSupplierPaymentEntry(
        transaction.id,
        data.amount,
        data.mode,
        `Payment to ${supplier.name}`,
        storeId,
        tx
      );

      // Recalculate supplier due
      await this.purchaseService.recalculateSupplierDue(supplierId, tx);

      // Audit log
      await tx.auditLog.create({
        data: {
          action: "PAYMENT",
          entity: "SupplierPayment",
          entityId: p.id,
          userId,
          storeId,
          details: { amount: data.amount, mode: data.mode },
        },
      });

      await eventStore.append({
        aggregateType: "SupplierPayment",
        aggregateId: p.id,
        type: "CREATED",
        payload: { supplierId, amount: data.amount, mode: data.mode },
        userId,
        storeId,
      } as EventStoreData, tx);

      return p;
    });

    return payment;
  }

  async findBySupplier(supplierId: string, storeId: string) {
    return prisma.supplierPayment.findMany({
      where: { supplierId, storeId },
      include: {
        purchase: { select: { purchaseId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }
}
