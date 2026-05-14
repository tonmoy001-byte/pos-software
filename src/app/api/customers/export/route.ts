export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const customers = await prisma.customer.findMany({
      where: { storeId: session.user.storeId },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { sales: true } },
      }
    });

    const rows = customers.map(c => ({
      Name: c.name,
      Phone: c.phone,
      Address: c.address || "",
      "Due Amount": Number(c.dueAmount),
      "Total Purchases": c._count.sales,
      "Created": new Date(c.createdAt).toLocaleDateString(),
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 25 }, { wch: 18 }, { wch: 30 },
      { wch: 14 }, { wch: 18 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Customers");

    const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
    const uint8 = new Uint8Array(buffer);
    return new NextResponse(uint8, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="customers-export.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Customer export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
