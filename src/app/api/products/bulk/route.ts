export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { generateBarcode } from "@/lib/barcode";
import { hasPermission, eventStore, EventStoreData, logger } from "@/lib/services";
import type { Role } from "@prisma/client";
import * as XLSX from "xlsx";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "product:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
      const seenBarcodes = new Set<string>();

      // Pre-check: validate all barcodes in the file
      const barcodesInFile = data.map(row => row.Barcode).filter(Boolean);
      const duplicateBarcodes = barcodesInFile.filter((bc, i) => barcodesInFile.indexOf(bc) !== i);
      if (duplicateBarcodes.length > 0) {
        throw new Error(`Duplicate barcodes in file: ${[...new Set(duplicateBarcodes)].join(", ")}`);
      }

      // Check against existing barcodes
      if (barcodesInFile.length > 0) {
        const existing = await tx.product.findMany({
          where: { barcode: { in: barcodesInFile }, storeId: session.user.storeId },
          select: { barcode: true },
        });
        if (existing.length > 0) {
          throw new Error(`Barcodes already exist: ${existing.map(p => p.barcode).join(", ")}`);
        }
      }

      for (const row of data) {
        const { Name, Brand, Category, Price, Cost, Stock, MinStock, Barcode } = row;

        if (!Name || !Price) {
          logger.warn("Skipping row with missing Name or Price", { row });
          continue;
        }
        
        const productBarcode = Barcode || generateBarcode();
        if (seenBarcodes.has(productBarcode)) {
          throw new Error(`Duplicate barcode detected: ${productBarcode}`);
        }
        seenBarcodes.add(productBarcode);

        const price = Number(Price);
        const cost = Cost ? Number(Cost) : undefined;
        if (isNaN(price) || price <= 0) {
          throw new Error(`Invalid price for product: ${Name}`);
        }
        if (cost !== undefined && (isNaN(cost) || cost < 0)) {
          throw new Error(`Invalid cost for product: ${Name}`);
        }

        const productData: any = {
          name: Name,
          brand: Brand || "Generic",
          model: Name,
          category: Category || "Mobile",
          price,
          stock: Number(Stock || 0),
          minStock: Number(MinStock || 5),
          barcode: productBarcode,
          storeId: session.user.storeId,
        };
        if (cost !== undefined) productData.cost = cost;

        const product = await tx.product.create({
          data: productData
        });

        await eventStore.append({
          aggregateType: "Product",
          aggregateId: product.id,
          type: "CREATED",
          payload: {
            name: product.name,
            brand: product.brand,
            price: product.price,
            cost: product.cost,
            stock: product.stock,
            bulkImport: true,
          },
          userId: session.user.id,
          storeId: session.user.storeId,
        }, tx);

        createdProducts.push(product);
      }
      return createdProducts;
    });

    return NextResponse.json({ message: `Imported ${results.length} products`, count: results.length });
  } catch (error: any) {
    logger.error("Bulk import failed", { storeId: session?.user?.storeId, userId: session?.user?.id, error: error.message });
    return NextResponse.json({ error: "Import failed. Check format: Name, Brand, Category, Price, Cost, Stock, MinStock" }, { status: 500 });
  }
}