import { prisma } from "@/lib/prisma";

export async function generateInvoiceNumber(storeId: string): Promise<string> {
  let prefix = "INV";
  let nextNumber = 1;

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { invoicePrefix: true, invoiceNumbering: true },
  });

  if (store) {
    prefix = store.invoicePrefix || "INV";
    nextNumber = store.invoiceNumbering || 1;
  }

  const paddedSequence = String(nextNumber).padStart(6, "0");
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");

  const invoiceNumber = `${prefix}-${year}${month}${paddedSequence}`;

  await prisma.store.update({
    where: { id: storeId },
    data: { invoiceNumbering: nextNumber + 1 },
  });

  return invoiceNumber;
}