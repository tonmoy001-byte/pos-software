export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateInvoiceNumber } from "@/lib/server/invoice";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get("storeId") || session.user.storeId;

    const sales = await prisma.sale.findMany({
      where: {
        storeId: storeId,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                model: true,
              },
            },
          },
        },
        payments: {
          select: {
            method: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

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
    console.error("Fetch sales error:", error);
    return NextResponse.json({ error: "Failed to fetch sales" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await req.json();
    const { items, customerId, totalAmount, paidAmount, dueAmount, paymentMethod } = data;

    const invoiceId = await generateInvoiceNumber(session.user.storeId);

    const sale = await prisma.$transaction(async (tx) => {
      const saleItemsData = items.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
      }));

      const saleRecord = await tx.sale.create({
        data: {
          invoiceId,
          totalAmount: parseFloat(totalAmount),
          paidAmount: parseFloat(paidAmount),
          dueAmount: parseFloat(dueAmount),
          status: dueAmount > 0 ? (paidAmount > 0 ? "PARTIAL" : "DUE") : "PAID",
          customerId: customerId || null,
          storeId: session.user.storeId,
          items: {
            create: saleItemsData,
          },
          payments: paidAmount > 0
            ? {
                create: {
                  amount: parseFloat(paidAmount),
                  method: paymentMethod || "CASH",
                  storeId: session.user.storeId,
                },
              }
            : undefined,
        },
        include: { 
          items: true
        },
      });

      // Update customer due amount if customerId exists and there's due
      if (customerId && dueAmount > 0) {
        const customer = await tx.customer.findUnique({
          where: { id: customerId }
        });
        if (customer) {
          await tx.customer.update({
            where: { id: customerId },
            data: {
              dueAmount: (Number(customer.dueAmount) || 0) + parseFloat(dueAmount)
            }
          });
        }
      }

      for (const item of items) {
        if (item.imeis && item.imeis.length > 0) {
          const saleItem = saleRecord.items.find((si: any) => si.productId === item.productId);
          if (saleItem) {
            await tx.serializedItem.updateMany({
              where: { imei: { in: item.imeis } },
              data: { 
                status: "SOLD",
                saleItemId: saleItem.id,
              },
            });
          }
        }
      }

      return saleRecord;
    });

    const updatedSale = await prisma.sale.findUnique({
      where: { id: sale.id },
      include: { 
        items: {
          include: {
            product: true,
            imeis: true
          }
        },
        customer: true,
        payments: true,
        store: true
      },
    });

    return NextResponse.json(updatedSale);
  } catch (error) {
    console.error("Sale error:", error);
    return NextResponse.json({ error: "Failed to process sale" }, { status: 500 });
  }
}