import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type StockMovementReason =
  | "SALE"
  | "REFUND"
  | "PURCHASE"
  | "STOCK_IN"
  | "STOCK_ADJUSTMENT"
  | "ADVANCE_COMPLETE";

export async function recordStockMovement(
  productId: string,
  quantityChange: number,
  reason: StockMovementReason,
  storeId: string,
  options?: {
    referenceId?: string;
    referenceType?: string;
    tx?: Prisma.TransactionClient;
    stockBefore?: number;
  }
) {
  const client = options?.tx || prisma;
  const product = await client.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error(`Product ${productId} not found`);

  const stockBefore = options?.stockBefore ?? product.stock;
  const stockAfter = stockBefore + quantityChange;

  await client.stockMovement.create({
    data: {
      productId,
      quantityChange,
      stockBefore,
      stockAfter,
      reason,
      referenceId: options?.referenceId || null,
      referenceType: options?.referenceType || null,
      storeId,
    },
  });

  return { stockBefore, stockAfter };
}
