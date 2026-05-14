export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dailyActivityService } from "@/lib/services";
import { formatCurrency } from "@/lib/utils";

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderPrintHtml(sheet: any, date: string) {
  const summary = sheet.summary;
  const cashPos = sheet.cashPosition;

  const txRows = sheet.transactions.map((t: any) => `
    <tr>
      <td>${escapeHtml(new Date(t.createdAt).toLocaleTimeString())}</td>
      <td>${escapeHtml(t.type)}</td>
      <td>${escapeHtml(t.description || "")}</td>
      <td style="text-align:right">${formatCurrency(t.amount)}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Daily Sheet - ${escapeHtml(date)}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .date { color: #666; font-size: 13px; margin-bottom: 20px; }
  .section { margin-bottom: 20px; }
  .section h2 { font-size: 14px; border-bottom: 2px solid #333; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f5f5f5; text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; font-size: 11px; text-transform: uppercase; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .summary-item { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
  .summary-item .label { color: #555; }
  .summary-item .value { font-weight: bold; }
  .total-row td { font-weight: bold; border-top: 2px solid #333; }
  @media print { body { padding: 0; } }
</style></head><body>
  <h1>Daily Activity Sheet</h1>
  <div class="date">${date}</div>

  <div class="section">
    <h2>Cash Position</h2>
    <div class="summary-grid">
      <div class="summary-item"><span class="label">Opening Cash</span><span class="value">${formatCurrency(cashPos.openingCash)}</span></div>
      <div class="summary-item"><span class="label">Expected Cash</span><span class="value">${formatCurrency(cashPos.expectedCash)}</span></div>
      <div class="summary-item"><span class="label">Actual Closing</span><span class="value">${cashPos.closingCash !== null ? formatCurrency(cashPos.closingCash) : "N/A"}</span></div>
      <div class="summary-item"><span class="label">Difference</span><span class="value">${cashPos.difference !== null ? formatCurrency(cashPos.difference) : "N/A"}</span></div>
    </div>
  </div>

  <div class="section">
    <h2>Financial Summary</h2>
    <div class="summary-grid">
      <div class="summary-item"><span class="label">Total Sales</span><span class="value">${formatCurrency(summary.totalSales)}</span></div>
      <div class="summary-item"><span class="label">Cash Sales</span><span class="value">${formatCurrency(summary.cashSales)}</span></div>
      <div class="summary-item"><span class="label">Card Sales</span><span class="value">${formatCurrency(summary.cardSales)}</span></div>
      <div class="summary-item"><span class="label">Total Purchases</span><span class="value">${formatCurrency(summary.totalPurchases)}</span></div>
      <div class="summary-item"><span class="label">Expenses</span><span class="value">${formatCurrency(summary.totalExpenses)}</span></div>
      <div class="summary-item"><span class="label">Due Collected</span><span class="value">${formatCurrency(summary.totalDuePaid)}</span></div>
    </div>
  </div>

  <div class="section">
    <h2>All Transactions (${sheet.transactions.length})</h2>
    <table>
      <thead><tr><th>Time</th><th>Type</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${txRows || "<tr><td colspan='4' style='text-align:center;color:#999'>No transactions</td></tr>"}</tbody>
    </table>
  </div>
</body></html>`;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const format = searchParams.get("format") || "xlsx";

  const storeId = session.user.storeId;

  try {
    if (format === "xlsx") {
      const buffer = await dailyActivityService.exportExcel(storeId, date);
      const uint8 = new Uint8Array(buffer);
      return new NextResponse(uint8, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="daily-sheet-${date}.xlsx"`,
        },
      });
    }

    if (format === "detailed-xlsx") {
      const buffer = await dailyActivityService.exportDailySheetDetailed(storeId, date);
      const uint8 = new Uint8Array(buffer);
      return new NextResponse(uint8, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="daily-sheet-${date}-detailed.xlsx"`,
        },
      });
    }

    const sheet = await dailyActivityService.getSheet(storeId, date);
    const html = renderPrintHtml(sheet, date);
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
