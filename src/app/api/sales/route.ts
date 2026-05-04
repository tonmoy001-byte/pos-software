export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SaleService } from "@/lib/services";
import { generateInvoiceNumber } from "@/lib/server/invoice";

const saleService = new SaleService();

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get("storeId") || session.user.storeId;
    const sales = await saleService.findAll(storeId);
    
    const formattedSales = sales.map((sale: any) => ({
      id: sale.id,
      invoiceId: sale.invoiceId,
      saleType: sale.saleType || "REGULAR",
      customerName: sale.customer?.name || null,
      customerPhone: sale.customer?.phone || null,
      items: sale.items.map((item: any) => ({
        id: item.id,
        name: item.product?.name || "Unknown Product",
        quantity: item.quantity,
        price: item.price,
      })),
      totalAmount: Number(sale.totalAmount),
      paidAmount: Number(sale.paidAmount),
      dueAmount: Number(sale.dueAmount),
      discount: Number(sale.discount) || 0,
      paymentMethod: sale.payments?.[0]?.method || "CASH",
      status: sale.status,
      createdAt: sale.createdAt?.toISOString(),
    }));

    return NextResponse.json(formattedSales);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch sales" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = await req.json();
    const { items, customerId, totalAmount, paidAmount, dueAmount, paymentMethod, discount, saleType, deliveryDate } = data;

    // Calculate dueAmount properly for advance orders
    const total = Number(totalAmount) || 0;
    const paid = Number(paidAmount) || 0;
    const calculatedDue = total - paid;

    // Fetch customer info to store snapshot for advance orders
    let customerName = "Walking Customer";
    if (customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (customer) {
        customerName = customer.name;
      }
    }

    // Fetch product costs for profit calculation
    const productIds = items.map((i: any) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, cost: true }
    });

    const itemsWithCosts = items.map((item: any) => {
      const product = products.find(p => p.id === item.productId);
      return {
        ...item,
        cost: product ? Number(product.cost) : 0
      };
    });

    const sale = await saleService.create({
      items: itemsWithCosts,
      customerId,
      customerName,
      totalAmount: total,
      paidAmount: paid,
      dueAmount: calculatedDue,
      paymentMethod: paymentMethod || "CASH",
      discount: Number(discount || 0),
      saleType: saleType || "REGULAR",
      deliveryDate: deliveryDate || null
    }, session.user.storeId, session.user.id);

    return NextResponse.json(sale);
  } catch (error: any) {
    console.error("Sale error:", error);
    return NextResponse.json({ error: error.message || "Failed to process sale" }, { status: 500 });
  }
}