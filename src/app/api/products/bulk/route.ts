export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { generateBarcode } from "@/lib/barcode";
import * as XLSX from "xlsx";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet) as any[];

    const results = await prisma.$transaction(async (tx) => {
      const createdProducts = [];
      for (const row of data) {
        const { Name, Brand, Category, Price, Cost, Stock, MinStock, Barcode } = row;
        
        const productBarcode = Barcode || generateBarcode();

        const product = await tx.product.create({
          data: {
            name: Name || "Unknown Product",
            brand: Brand || "Generic",
            model: Name || "Unknown Model",
            category: Category || "Mobile",
            price: Number(Price || 0),
            cost: Number(Cost || 0),
            stock: Number(Stock || 0),
            minStock: Number(MinStock || 5),
            barcode: productBarcode,
            storeId: session.user.storeId,
          }
        });

        createdProducts.push(product);
      }
      return createdProducts;
    });

    return NextResponse.json({ message: `Imported ${results.length} products`, count: results.length });
  } catch (error) {
    console.error("Bulk import failed:", error);
    return NextResponse.json({ error: "Import failed. Check format: Name, Brand, Category, Price, Cost, Stock, MinStock" }, { status: 500 });
  }
}