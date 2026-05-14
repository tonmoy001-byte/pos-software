import { prisma } from "@/lib/prisma";
import { SaleService } from "./sale";
import { TransactionService } from "./transaction";
import { LoanService } from "./loan";
import * as XLSX from "xlsx";
import type { TransactionCreateInput } from "@/types";

const saleService = new SaleService();
const transactionService = new TransactionService();
const loanService = new LoanService();

export interface QuickSaleInput {
  productId: string;
  quantity: number;
  price: number;
  totalAmount: number;
  paidAmount: number;
  paymentMethod?: string;
}

export interface QuickPurchaseInput {
  productId?: string;
  supplierId: string;
  amount: number;
  mode?: string;
  description?: string;
}

export interface QuickExpenseInput {
  amount: number;
  category: string;
  description?: string;
  mode?: string;
}

export interface QuickHawlatInput {
  personName: string;
  type: "GIVE" | "TAKE";
  amount: number;
  mode?: string;
  description?: string;
}

export interface QuickAdvanceInput {
  customerId: string;
  amount: number;
  deliveryDate?: string;
  paymentMethod?: string;
}

export interface DueCollectionInput {
  saleId: string;
  amount: number;
  method?: string;
}

export interface ClosingInput {
  closingCash: number;
  notes?: string;
}

export class DailyActivityService {
  async getSheet(storeId: string, dateStr: string) {
    const dayStart = new Date(dateStr + "T00:00:00.000Z");
    const dayEnd = new Date(dateStr + "T23:59:59.999Z");
    const prevDate = new Date(dayStart.getTime() - 86400000);

    const [
      salesAgg,
      payments,
      transactions,
      loans,
      prevBalance,
      todaysBalance
    ] = await Promise.all([
      prisma.sale.aggregate({
        where: { storeId, createdAt: { gte: dayStart, lte: dayEnd } },
        _sum: { totalAmount: true, paidAmount: true, dueAmount: true, profit: true }
      }),
      prisma.payment.findMany({
        where: { storeId, date: { gte: dayStart, lte: dayEnd } },
        select: { amount: true, method: true }
      }),
      prisma.transaction.findMany({
        where: { storeId, createdAt: { gte: dayStart, lte: dayEnd } },
        orderBy: { createdAt: "desc" }
      }),
      prisma.loan.findMany({
        where: { storeId, date: { gte: dayStart, lte: dayEnd } }
      }),
      prisma.dailyBalance.findUnique({
        where: { storeId_date: { storeId, date: prevDate } }
      }),
      prisma.dailyBalance.findUnique({
        where: { storeId_date: { storeId, date: dayStart } }
      })
    ]);

    const cashSales = payments
      .filter(p => p.method === "CASH")
      .reduce((s, p) => s + Number(p.amount), 0);
    const cardSales = payments
      .filter(p => ["CARD", "BANK"].includes(p.method))
      .reduce((s, p) => s + Number(p.amount), 0);
    const bkashSales = payments
      .filter(p => ["BKASH", "NAGAD"].includes(p.method))
      .reduce((s, p) => s + Number(p.amount), 0);

    const totalPurchases = transactions
      .filter(t => t.type === "PURCHASE")
      .reduce((s, t) => s + Number(t.amount), 0);
    const totalExpenses = transactions
      .filter(t => t.type === "EXPENSE")
      .reduce((s, t) => s + Number(t.amount), 0);
    const totalDuePaid = transactions
      .filter(t => t.type === "DUE_PAYMENT")
      .reduce((s, t) => s + Number(t.amount), 0);
    const totalHawlatGiven = transactions
      .filter(t => t.type === "HAWLAT_GIVEN")
      .reduce((s, t) => s + Number(t.amount), 0);
    const totalHawlatReceived = transactions
      .filter(t => t.type === "HAWLAT_RECEIVED")
      .reduce((s, t) => s + Number(t.amount), 0);

    const openingCash = todaysBalance?.openingCash
      ? Number(todaysBalance.openingCash)
      : prevBalance?.closingCash
        ? Number(prevBalance.closingCash)
        : 0;
    const expectedCash = openingCash
      + cashSales
      + totalDuePaid
      + totalHawlatReceived
      - totalExpenses
      - totalPurchases
      - totalHawlatGiven;

    return {
      cashPosition: {
        openingCash,
        closingCash: todaysBalance?.closingCash ? Number(todaysBalance.closingCash) : null,
        expectedCash,
        difference: todaysBalance?.closingCash
          ? Number(todaysBalance.closingCash) - expectedCash
          : null,
        notes: todaysBalance?.notes ?? "",
      },
      summary: {
        totalSales: Number(salesAgg._sum.totalAmount || 0),
        paidAmount: Number(salesAgg._sum.paidAmount || 0),
        dueAmount: Number(salesAgg._sum.dueAmount || 0),
        totalProfit: Number(salesAgg._sum.profit || 0),
        cashSales,
        cardSales,
        bkashSales,
        totalPurchases,
        totalExpenses,
        totalDuePaid,
        totalHawlatGiven,
        totalHawlatReceived,
      },
      transactions: transactions.map(t => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        description: t.description || "",
        mode: t.mode,
        createdAt: t.createdAt,
      })),
      isLocked: todaysBalance?.isLocked ?? false,
    };
  }

  async recordSale(storeId: string, userId: string, data: QuickSaleInput) {
    return saleService.create({
      items: [{
        productId: data.productId,
        quantity: data.quantity,
        price: data.price,
      }],
      customerId: undefined,
      totalAmount: data.totalAmount,
      paidAmount: data.paidAmount,
      dueAmount: data.totalAmount - data.paidAmount,
      paymentMethod: data.paymentMethod || "CASH",
      saleType: "REGULAR",
    }, storeId, userId);
  }

  async recordPurchase(storeId: string, userId: string, data: QuickPurchaseInput) {
    const input: TransactionCreateInput = {
      type: "PURCHASE",
      amount: data.amount,
      mode: (data.mode as any) || "CASH",
      supplierId: data.supplierId,
      description: data.description,
      productId: data.productId,
    };
    return transactionService.create(input, userId, storeId);
  }

  async recordExpense(storeId: string, userId: string, data: QuickExpenseInput) {
    const input: TransactionCreateInput = {
      type: "EXPENSE",
      amount: data.amount,
      mode: (data.mode as any) || "CASH",
      description: data.description || data.category,
    };
    return transactionService.create(input, userId, storeId);
  }

  async recordHawlat(storeId: string, userId: string, data: QuickHawlatInput) {
    return loanService.create({
      personName: data.personName,
      type: data.type,
      amount: data.amount,
      mode: (data.mode as any) || "CASH",
      description: data.description,
    }, storeId, userId);
  }

  async recordAdvance(storeId: string, userId: string, data: QuickAdvanceInput) {
    return saleService.create({
      items: [],
      customerId: data.customerId,
      totalAmount: data.amount,
      paidAmount: data.amount,
      dueAmount: 0,
      paymentMethod: data.paymentMethod || "CASH",
      saleType: "ADVANCE_ORDER",
      deliveryDate: data.deliveryDate || null,
    }, storeId, userId);
  }

  async recordDueCollection(storeId: string, userId: string, data: DueCollectionInput) {
    return saleService.collectPayment(
      data.saleId,
      data.amount,
      data.method || "CASH",
      userId,
      storeId
    );
  }

  async saveClosing(storeId: string, dateStr: string, closingCash: number, notes?: string) {
    const dayStart = new Date(dateStr + "T00:00:00.000Z");
    const dayEnd = new Date(dateStr + "T23:59:59.999Z");

    const prevDate = new Date(dayStart.getTime() - 86400000);

    const [prevBalance, todaysSheet] = await Promise.all([
      prisma.dailyBalance.findUnique({
        where: { storeId_date: { storeId, date: prevDate } }
      }),
      this.getSheet(storeId, dateStr),
    ]);

    const openingCash = prevBalance?.closingCash ? Number(prevBalance.closingCash) : 0;
    const expectedCash = todaysSheet.cashPosition.expectedCash;

    return prisma.dailyBalance.upsert({
      where: { storeId_date: { storeId, date: dayStart } },
      create: {
        storeId,
        date: dayStart,
        openingCash,
        closingCash,
        expectedCash,
        notes: notes || "",
        isLocked: true,
        lockedAt: new Date(),
      },
      update: {
        closingCash,
        notes: notes || "",
        expectedCash,
        isLocked: true,
        lockedAt: new Date(),
      },
    });
  }

  async exportExcel(storeId: string, dateStr: string): Promise<Buffer> {
    const sheet = await this.getSheet(storeId, dateStr);

    const wb = XLSX.utils.book_new();

    const summaryRows = [
      { Metric: "Date", Value: dateStr },
      { Metric: "Opening Cash", Value: sheet.cashPosition.openingCash },
      { Metric: "Cash Sales", Value: sheet.summary.cashSales },
      { Metric: "Card Sales", Value: sheet.summary.cardSales },
      { Metric: "bKash/ Nagad Sales", Value: sheet.summary.bkashSales },
      { Metric: "Total Sales", Value: sheet.summary.totalSales },
      { Metric: "Total Profit", Value: sheet.summary.totalProfit },
      { Metric: "Purchases", Value: sheet.summary.totalPurchases },
      { Metric: "Expenses", Value: sheet.summary.totalExpenses },
      { Metric: "Due Collected", Value: sheet.summary.totalDuePaid },
      { Metric: "Hawlat Given", Value: sheet.summary.totalHawlatGiven },
      { Metric: "Hawlat Received", Value: sheet.summary.totalHawlatReceived },
      { Metric: "Expected Cash", Value: sheet.cashPosition.expectedCash },
      { Metric: "Actual Closing", Value: sheet.cashPosition.closingCash ?? "N/A" },
      { Metric: "Difference", Value: sheet.cashPosition.difference ?? "N/A" },
    ];
    const ws1 = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, ws1, "Daily Summary");

    const txRows = sheet.transactions.map(t => ({
      Time: new Date(t.createdAt).toLocaleTimeString(),
      Type: t.type,
      Description: t.description,
      Mode: t.mode,
      Amount: t.amount,
    }));
    const ws2 = XLSX.utils.json_to_sheet(txRows);
    XLSX.utils.book_append_sheet(wb, ws2, "Transactions");

    return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  }

  async exportAllTransactions(storeId: string): Promise<Buffer> {
    const [sales, transactions, loans, payments] = await Promise.all([
      prisma.sale.findMany({
        where: { storeId },
        include: {
          customer: { select: { name: true, phone: true } },
          items: { include: { product: { select: { name: true, model: true } } } },
          payments: { select: { method: true, amount: true, date: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.transaction.findMany({
        where: { storeId },
        include: { supplier: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.loan.findMany({
        where: { storeId },
        orderBy: { date: "desc" },
      }),
      prisma.payment.findMany({
        where: { storeId },
        include: { sale: { select: { invoiceId: true } } },
        orderBy: { date: "desc" },
      }),
    ]);

    const rows: any[] = [];

    for (const sale of sales) {
      const itemsStr = sale.items
        .map(i => `${i.product?.name || "Unknown"} ${i.product?.model ? `(${i.product.model})` : ""}×${i.quantity}`)
        .join(", ");
      rows.push({
        Date: sale.createdAt,
        Type: "SALE",
        Description: sale.invoiceId,
        Party: sale.customer?.name || sale.customerName || "Walking",
        Phone: sale.customer?.phone || "",
        Items: itemsStr,
        Amount: Number(sale.totalAmount),
        Paid: Number(sale.paidAmount),
        Due: Number(sale.dueAmount),
        Discount: Number(sale.discount),
        Profit: Number(sale.profit),
        Method: sale.payments?.[0]?.method || "",
        Status: sale.status,
        Reference: sale.invoiceId,
      });
    }

    for (const tx of transactions) {
      rows.push({
        Date: tx.createdAt,
        Type: tx.type,
        Description: tx.description || tx.type,
        Party: tx.supplier?.name || "",
        Phone: "",
        Items: "",
        Amount: Number(tx.amount),
        Paid: "",
        Due: "",
        Discount: "",
        Profit: "",
        Method: tx.mode,
        Status: tx.status || "COMPLETED",
        Reference: tx.referenceId || "",
      });
    }

    for (const loan of loans) {
      rows.push({
        Date: loan.date,
        Type: loan.type === "GIVE" ? "HAWLAT_GIVEN" : "HAWLAT_RECEIVED",
        Description: loan.type === "GIVE" ? "Loan given" : "Loan taken",
        Party: loan.borrower,
        Phone: "",
        Items: "",
        Amount: Number(loan.amount),
        Paid: Number(loan.paid),
        Due: Number(loan.remaining),
        Discount: "",
        Profit: "",
        Method: "",
        Status: Number(loan.remaining) > 0 ? "ACTIVE" : "SETTLED",
        Reference: loan.id,
      });
    }

    for (const pmt of payments) {
      rows.push({
        Date: pmt.date,
        Type: "PAYMENT",
        Description: pmt.sale?.invoiceId || "",
        Party: "",
        Phone: "",
        Items: "",
        Amount: Number(pmt.amount),
        Paid: "",
        Due: "",
        Discount: "",
        Profit: "",
        Method: pmt.method,
        Status: "COMPLETED",
        Reference: pmt.saleId,
      });
    }

    rows.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    const colWidths = [
      { wch: 12 }, { wch: 16 }, { wch: 30 }, { wch: 22 },
      { wch: 14 }, { wch: 40 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 20 },
    ];
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "All Transactions");
    return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  }

  async exportDailySheetDetailed(storeId: string, dateStr: string): Promise<Buffer> {
    const dayStart = new Date(dateStr + "T00:00:00");
    const dayEnd = new Date(dateStr + "T23:59:59");

    const [sales, transactions, loans, payments] = await Promise.all([
      prisma.sale.findMany({
        where: { storeId, createdAt: { gte: dayStart, lte: dayEnd } },
        include: {
          customer: { select: { name: true, phone: true } },
          items: { include: { product: { select: { name: true, model: true } } } },
          payments: { select: { method: true, amount: true } },
        },
      }),
      prisma.transaction.findMany({
        where: { storeId, createdAt: { gte: dayStart, lte: dayEnd } },
        include: { supplier: { select: { name: true } } },
      }),
      prisma.loan.findMany({
        where: { storeId, date: { gte: dayStart, lte: dayEnd } },
      }),
      prisma.payment.findMany({
        where: { storeId, date: { gte: dayStart, lte: dayEnd } },
        include: { sale: { select: { invoiceId: true } } },
      }),
    ]);

    const rows: any[] = [];

    for (const sale of sales) {
      const itemsStr = sale.items
        .map(i => `${i.product?.name || "Unknown"}×${i.quantity}`)
        .join(", ");
      rows.push({
        "Date": new Date(sale.createdAt).toLocaleDateString(),
        "Type": "SALE",
        "Invoice": sale.invoiceId,
        "Customer": sale.customer?.name || sale.customerName || "Walking",
        "Phone": sale.customer?.phone || "",
        "Supplier": "",
        "Borrower": "",
        "Category": "",
        "Items": itemsStr,
        "Amount": Number(sale.totalAmount),
        "Paid": Number(sale.paidAmount),
        "Due": Number(sale.dueAmount),
        "Discount": Number(sale.discount),
        "Profit": Number(sale.profit),
        "Method": sale.payments?.[0]?.method || "",
        "Status": sale.status,
        "Description": "",
      });
    }

    for (const tx of transactions) {
      const isSaleType = tx.type === "DUE_PAYMENT";
      rows.push({
        "Date": new Date(tx.createdAt).toLocaleDateString(),
        "Type": tx.type,
        "Invoice": isSaleType ? tx.referenceId || "" : "",
        "Customer": "",
        "Phone": "",
        "Supplier": tx.supplier?.name || "",
        "Borrower": "",
        "Category": tx.type === "EXPENSE" ? tx.description || "" : "",
        "Items": "",
        "Amount": Number(tx.amount),
        "Paid": "",
        "Due": "",
        "Discount": "",
        "Profit": "",
        "Method": tx.mode,
        "Status": tx.status || "COMPLETED",
        "Description": tx.description || "",
      });
    }

    for (const loan of loans) {
      rows.push({
        "Date": new Date(loan.date).toLocaleDateString(),
        "Type": loan.type === "GIVE" ? "HAWLAT_GIVEN" : "HAWLAT_RECEIVED",
        "Invoice": "",
        "Customer": "",
        "Phone": "",
        "Supplier": "",
        "Borrower": loan.borrower,
        "Category": "",
        "Items": "",
        "Amount": Number(loan.amount),
        "Paid": Number(loan.paid),
        "Due": Number(loan.remaining),
        "Discount": "",
        "Profit": "",
        "Method": "",
        "Status": Number(loan.remaining) > 0 ? "ACTIVE" : "SETTLED",
        "Description": "",
      });
    }

    for (const pmt of payments) {
      rows.push({
        "Date": new Date(pmt.date).toLocaleDateString(),
        "Type": "PAYMENT",
        "Invoice": pmt.sale?.invoiceId || "",
        "Customer": "",
        "Phone": "",
        "Supplier": "",
        "Borrower": "",
        "Category": "",
        "Items": "",
        "Amount": Number(pmt.amount),
        "Paid": "",
        "Due": "",
        "Discount": "",
        "Profit": "",
        "Method": pmt.method,
        "Status": "COMPLETED",
        "Description": "",
      });
    }

    rows.sort((a, b) => {
      const dateA = a["Date"] || "";
      const dateB = b["Date"] || "";
      if (dateA > dateB) return -1;
      if (dateA < dateB) return 1;
      return 0;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 20 },
      { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 14 },
      { wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Detailed Daily Report");
    return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  }
}

export const dailyActivityService = new DailyActivityService();
