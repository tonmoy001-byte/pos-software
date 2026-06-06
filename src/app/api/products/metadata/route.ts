export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/services";
import type { Role } from "@prisma/client";

const DEFAULT_CATEGORIES = [
  "SMARTPHONE", "TABLET", "ACCESSORIES", "PARTS", "EARBUDS", "GADGET", "CHARGER", "CABLE", "COVER", "BATTERY"
];
const DEFAULT_BRANDS = ["Apple", "Samsung", "Xiaomi", "Oppo", "Vivo", "Realme", "OnePlus", "Huawei", "Nokia", "Google", "Generic"];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "product:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [suppliers, branchCount] = await Promise.all([
    prisma.supplier.findMany({
      where: { storeId: session.user.storeId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.branch.count({ where: { storeId: session.user.storeId } }),
  ]);

  const warehouses = branchCount > 0
    ? (await prisma.branch.findMany({
        where: { storeId: session.user.storeId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })).map(b => ({ value: b.id, label: b.name }))
    : [{ value: "MAIN", label: "Main Store" }];

  return NextResponse.json({
    categories: DEFAULT_CATEGORIES,
    brands: DEFAULT_BRANDS,
    suppliers: suppliers.map(s => ({ value: s.id, label: s.name })),
    warehouses,
    units: [
      { value: "PIECE", label: "Piece" },
      { value: "BOX", label: "Box" },
      { value: "PACK", label: "Pack" },
      { value: "SET", label: "Set" },
    ],
    productTypes: [
      { value: "SERIALIZED", label: "Serialized Product" },
      { value: "NON_SERIALIZED", label: "Non-Serialized Product" },
      { value: "SERVICE", label: "Service" },
    ],
    conditions: [
      { value: "NEW", label: "New" },
      { value: "USED", label: "Used" },
      { value: "REFURBISHED", label: "Refurbished" },
    ],
    ramOptions: ["2GB", "3GB", "4GB", "6GB", "8GB", "12GB", "16GB"],
    storageOptions: ["16GB", "32GB", "64GB", "128GB", "256GB", "512GB", "1TB"],
    networkOptions: ["3G", "4G", "5G"],
    statuses: [
      { value: "ACTIVE", label: "Active" },
      { value: "INACTIVE", label: "Inactive" },
      { value: "DRAFT", label: "Draft" },
    ],
  });
}
