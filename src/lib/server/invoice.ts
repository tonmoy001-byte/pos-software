import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function generateInvoiceNumber(
  storeId: string,
  tx: Prisma.TransactionClient = prisma
): Promise<string> {
  const store = await tx.store.update({
    where: { id: storeId },
    data: { invoiceNumbering: { increment: 1 } },
    select: { invoicePrefix: true, invoiceNumbering: true },
  });

  const prefix = store.invoicePrefix || "INV";
  const currentNumber = store.invoiceNumbering - 1;

  const paddedSequence = String(currentNumber).padStart(6, "0");
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${prefix}-${year}${month}${paddedSequence}`;
}
