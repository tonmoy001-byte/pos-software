import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const DEFAULT_ACCOUNTS = [
  { code: "1000", name: "Cash in Hand", type: "ASSET", isSystem: true },
  { code: "1010", name: "Bank Account", type: "ASSET", isSystem: true },
  { code: "1100", name: "Inventory", type: "ASSET", isSystem: true },
  { code: "1200", name: "Accounts Receivable", type: "ASSET", isSystem: true },
  { code: "1300", name: "Loans Given", type: "ASSET", isSystem: true },
  { code: "2000", name: "Accounts Payable", type: "LIABILITY", isSystem: true },
  { code: "2100", name: "Loans Taken", type: "LIABILITY", isSystem: true },
  { code: "3000", name: "Owner's Capital", type: "EQUITY", isSystem: true },
  { code: "3100", name: "Retained Earnings", type: "EQUITY", isSystem: true },
  { code: "4000", name: "Sales Revenue", type: "REVENUE", isSystem: true },
  { code: "5000", name: "Cost of Goods Sold", type: "EXPENSE", isSystem: true },
  { code: "5100", name: "Operating Expenses", type: "EXPENSE", isSystem: true },
];

const accountCache = new Map<string, Map<string, string>>();

async function getAccountMap(storeId: string, tx: Prisma.TransactionClient): Promise<Map<string, string>> {
  if (!accountCache.has(storeId)) {
    const accounts = await tx.account.findMany({ where: { storeId } });
    accountCache.set(storeId, new Map(accounts.map(a => [a.code, a.id])));
  }
  return accountCache.get(storeId)!;
}

async function ensureAccountsLoaded(storeId: string, tx: Prisma.TransactionClient): Promise<void> {
  // Only load accounts if not already cached
  if (!accountCache.has(storeId)) {
    const accounts = await tx.account.findMany({ where: { storeId } });
    accountCache.set(storeId, new Map(accounts.map(a => [a.code, a.id])));
  }
}

export async function ensureAccounts(storeId: string, tx?: Prisma.TransactionClient) {
  const client = tx || prisma;
  accountCache.delete(storeId);
  for (const acc of DEFAULT_ACCOUNTS) {
    await client.account.upsert({
      where: { code_storeId: { code: acc.code, storeId } },
      update: {},
      create: { ...acc, storeId },
    });
  }
  const accounts = await client.account.findMany({ where: { storeId } });
  accountCache.set(storeId, new Map(accounts.map(a => [a.code, a.id])));
}

function getAccountCode(mode: string): string {
  switch (mode) {
    case "CASH": return "1000";
    case "BANK": return "1010";
    case "BKASH":
    case "NAGAD":
    case "CARD": return "1010";
    case "DUE": return "1200";
    default: return "1000";
  }
}

export async function postSaleEntry(
  saleId: string,
  totalAmount: number,
  costAmount: number,
  paidAmount: number,
  mode: string,
  storeId: string,
  tx: Prisma.TransactionClient
) {
  await ensureAccounts(storeId, tx);
  const accountMap = await getAccountMap(storeId, tx);

  const lines: { accountId: string; debit: number; credit: number }[] = [];
  const dueAmount = totalAmount - paidAmount;

  // For due sales, debit AR for the full amount
  // For cash/partial sales, debit cash for paid portion and AR for due portion
  if (mode === "DUE" || paidAmount === 0) {
    // Pure credit sale: Dr AR, Cr Revenue
    lines.push({ accountId: accountMap.get("1200")!, debit: totalAmount, credit: 0 });
  } else if (dueAmount > 0) {
    // Partial payment: Dr Cash for paid, Dr AR for due
    const cashAccountCode = getAccountCode(mode);
    const cashId = accountMap.get(cashAccountCode)!;
    lines.push({ accountId: cashId, debit: paidAmount, credit: 0 });
    lines.push({ accountId: accountMap.get("1200")!, debit: dueAmount, credit: 0 });
  } else {
    // Full cash payment: Dr Cash, Cr Revenue
    const cashAccountCode = getAccountCode(mode);
    const cashId = accountMap.get(cashAccountCode)!;
    lines.push({ accountId: cashId, debit: totalAmount, credit: 0 });
  }

  // Cr Sales Revenue for full amount
  lines.push({ accountId: accountMap.get("4000")!, debit: 0, credit: totalAmount });

  // Dr COGS, Cr Inventory
  if (costAmount > 0) {
    lines.push({ accountId: accountMap.get("5000")!, debit: costAmount, credit: 0 });
    lines.push({ accountId: accountMap.get("1100")!, debit: 0, credit: costAmount });
  }

  await tx.journalEntry.create({
    data: {
      date: new Date(),
      description: `Sale ${saleId}`,
      referenceId: saleId,
      referenceType: "Sale",
      storeId,
      lines: { create: lines },
    },
  });
}

export async function postRefundEntry(
  saleId: string,
  refundAmount: number,
  costAmount: number,
  mode: string,
  isFullRefund: boolean,
  storeId: string,
  tx: Prisma.TransactionClient
) {
  await ensureAccounts(storeId, tx);
  const accountMap = await getAccountMap(storeId, tx);

  const lines: { accountId: string; debit: number; credit: number }[] = [];
  const cashAccountCode = getAccountCode(mode);
  const cashId = accountMap.get(cashAccountCode)!;

  // Reverse sale entry: Cr Cash, Dr Sales Revenue (negative sale)
  lines.push({ accountId: cashId, debit: 0, credit: refundAmount });
  lines.push({ accountId: accountMap.get("4000")!, debit: refundAmount, credit: 0 });

  // Reverse COGS on full refund
  if (isFullRefund && costAmount > 0) {
    lines.push({ accountId: accountMap.get("5000")!, debit: 0, credit: costAmount });
    lines.push({ accountId: accountMap.get("1100")!, debit: costAmount, credit: 0 });
  }

  // If there was due, reduce receivables
  if (!isFullRefund) {
    // For partial refund, assume no due adjustment from this call
  }

  await tx.journalEntry.create({
    data: {
      date: new Date(),
      description: `Refund ${saleId}`,
      referenceId: saleId,
      referenceType: "Sale",
      storeId,
      lines: { create: lines },
    },
  });
}

export async function postTransactionEntry(
  transactionId: string,
  type: string,
  amount: number,
  mode: string,
  description: string,
  storeId: string,
  tx: Prisma.TransactionClient
) {
  await ensureAccounts(storeId, tx);
  const accountMap = await getAccountMap(storeId, tx);

  const cashAccountCode = getAccountCode(mode);
  const cashId = accountMap.get(cashAccountCode)!;
  const lines: { accountId: string; debit: number; credit: number }[] = [];

  switch (type) {
    case "EXPENSE":
      lines.push({ accountId: accountMap.get("5100")!, debit: amount, credit: 0 });
      lines.push({ accountId: cashId, debit: 0, credit: amount });
      break;
    case "PURCHASE":
      lines.push({ accountId: accountMap.get("1100")!, debit: amount, credit: 0 });
      if (mode === "DUE") {
        lines.push({ accountId: accountMap.get("2000")!, debit: 0, credit: amount });
      } else {
        lines.push({ accountId: cashId, debit: 0, credit: amount });
      }
      break;
    case "PURCHASE_RETURN":
      lines.push({ accountId: accountMap.get("2000")!, debit: amount, credit: 0 });
      lines.push({ accountId: accountMap.get("1100")!, debit: 0, credit: amount });
      break;
    case "SECONDHAND_BUY":
      lines.push({ accountId: accountMap.get("1100")!, debit: amount, credit: 0 });
      lines.push({ accountId: cashId, debit: 0, credit: amount });
      break;
    case "HAWLAT_GIVEN":
      lines.push({ accountId: accountMap.get("1300")!, debit: amount, credit: 0 });
      lines.push({ accountId: cashId, debit: 0, credit: amount });
      break;
    case "HAWLAT_RECEIVED":
      lines.push({ accountId: cashId, debit: amount, credit: 0 });
      lines.push({ accountId: accountMap.get("2100")!, debit: 0, credit: amount });
      break;
    case "DUE_PAYMENT":
      lines.push({ accountId: cashId, debit: amount, credit: 0 });
      lines.push({ accountId: accountMap.get("1200")!, debit: 0, credit: amount });
      break;
    default:
      return;
  }

  await tx.journalEntry.create({
    data: {
      date: new Date(),
      description,
      referenceId: transactionId,
      referenceType: "Transaction",
      storeId,
      lines: { create: lines },
    },
  });
}

export async function postDueCollectionEntry(
  paymentId: string,
  amount: number,
  mode: string,
  storeId: string,
  tx: Prisma.TransactionClient
) {
  await ensureAccounts(storeId, tx);
  const accountMap = await getAccountMap(storeId, tx);

  const cashAccountCode = getAccountCode(mode);
  const cashId = accountMap.get(cashAccountCode)!;

  const lines: { accountId: string; debit: number; credit: number }[] = [
    { accountId: cashId, debit: amount, credit: 0 },
    { accountId: accountMap.get("1200")!, debit: 0, credit: amount },
  ];

  await tx.journalEntry.create({
    data: {
      date: new Date(),
      description: `Due collection ${paymentId}`,
      referenceId: paymentId,
      referenceType: "Payment",
      storeId,
      lines: { create: lines },
    },
  });
}

export async function postPurchaseEntry(
  purchaseId: string,
  totalAmount: number,
  paidAmount: number,
  mode: string,
  description: string,
  storeId: string,
  tx: Prisma.TransactionClient
) {
  await ensureAccounts(storeId, tx);
  const accountMap = await getAccountMap(storeId, tx);

  const lines: { accountId: string; debit: number; credit: number }[] = [];

  // Dr Inventory (1100) for total amount
  lines.push({ accountId: accountMap.get("1100")!, debit: totalAmount, credit: 0 });

  // Cr Cash/Bank for paid portion
  if (paidAmount > 0) {
    const cashAccountCode = getAccountCode(mode);
    const cashId = accountMap.get(cashAccountCode)!;
    lines.push({ accountId: cashId, debit: 0, credit: paidAmount });
  }

  // Cr Accounts Payable for due portion
  const dueAmount = totalAmount - paidAmount;
  if (dueAmount > 0) {
    lines.push({ accountId: accountMap.get("2000")!, debit: 0, credit: dueAmount });
  }

  await tx.journalEntry.create({
    data: {
      date: new Date(),
      description,
      referenceId: purchaseId,
      referenceType: "Purchase",
      storeId,
      lines: { create: lines },
    },
  });
}

export async function postSupplierPaymentEntry(
  paymentId: string,
  amount: number,
  mode: string,
  description: string,
  storeId: string,
  tx: Prisma.TransactionClient
) {
  await ensureAccounts(storeId, tx);
  const accountMap = await getAccountMap(storeId, tx);

  const cashAccountCode = getAccountCode(mode);
  const cashId = accountMap.get(cashAccountCode)!;

  const lines: { accountId: string; debit: number; credit: number }[] = [
    { accountId: cashId, debit: amount, credit: 0 },
    { accountId: accountMap.get("2000")!, debit: 0, credit: amount },
  ];

  await tx.journalEntry.create({
    data: {
      date: new Date(),
      description,
      referenceId: paymentId,
      referenceType: "SupplierPayment",
      storeId,
      lines: { create: lines },
    },
  });
}

export async function postSupplierReturnEntry(
  returnId: string,
  amount: number,
  description: string,
  storeId: string,
  tx: Prisma.TransactionClient
) {
  await ensureAccounts(storeId, tx);
  const accountMap = await getAccountMap(storeId, tx);

  const lines: { accountId: string; debit: number; credit: number }[] = [
    { accountId: accountMap.get("2000")!, debit: amount, credit: 0 },
    { accountId: accountMap.get("1100")!, debit: 0, credit: amount },
  ];

  await tx.journalEntry.create({
    data: {
      date: new Date(),
      description,
      referenceId: returnId,
      referenceType: "SupplierReturn",
      storeId,
      lines: { create: lines },
    },
  });
}
