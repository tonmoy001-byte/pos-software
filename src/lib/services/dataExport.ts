import { prisma } from "@/lib/prisma";

interface ExportManifest {
  version: string;
  exportedAt: string;
  storeIds: string[];
  recordCounts: Record<string, number>;
}

export async function exportAllData(storeIds?: string[]): Promise<ExportManifest> {
  const tables = [
    "store", "user", "product", "customer", "sale", "saleItem", "payment",
    "supplier", "supplierProduct", "expense", "loan", "transaction",
    "secondHandRecord", "dailyBalance", "event", "stockMovement",
    "account", "journalEntry", "journalLine", "idempotencyKey",
    "invoiceSettings", "barcodeSettings",
  ] as const;

  const recordCounts: Record<string, number> = {};
  const manifest: ExportManifest = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    storeIds: storeIds || [],
    recordCounts,
  };

  const output: Record<string, any[]> = {};
  const allTables = [...tables] as string[];

  for (const table of allTables) {
    const rows = await (prisma as any)[table].findMany();
    const filtered = storeIds?.length
      ? rows.filter((r: any) => !r.storeId || storeIds.includes(r.storeId))
      : rows;
    output[table] = filtered;
    recordCounts[table] = filtered.length;
  }

  return manifest;
}

export function generateMigrationScript(data: Record<string, any[]>): string {
  let sql = "-- POS System PostgreSQL Migration\n";
  sql += "-- Generated: " + new Date().toISOString() + "\n\n";
  sql += "BEGIN;\n\n";

  for (const [table, rows] of Object.entries(data)) {
    if (rows.length === 0) continue;
    for (const row of rows) {
      const columns = Object.keys(row);
      const values = columns.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return "NULL";
        if (typeof val === "string") return `'${val.replace(/'/g, "''")}'`;
        if (typeof val === "boolean") return val ? "true" : "false";
        if (val instanceof Date) return `'${val.toISOString()}'`;
        return String(val);
      });

      sql += `INSERT INTO "${table}" ("${columns.join('", "')}") VALUES (${values.join(", ")});\n`;
    }
    sql += "\n";
  }

  sql += "COMMIT;\n";
  return sql;
}
