import { prisma } from "@/lib/prisma";

export interface ReconciliationItem {
  label: string;
  physical: number;
  ledger: number;
  difference: number;
  status: "match" | "minor" | "major";
}

export interface ReconciliationReport {
  storeId: string;
  date: string;
  items: ReconciliationItem[];
  hasIssues: boolean;
}

function getAccountBalance(accountCode: string, storeId: string): Promise<number> {
  return prisma.journalLine
    .aggregate({
      where: {
        account: { code: accountCode, storeId },
        journalEntry: { storeId },
      },
      _sum: { debit: true, credit: true },
    })
    .then(r => Number(r._sum.debit || 0) - Number(r._sum.credit || 0));
}

export async function reconcileStock(storeId: string): Promise<ReconciliationItem> {
  const products = await prisma.product.findMany({ where: { storeId } });
  const physicalStockValue = products.reduce(
    (sum, p) => sum + Number(p.cost) * p.stock, 0
  );

  const ledgerBalance = await getAccountBalance("1100", storeId);
  const diff = Math.round((physicalStockValue - ledgerBalance) * 100) / 100;

  const absDiff = Math.abs(diff);
  const status: ReconciliationItem["status"] =
    absDiff === 0 ? "match" : absDiff < 100 ? "minor" : "major";

  return {
    label: "Inventory",
    physical: physicalStockValue,
    ledger: ledgerBalance,
    difference: diff,
    status,
  };
}

export async function reconcileCustomerDues(storeId: string): Promise<ReconciliationItem> {
  const dues = await prisma.customer.aggregate({
    where: { storeId },
    _sum: { dueAmount: true },
  });
  const totalDues = Math.round(Number(dues._sum.dueAmount || 0) * 100) / 100;

  const ledgerAr = await getAccountBalance("1200", storeId);
  const diff = Math.round((totalDues - ledgerAr) * 100) / 100;

  const absDiff = Math.abs(diff);
  const status: ReconciliationItem["status"] =
    absDiff === 0 ? "match" : absDiff < 100 ? "minor" : "major";

  return {
    label: "Customer Dues",
    physical: totalDues,
    ledger: ledgerAr,
    difference: diff,
    status,
  };
}

export async function reconcileSupplierDues(storeId: string): Promise<ReconciliationItem> {
  const suppliers = await prisma.supplier.aggregate({
    where: { storeId },
    _sum: { dueAmount: true },
  });
  const totalDue = Math.round(Number(suppliers._sum.dueAmount || 0) * 100) / 100;

  const ledgerAp = await getAccountBalance("2000", storeId);
  const diff = Math.round((totalDue - ledgerAp) * 100) / 100;

  const absDiff = Math.abs(diff);
  const status: ReconciliationItem["status"] =
    absDiff === 0 ? "match" : absDiff < 100 ? "minor" : "major";

  return {
    label: "Supplier Dues",
    physical: totalDue,
    ledger: ledgerAp,
    difference: diff,
    status,
  };
}

export async function reconcileLoans(storeId: string): Promise<ReconciliationItem[]> {
  const loans = await prisma.loan.findMany({ where: { storeId } });
  const given = loans
    .filter(l => l.type === "GIVE")
    .reduce((s, l) => s + Number(l.remaining), 0);
  const taken = loans
    .filter(l => l.type === "TAKE")
    .reduce((s, l) => s + Number(l.remaining), 0);

  const ledgerGiven = await getAccountBalance("1300", storeId);
  const ledgerTaken = await getAccountBalance("2100", storeId);

  const givenDiff = Math.round((given - ledgerGiven) * 100) / 100;
  const takenDiff = Math.round((taken - ledgerTaken) * 100) / 100;

  const item = (label: string, physical: number, ledger: number, diff: number): ReconciliationItem => {
    const abs = Math.abs(diff);
    return {
      label,
      physical,
      ledger,
      difference: diff,
      status: abs === 0 ? "match" : abs < 100 ? "minor" : "major",
    };
  };

  return [
    item("Loans Given", given, ledgerGiven, givenDiff),
    item("Loans Taken", taken, ledgerTaken, takenDiff),
  ];
}

export async function runFullReconciliation(storeId: string): Promise<ReconciliationReport> {
  const [stock, dues, supplierDues, loans] = await Promise.all([
    reconcileStock(storeId),
    reconcileCustomerDues(storeId),
    reconcileSupplierDues(storeId),
    reconcileLoans(storeId),
  ]);

  const items = [stock, dues, supplierDues, ...loans];
  const hasIssues = items.some(i => i.status !== "match");

  return {
    storeId,
    date: new Date().toISOString(),
    items,
    hasIssues,
  };
}
