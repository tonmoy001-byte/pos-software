# EMI Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full EMI installment tracking with schedule generation, per-installment collection, early payoff, and overview dashboard under a unified `/emi` page.

**Architecture:** Add `EMISchedule` model to track per-installment due dates and status. Extend `Sale` model with EMI config fields. Update `SaleService` to generate schedules on creation and handle installment payments. Create unified `/emi` page with 3 tabs: New Sale, Collect Installments, Overview.

**Tech Stack:** Next.js 16 (App Router), React 19, Prisma 7.8, PostgreSQL, Tailwind CSS 4, NextAuth v4

---

## File Structure

### New Files
| File | Responsibility |
|------|----------------|
| `src/components/emi/EmiSaleTab.tsx` | Tab 1: EMI sale creation with checkout modal |
| `src/components/emi/EmiCollectTab.tsx` | Tab 2: Installment collection with search + payment modal |
| `src/components/emi/EmiOverviewTab.tsx` | Tab 3: Dashboard summary + EMI sales list |
| `src/components/emi/InstallmentPaymentModal.tsx` | Modal for paying installments (pay next / pay all) |
| `src/components/emi/EmiReceiptModal.tsx` | EMI-specific receipt with installment schedule |
| `src/app/api/emi-sales/route.ts` | GET list EMI sales with summary data |
| `src/app/api/emi-sales/[id]/route.ts` | GET single EMI sale + installment schedule |
| `src/app/api/emi/summary/route.ts` | GET dashboard summary stats |

### Modified Files
| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add EMI fields to Sale, add EMISchedule model |
| `src/app/api/sales/route.ts` | Accept and validate emiMonths, interestRate, downPayment |
| `src/app/api/sales/[id]/emi/route.ts` | Add installment-specific payment, early payoff |
| `src/lib/services/sale.ts` | Handle EMI schedule generation, installment payments |
| `src/components/layout/sidebar.tsx` | Move EMI to top-level |
| `src/app/sales/emi/page.tsx` | Replace with redirect to `/emi` |
| `src/app/emi/page.tsx` | New unified EMI page |
| `src/components/invoice/ReceiptModal.tsx` | Add EMI-specific receipt layout |

---

## Task 1: Database Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add EMISchedule model and Sale field additions to schema.prisma**

Add after the `Sale` model's closing brace (around line 240):

```prisma
model EMISchedule {
  id            String   @id @default(cuid())
  saleId        String
  installmentNo Int
  dueDate       DateTime
  amount        Decimal  @db.Decimal(10, 2)
  status        String   @default("PENDING")
  paidDate      DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  sale Sale @relation(fields: [saleId], references: [id], onDelete: Cascade)

  @@index([saleId])
  @@index([status])
  @@index([dueDate])
}
```

Add these fields to the `Sale` model (before the closing brace):

```prisma
  emiMonths       Int?
  interestRate    Decimal?   @db.Decimal(5, 2)
  downPayment     Decimal?   @db.Decimal(10, 2)
  monthlyAmount   Decimal?   @db.Decimal(10, 2)
```

Add this relation to the `Sale` model:

```prisma
  emiSchedules EMISchedule[]
```

- [ ] **Step 2: Run prisma db push**

Run: `npx prisma db push`
Expected: `The database is now in sync with your Prisma schema.`

- [ ] **Step 3: Generate Prisma client**

Run: `npx prisma generate`
Expected: `Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(emi): add EMISchedule model and Sale EMI fields"
```

---

## Task 2: Update SaleService — EMI Schedule Generation

**Files:**
- Modify: `src/lib/services/sale.ts`

- [ ] **Step 1: Add EMI schedule generation method**

Add after the `collectPayment` method (around line 500):

```typescript
async generateEmiSchedule(saleId: string, emiMonths: number, totalAmount: number, downPayment: number, saleDate: Date): Promise<void> {
  const scheduleData: Array<{
    saleId: string;
    installmentNo: number;
    dueDate: Date;
    amount: any;
    status: string;
  }> = [];

  // Installment 1 = down payment, due on sale date
  scheduleData.push({
    saleId,
    installmentNo: 1,
    dueDate: saleDate,
    amount: downPayment,
    status: "PAID",
  });

  // Remaining installments
  const remaining = totalAmount - downPayment;
  const monthlyAmount = remaining / (emiMonths - 1);

  for (let i = 2; i <= emiMonths; i++) {
    const dueDate = new Date(saleDate);
    dueDate.setMonth(dueDate.getMonth() + (i - 1));

    scheduleData.push({
      saleId,
      installmentNo: i,
      dueDate,
      amount: monthlyAmount,
      status: "PENDING",
    });
  }

  await this.prisma.eMISchedule.createMany({ data: scheduleData });
}
```

- [ ] **Step 2: Update create() method to handle EMI fields**

In the `create()` method, find where the Sale record is created (around line 100). Add EMI fields to the create call:

```typescript
const sale = await this.prisma.sale.create({
  data: {
    // ... existing fields ...
    emiMonths: data.emiMonths || null,
    interestRate: data.interestRate || null,
    downPayment: data.downPayment || null,
    monthlyAmount: data.monthlyAmount || null,
  },
});
```

After the sale is created and if `saleType === "EMI"`, call the schedule generator:

```typescript
if (sale.saleType === "EMI" && data.emiMonths && data.downPayment !== undefined) {
  await this.generateEmiSchedule(
    sale.id,
    data.emiMonths,
    Number(data.totalAmount),
    Number(data.downPayment),
    sale.createdAt
  );
}
```

- [ ] **Step 3: Add installment payment method**

Add after the `generateEmiSchedule` method:

```typescript
async payInstallment(saleId: string, installmentNo: number, amount: number, method: string): Promise<{ sale: any; installment: any }> {
  // Find the installment
  const installment = await this.prisma.eMISchedule.findFirst({
    where: { saleId, installmentNo, status: "PENDING" },
  });

  if (!installment) {
    throw new Error(`Installment #${installmentNo} not found or already paid`);
  }

  // Mark installment as paid
  const updatedInstallment = await this.prisma.eMISchedule.update({
    where: { id: installment.id },
    data: {
      status: "PAID",
      paidDate: new Date(),
    },
  });

  // Update sale paid amount
  const sale = await this.prisma.sale.update({
    where: { id: saleId },
    data: {
      paidAmount: { increment: amount },
      dueAmount: { decrement: amount },
    },
  });

  // Check if all installments are paid
  const pendingCount = await this.prisma.eMISchedule.count({
    where: { saleId, status: "PENDING" },
  });

  if (pendingCount === 0) {
    await this.prisma.sale.update({
      where: { id: saleId },
      data: { status: "PAID" },
    });
  }

  // Create payment record
  await this.prisma.payment.create({
    data: {
      saleId,
      amount,
      method,
      type: "EMI_INSTALLMENT",
    },
  });

  return { sale, installment: updatedInstallment };
}
```

- [ ] **Step 4: Add early payoff method**

Add after `payInstallment`:

```typescript
async payAllInstallments(saleId: string, method: string): Promise<{ sale: any; paidCount: number }> {
  // Find all pending installments
  const pendingInstallments = await this.prisma.eMISchedule.findMany({
    where: { saleId, status: "PENDING" },
    orderBy: { installmentNo: "asc" },
  });

  if (pendingInstallments.length === 0) {
    throw new Error("No pending installments found");
  }

  const totalRemaining = pendingInstallments.reduce(
    (sum, inst) => sum + Number(inst.amount),
    0
  );

  // Mark all as paid
  await this.prisma.eMISchedule.updateMany({
    where: { saleId, status: "PENDING" },
    data: {
      status: "PAID",
      paidDate: new Date(),
    },
  });

  // Update sale
  const sale = await this.prisma.sale.update({
    where: { id: saleId },
    data: {
      paidAmount: { increment: totalRemaining },
      dueAmount: 0,
      status: "PAID",
    },
  });

  // Create payment record
  await this.prisma.payment.create({
    data: {
      saleId,
      amount: totalRemaining,
      method,
      type: "EMI_PAYOFF",
    },
  });

  return { sale, paidCount: pendingInstallments.length };
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/sale.ts
git commit -m "feat(emi): add schedule generation and installment payment methods"
```

---

## Task 3: Update Sale Creation API

**Files:**
- Modify: `src/app/api/sales/route.ts`

- [ ] **Step 1: Add EMI fields to Zod schema**

Find the Zod validation schema (around line 25-40) and add EMI fields:

```typescript
const saleSchema = z.object({
  // ... existing fields ...
  emiMonths: z.number().int().min(3).max(12).optional(),
  interestRate: z.number().min(0).max(100).optional(),
  downPayment: z.number().min(0).optional(),
  monthlyAmount: z.number().min(0).optional(),
});
```

- [ ] **Step 2: Pass EMI fields to SaleService.create()**

Find where `SaleService.create()` is called and ensure EMI fields are passed:

```typescript
const sale = await saleService.create({
  // ... existing fields ...
  emiMonths: body.emiMonths,
  interestRate: body.interestRate,
  downPayment: body.downPayment,
  monthlyAmount: body.monthlyAmount,
});
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/sales/route.ts
git commit -m "feat(emi): accept EMI fields in sale creation API"
```

---

## Task 4: Update Installment Collection API

**Files:**
- Modify: `src/app/api/sales/[id]/emi/route.ts`

- [ ] **Step 1: Rewrite the EMI collection endpoint**

Replace the entire file content with:

```typescript
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { SaleService } from "@/lib/services/sale";

const saleService = new SaleService(prisma);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.storeId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { installmentNo, payAll, method = "CASH" } = body;

    // Verify sale exists and is EMI
    const sale = await prisma.sale.findFirst({
      where: { id, storeId: session.user.storeId as string, saleType: "EMI" },
    });

    if (!sale) {
      return NextResponse.json({ error: "EMI sale not found" }, { status: 404 });
    }

    if (sale.status === "PAID") {
      return NextResponse.json({ error: "This EMI sale is fully paid" }, { status: 400 });
    }

    let result;

    if (payAll) {
      // Early payoff — pay all remaining installments
      result = await saleService.payAllInstallments(id, method);
      return NextResponse.json({
        message: `Paid ${result.paidCount} installments. EMI fully settled.`,
        sale: result.sale,
        paidCount: result.paidCount,
        isEmiPaidOff: true,
      });
    } else {
      // Pay specific installment (sequential — next due only)
      if (!installmentNo) {
        return NextResponse.json(
          { error: "installmentNo is required" },
          { status: 400 }
        );
      }

      result = await saleService.payInstallment(id, installmentNo, sale.monthlyAmount || Number(sale.paidAmount), method);

      // Check if fully paid
      const pendingCount = await prisma.eMISchedule.count({
        where: { saleId: id, status: "PENDING" },
      });

      return NextResponse.json({
        installment: result.installment,
        sale: result.sale,
        remainingDue: Number(result.sale.dueAmount),
        status: result.sale.status,
        isEmiPaidOff: pendingCount === 0,
      });
    }
  } catch (error: any) {
    console.error("EMI payment error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process EMI payment" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/sales/\[id\]/emi/route.ts
git commit -m "feat(emi): rewrite installment collection with per-installment tracking"
```

---

## Task 5: Create EMI Sales List API

**Files:**
- Create: `src/app/api/emi-sales/route.ts`

- [ ] **Step 1: Create the EMI sales list endpoint**

```typescript
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.storeId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";

    const where: any = {
      storeId: session.user.storeId as string,
      saleType: "EMI",
    };

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
        { customer: { phone: { contains: search } } },
      ];
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        customer: { select: { name: true, phone: true } },
        emiSchedules: {
          orderBy: { installmentNo: "asc" },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Enrich with computed fields
    const enrichedSales = sales.map((sale) => {
      const schedules = sale.emiSchedules;
      const pendingInstallments = schedules.filter((s) => s.status === "PENDING");
      const overdueInstallments = pendingInstallments.filter(
        (s) => new Date(s.dueDate) < new Date()
      );
      const nextDue = pendingInstallments.sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      )[0];

      let computedStatus = "ACTIVE";
      if (sale.status === "PAID") {
        computedStatus = "COMPLETED";
      } else if (overdueInstallments.length > 0) {
        computedStatus = "OVERDUE";
      }

      return {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        customer: sale.customer,
        date: sale.createdAt,
        totalAmount: sale.totalAmount,
        paidAmount: sale.paidAmount,
        dueAmount: sale.dueAmount,
        emiMonths: sale.emiMonths,
        monthlyAmount: sale.monthlyAmount,
        status: computedStatus,
        nextDue: nextDue?.dueDate || null,
        nextDueAmount: nextDue?.amount || null,
        pendingCount: pendingInstallments.length,
        overdueCount: overdueInstallments.length,
      };
    });

    // Filter by computed status
    let filtered = enrichedSales;
    if (status) {
      filtered = enrichedSales.filter((s) => s.status === status.toUpperCase());
    }

    return NextResponse.json({ sales: filtered });
  } catch (error) {
    console.error("EMI sales list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch EMI sales" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/emi-sales/route.ts
git commit -m "feat(emi): add EMI sales list API with status enrichment"
```

---

## Task 6: Create EMI Single Sale API

**Files:**
- Create: `src/app/api/emi-sales/[id]/route.ts`

- [ ] **Step 1: Create the single EMI sale endpoint**

```typescript
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.storeId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const sale = await prisma.sale.findFirst({
      where: {
        id,
        storeId: session.user.storeId as string,
        saleType: "EMI",
      },
      include: {
        customer: true,
        emiSchedules: {
          orderBy: { installmentNo: "asc" },
        },
        payments: {
          orderBy: { createdAt: "desc" },
        },
        items: {
          include: { product: true },
        },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "EMI sale not found" }, { status: 404 });
    }

    return NextResponse.json({ sale });
  } catch (error) {
    console.error("EMI sale detail error:", error);
    return NextResponse.json(
      { error: "Failed to fetch EMI sale" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/emi-sales/\[id\]/route.ts
git commit -m "feat(emi): add single EMI sale detail API"
```

---

## Task 7: Create EMI Summary API

**Files:**
- Create: `src/app/api/emi/summary/route.ts`

- [ ] **Step 1: Create the EMI summary endpoint**

```typescript
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.storeId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const storeId = session.user.storeId as string;

    // Total active EMIs (sales with pending installments)
    const activeSales = await prisma.sale.findMany({
      where: {
        storeId,
        saleType: "EMI",
        status: { not: "PAID" },
      },
      include: {
        emiSchedules: {
          where: { status: "PENDING" },
        },
      },
    });

    const totalActive = activeSales.length;

    // Total outstanding
    const totalOutstanding = activeSales.reduce(
      (sum, sale) => sum + Number(sale.dueAmount),
      0
    );

    // Overdue count
    const now = new Date();
    let overdueCount = 0;
    for (const sale of activeSales) {
      const overdue = sale.emiSchedules.filter(
        (s) => new Date(s.dueDate) < now
      );
      overdueCount += overdue.length;
    }

    // Collected this month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const paymentsThisMonth = await prisma.payment.aggregate({
      where: {
        sale: { storeId, saleType: "EMI" },
        createdAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    });

    const collectedThisMonth = Number(paymentsThisMonth._sum.amount || 0);

    return NextResponse.json({
      totalActive,
      totalOutstanding,
      overdueCount,
      collectedThisMonth,
    });
  } catch (error) {
    console.error("EMI summary error:", error);
    return NextResponse.json(
      { error: "Failed to fetch EMI summary" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/emi/summary/route.ts
git commit -m "feat(emi): add EMI dashboard summary API"
```

---

## Task 8: Create InstallmentPaymentModal Component

**Files:**
- Create: `src/components/emi/InstallmentPaymentModal.tsx`

- [ ] **Step 1: Create the installment payment modal**

```tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface InstallmentPaymentModalProps {
  open: boolean;
  onClose: () => void;
  sale: any;
  nextInstallment: any;
  onPaymentComplete: (result: any) => void;
}

const paymentMethods = [
  { id: "CASH", label: "Cash", icon: Banknote },
  { id: "BKASH", label: "bKash", icon: Smartphone },
  { id: "NAGAD", label: "Nagad", icon: Smartphone },
  { id: "CARD", label: "Card", icon: CreditCard },
];

export function InstallmentPaymentModal({
  open,
  onClose,
  sale,
  nextInstallment,
  onPaymentComplete,
}: InstallmentPaymentModalProps) {
  const [method, setMethod] = useState("CASH");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!nextInstallment) return null;

  const isOverdue = new Date(nextInstallment.dueDate) < new Date();

  const handlePayInstallment = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/sales/${sale.id}/emi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installmentNo: nextInstallment.installmentNo,
          method,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onPaymentComplete(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePayAll = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/sales/${sale.id}/emi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payAll: true, method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onPaymentComplete(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const pendingCount = sale.emiSchedules?.filter(
    (s: any) => s.status === "PENDING"
  ).length || 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pay Installment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Installment Info */}
          <div className="bg-background rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-secondary">
                Installment #{nextInstallment.installmentNo} of {sale.emiMonths}
              </span>
              {isOverdue ? (
                <Badge className="bg-red-100 text-red-700">Overdue</Badge>
              ) : (
                <Badge className="bg-green-100 text-green-700">Due</Badge>
              )}
            </div>
            <div className="text-xs text-secondary mb-1">
              Due: {new Date(nextInstallment.dueDate).toLocaleDateString()}
            </div>
            <div className="text-2xl font-black text-foreground">
              {Number(nextInstallment.amount).toFixed(2)}
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2 block">
              Payment Method
            </label>
            <div className="grid grid-cols-4 gap-2">
              {paymentMethods.map((pm) => {
                const Icon = pm.icon;
                return (
                  <button
                    key={pm.id}
                    onClick={() => setMethod(pm.id)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                      method === pm.id
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-secondary hover:border-primary/50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px] font-bold">{pm.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-center gap-2 text-red-700 text-xs font-bold">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <Button
              onClick={handlePayInstallment}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Pay Installment — {Number(nextInstallment.amount).toFixed(2)}
                </>
              )}
            </Button>

            {pendingCount > 1 && (
              <Button
                onClick={handlePayAll}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                Pay All Remaining ({pendingCount} installments)
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/emi/InstallmentPaymentModal.tsx
git commit -m "feat(emi): add installment payment modal component"
```

---

## Task 9: Create EmiReceiptModal Component

**Files:**
- Create: `src/components/emi/EmiReceiptModal.tsx`

- [ ] **Step 1: Create the EMI receipt modal**

```tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui";
import { Printer } from "lucide-react";

interface EmiReceiptModalProps {
  open: boolean;
  onClose: () => void;
  sale: any;
}

export function EmiReceiptModal({ open, onClose, sale }: EmiReceiptModalProps) {
  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>EMI Receipt</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm" id="emi-receipt">
          {/* Store Header */}
          <div className="text-center border-b pb-4">
            <h2 className="text-lg font-black">{sale.storeName || "Store"}</h2>
            <p className="text-xs text-secondary">{sale.storePhone || ""}</p>
          </div>

          {/* Invoice Info */}
          <div className="border-b pb-3">
            <div className="flex justify-between">
              <span className="font-bold">Invoice:</span>
              <span>{sale.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Date:</span>
              <span>{new Date(sale.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Customer */}
          <div className="border-b pb-3">
            <div className="flex justify-between">
              <span className="font-bold">Customer:</span>
              <span>{sale.customer?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Phone:</span>
              <span>{sale.customer?.phone}</span>
            </div>
          </div>

          {/* Products */}
          <div className="border-b pb-3">
            <div className="grid grid-cols-3 font-bold text-xs text-secondary uppercase mb-2">
              <span>Product</span>
              <span className="text-center">Qty</span>
              <span className="text-right">Total</span>
            </div>
            {sale.items?.map((item: any, idx: number) => (
              <div key={idx} className="grid grid-cols-3 text-sm">
                <span>{item.product?.name}</span>
                <span className="text-center">{item.quantity}</span>
                <span className="text-right">{Number(item.total).toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-b pb-3 space-y-1">
            {sale.discount > 0 && (
              <div className="flex justify-between text-secondary">
                <span>Discount</span>
                <span>-{Number(sale.discount).toFixed(2)}</span>
              </div>
            )}
            {Number(sale.interestRate) > 0 && (
              <div className="flex justify-between text-secondary">
                <span>Interest ({sale.interestRate}%)</span>
                <span>
                  +{(
                    (Number(sale.totalAmount) - Number(sale.downPayment)) *
                    Number(sale.interestRate) /
                    100
                  ).toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between font-black text-lg">
              <span>Total</span>
              <span>{Number(sale.totalAmount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Down Payment</span>
              <span>{Number(sale.downPayment).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Monthly EMI</span>
              <span>{Number(sale.monthlyAmount).toFixed(2)}</span>
            </div>
          </div>

          {/* Installment Schedule */}
          <div className="border-b pb-3">
            <h3 className="font-black text-xs uppercase tracking-widest mb-2">
              Installment Schedule
            </h3>
            <div className="grid grid-cols-4 font-bold text-[10px] text-secondary uppercase mb-1">
              <span>#</span>
              <span>Due</span>
              <span>Amount</span>
              <span className="text-right">Status</span>
            </div>
            {sale.emiSchedules?.map((s: any) => (
              <div key={s.id} className="grid grid-cols-4 text-xs">
                <span>{s.installmentNo}</span>
                <span>{new Date(s.dueDate).toLocaleDateString()}</span>
                <span>{Number(s.amount).toFixed(2)}</span>
                <span
                  className={`text-right font-bold ${
                    s.status === "PAID"
                      ? "text-green-600"
                      : s.status === "OVERDUE"
                      ? "text-red-600"
                      : "text-yellow-600"
                  }`}
                >
                  {s.status}
                </span>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="font-bold">Total</span>
              <span>{Number(sale.totalAmount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Paid</span>
              <span>{Number(sale.paidAmount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Due</span>
              <span>{Number(sale.dueAmount).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <Button onClick={handlePrint} className="w-full mt-4">
          <Printer className="w-4 h-4 mr-2" />
          Print Receipt
        </Button>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/emi/EmiReceiptModal.tsx
git commit -m "feat(emi): add EMI receipt modal with installment schedule"
```

---

## Task 10: Create EmiOverviewTab Component

**Files:**
- Create: `src/components/emi/EmiOverviewTab.tsx`

- [ ] **Step 1: Create the EMI overview tab**

```tsx
"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Search,
  Eye,
} from "lucide-react";

interface EmiOverviewTabProps {
  onViewSale: (sale: any) => void;
}

export function EmiOverviewTab({ onViewSale }: EmiOverviewTabProps) {
  const [summary, setSummary] = useState({
    totalActive: 0,
    totalOutstanding: 0,
    overdueCount: 0,
    collectedThisMonth: 0,
  });
  const [sales, setSales] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [summaryRes, salesRes] = await Promise.all([
        fetch("/api/emi/summary"),
        fetch("/api/emi-sales"),
      ]);
      const summaryData = await summaryRes.json();
      const salesData = await salesRes.json();
      setSummary(summaryData);
      setSales(salesData.sales || []);
    } catch (error) {
      console.error("Failed to fetch EMI data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSales = sales.filter((sale) => {
    if (!filter) return true;
    const search = filter.toLowerCase();
    return (
      sale.invoiceNumber?.toLowerCase().includes(search) ||
      sale.customer?.name?.toLowerCase().includes(search) ||
      sale.customer?.phone?.includes(search)
    );
  });

  const statusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-700";
      case "OVERDUE":
        return "bg-red-100 text-red-700";
      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-bold text-secondary uppercase">Active EMIs</span>
          </div>
          <div className="text-2xl font-black">{summary.totalActive}</div>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-yellow-500" />
            <span className="text-xs font-bold text-secondary uppercase">Outstanding</span>
          </div>
          <div className="text-2xl font-black">{summary.totalOutstanding.toFixed(2)}</div>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-xs font-bold text-secondary uppercase">Overdue</span>
          </div>
          <div className="text-2xl font-black text-red-600">{summary.overdueCount}</div>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-green-500" />
            <span className="text-xs font-bold text-secondary uppercase">Collected (Month)</span>
          </div>
          <div className="text-2xl font-black">{summary.collectedThisMonth.toFixed(2)}</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
        <input
          type="text"
          placeholder="Search by invoice, customer name, or phone..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary"
        />
      </div>

      {/* Sales Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left p-3 text-[10px] font-bold text-secondary uppercase">Invoice</th>
                <th className="text-left p-3 text-[10px] font-bold text-secondary uppercase">Customer</th>
                <th className="text-left p-3 text-[10px] font-bold text-secondary uppercase">Date</th>
                <th className="text-right p-3 text-[10px] font-bold text-secondary uppercase">Total</th>
                <th className="text-right p-3 text-[10px] font-bold text-secondary uppercase">Paid</th>
                <th className="text-right p-3 text-[10px] font-bold text-secondary uppercase">Remaining</th>
                <th className="text-center p-3 text-[10px] font-bold text-secondary uppercase">Status</th>
                <th className="text-left p-3 text-[10px] font-bold text-secondary uppercase">Next Due</th>
                <th className="text-center p-3 text-[10px] font-bold text-secondary uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-secondary">
                    No EMI sales found
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale.id} className="border-b border-border hover:bg-background/50">
                    <td className="p-3 font-bold">{sale.invoiceNumber}</td>
                    <td className="p-3">{sale.customer?.name}</td>
                    <td className="p-3 text-secondary">
                      {new Date(sale.date).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">{Number(sale.totalAmount).toFixed(2)}</td>
                    <td className="p-3 text-right text-green-600">
                      {Number(sale.paidAmount).toFixed(2)}
                    </td>
                    <td className="p-3 text-right text-red-600">
                      {Number(sale.dueAmount).toFixed(2)}
                    </td>
                    <td className="p-3 text-center">
                      <Badge className={statusColor(sale.status)}>{sale.status}</Badge>
                    </td>
                    <td className="p-3 text-secondary">
                      {sale.nextDue
                        ? new Date(sale.nextDue).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => onViewSale(sale)}
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-primary"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/emi/EmiOverviewTab.tsx
git commit -m "feat(emi): add EMI overview tab with summary cards and sales table"
```

---

## Task 11: Create EmiCollectTab Component

**Files:**
- Create: `src/components/emi/EmiCollectTab.tsx`

- [ ] **Step 1: Create the EMI collection tab**

```tsx
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui";
import { Search, CreditCard, AlertCircle } from "lucide-react";
import { InstallmentPaymentModal } from "./InstallmentPaymentModal";
import { EmiReceiptModal } from "./EmiReceiptModal";

export function EmiCollectTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sales, setSales] = useState<any[]>([]);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/emi-sales?search=${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();
      setSales(data.sales || []);
      if (data.sales?.length === 0) {
        setError("No EMI sales found for this search");
      }
    } catch (err) {
      setError("Failed to search EMI sales");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSale = (sale: any) => {
    setSelectedSale(sale);
    setShowPaymentModal(true);
  };

  const handlePaymentComplete = (result: any) => {
    setShowPaymentModal(false);
    setShowReceiptModal(true);
    // Refresh the sale data
    if (selectedSale) {
      fetch(`/api/emi-sales/${selectedSale.id}`)
        .then((res) => res.json())
        .then((data) => setSelectedSale(data.sale));
    }
  };

  const getNextInstallment = (sale: any) => {
    if (!sale.emiSchedules) return null;
    return sale.emiSchedules
      .filter((s: any) => s.status === "PENDING")
      .sort((a: any, b: any) => a.installmentNo - b.installmentNo)[0];
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
          <input
            type="text"
            placeholder="Search by customer name, phone, or invoice number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            "Search"
          )}
        </Button>
      </div>

      {error && (
        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-xl flex items-center gap-2 text-yellow-700 text-xs font-bold">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Results */}
      <div className="space-y-3">
        {sales.map((sale) => {
          const nextInst = getNextInstallment(sale);
          const isOverdue =
            nextInst && new Date(nextInst.dueDate) < new Date();

          return (
            <div
              key={sale.id}
              className="bg-surface rounded-xl border border-border p-4 hover:border-primary/50 transition-all cursor-pointer"
              onClick={() => handleSelectSale(sale)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-bold">{sale.invoiceNumber}</div>
                  <div className="text-sm text-secondary">
                    {sale.customer?.name} • {sale.customer?.phone}
                  </div>
                </div>
                <Badge
                  className={
                    sale.status === "OVERDUE"
                      ? "bg-red-100 text-red-700"
                      : "bg-blue-100 text-blue-700"
                  }
                >
                  {sale.status}
                </Badge>
              </div>

              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-[10px] text-secondary uppercase">Total</div>
                  <div className="font-bold">{Number(sale.totalAmount).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-secondary uppercase">Paid</div>
                  <div className="font-bold text-green-600">
                    {Number(sale.paidAmount).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-secondary uppercase">Remaining</div>
                  <div className="font-bold text-red-600">
                    {Number(sale.dueAmount).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-secondary uppercase">Next Due</div>
                  <div className={`font-bold ${isOverdue ? "text-red-600" : ""}`}>
                    {nextInst
                      ? `#${nextInst.installmentNo} — ${new Date(
                          nextInst.dueDate
                        ).toLocaleDateString()}`
                      : "All paid"}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                <span className="text-xs text-primary font-bold">
                  Click to collect installment
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment Modal */}
      {selectedSale && (
        <InstallmentPaymentModal
          open={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          sale={selectedSale}
          nextInstallment={getNextInstallment(selectedSale)}
          onPaymentComplete={handlePaymentComplete}
        />
      )}

      {/* Receipt Modal */}
      {selectedSale && (
        <EmiReceiptModal
          open={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          sale={selectedSale}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/emi/EmiCollectTab.tsx
git commit -m "feat(emi): add EMI collection tab with search and payment flow"
```

---

## Task 12: Create EmiSaleTab Component

**Files:**
- Create: `src/components/emi/EmiSaleTab.tsx`

- [ ] **Step 1: Create the EMI sale creation tab**

This is a modified version of the existing `src/app/sales/emi/page.tsx` with the checkout modal upgraded to include interest rate, down payment, and EMI schedule preview.

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { EmiReceiptModal } from "./EmiReceiptModal";

export function EmiSaleTab() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [discount, setDiscount] = useState(0);
  const [emiMonths, setEmiMonths] = useState(6);
  const [interestRate, setInterestRate] = useState(0);
  const [downPayment, setDownPayment] = useState(0);
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [receiptSale, setReceiptSale] = useState(null);

  // Fetch products
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products?status=ACTIVE");
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
  };

  const searchCustomers = async (query: string) => {
    if (query.length < 2) {
      setCustomers([]);
      return;
    }
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      setCustomers(data.customers || []);
    } catch (err) {
      console.error("Failed to search customers:", err);
    }
  };

  const addToCart = (product: any) => {
    const existing = cart.find((item) => item.productId === product.id);
    if (existing) {
      setCart(
        cart.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          productId: product.id,
          name: product.name,
          price: Number(product.price),
          cost: Number(product.cost),
          quantity: 1,
          stock: product.stock,
        },
      ]);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.productId !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(
      cart
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const net = subtotal - discount;
  const interest = net * (interestRate / 100);
  const total = net + interest;
  const effectiveDownPayment = downPayment > 0 ? downPayment : total / emiMonths;
  const remaining = total - effectiveDownPayment;
  const monthlyAmount = remaining / (emiMonths - 1);

  const handleCheckout = async () => {
    if (!selectedCustomer) {
      setError("Please select a customer");
      return;
    }
    if (cart.length === 0) {
      setError("Cart is empty");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          })),
          totalAmount: total,
          paidAmount: effectiveDownPayment,
          dueAmount: remaining,
          discount,
          paymentMethod: "EMI",
          saleType: "EMI",
          emiMonths,
          interestRate,
          downPayment: effectiveDownPayment,
          monthlyAmount,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setReceiptSale(data.sale);
      setShowCheckout(false);
      setCart([]);
      setDiscount(0);
      setInterestRate(0);
      setDownPayment(0);
      setSelectedCustomer(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Product Grid */}
      <div className="lg:col-span-2 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>

        {/* Products */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {products
            .filter(
              (p) =>
                !searchQuery ||
                p.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((product) => (
              <div
                key={product.id}
                className="bg-surface rounded-xl border border-border p-3 hover:border-primary/50 cursor-pointer transition-all"
                onClick={() => addToCart(product)}
              >
                <div className="font-bold text-sm mb-1">{product.name}</div>
                <div className="text-lg font-black text-primary">
                  {Number(product.price).toFixed(2)}
                </div>
                <div className="text-xs text-secondary">
                  Stock: {product.stock}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Cart + Customer */}
      <div className="space-y-4">
        {/* Customer Search */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <label className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2 block">
            Customer (Required)
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
            <input
              type="text"
              placeholder="Search customer..."
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                searchCustomers(e.target.value);
              }}
              className="w-full bg-background border border-border rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:border-primary"
            />
          </div>
          {customers.length > 0 && (
            <div className="mt-2 max-h-32 overflow-y-auto border border-border rounded-xl">
              {customers.map((c) => (
                <div
                  key={c.id}
                  className="p-2 hover:bg-primary/5 cursor-pointer text-sm border-b border-border last:border-0"
                  onClick={() => {
                    setSelectedCustomer(c);
                    setCustomerSearch(c.name);
                    setCustomers([]);
                  }}
                >
                  {c.name} — {c.phone}
                </div>
              ))}
            </div>
          )}
          {selectedCustomer && (
            <div className="mt-2 p-2 bg-primary/5 rounded-xl text-sm font-bold">
              {selectedCustomer.name} — {selectedCustomer.phone}
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <h3 className="font-black text-sm mb-3">Cart ({cart.length} items)</h3>
          {cart.length === 0 ? (
            <p className="text-xs text-secondary text-center py-4">
              Click products to add
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {cart.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center justify-between p-2 bg-background rounded-lg"
                >
                  <div className="flex-1">
                    <div className="text-sm font-bold">{item.name}</div>
                    <div className="text-xs text-secondary">
                      {item.price.toFixed(2)} each
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.productId, -1)}
                      className="p-1 rounded hover:bg-red-100"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.productId, 1)}
                      className="p-1 rounded hover:bg-green-100"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="p-1 rounded hover:bg-red-100 text-red-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* EMI Config */}
        <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
          <div>
            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1 block">
              Discount
            </label>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1 block">
              Interest Rate (%)
            </label>
            <input
              type="number"
              value={interestRate}
              onChange={(e) => setInterestRate(Number(e.target.value))}
              className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1 block">
              Down Payment
            </label>
            <input
              type="number"
              value={downPayment}
              onChange={(e) => setDownPayment(Number(e.target.value))}
              className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2 block">
              EMI Duration
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[3, 6, 9, 12].map((m) => (
                <button
                  key={m}
                  onClick={() => setEmiMonths(m)}
                  className={`py-2 rounded-xl text-sm font-bold border transition-all ${
                    emiMonths === m
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-background text-secondary hover:border-primary"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="border-t border-border pt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-secondary">Subtotal</span>
              <span>{subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount</span>
                <span>-{discount.toFixed(2)}</span>
              </div>
            )}
            {interestRate > 0 && (
              <div className="flex justify-between text-secondary">
                <span>Interest ({interestRate}%)</span>
                <span>+{interest.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-lg">
              <span>Total</span>
              <span>{total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Down Payment</span>
              <span>{effectiveDownPayment.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Monthly EMI</span>
              <span>{monthlyAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-center gap-2 text-red-700 text-xs font-bold">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <Button
          onClick={() => setShowCheckout(true)}
          disabled={cart.length === 0 || !selectedCustomer}
          className="w-full"
        >
          <CreditCard className="w-4 h-4 mr-2" />
          Create EMI Sale
        </Button>
      </div>

      {/* Checkout Confirmation Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl border border-border p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black">Confirm EMI Sale</h3>
              <button onClick={() => setShowCheckout(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-background rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary">Customer</span>
                <span className="font-bold">{selectedCustomer?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Duration</span>
                <span className="font-bold">{emiMonths} months</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Total</span>
                <span className="font-bold">{total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Down Payment</span>
                <span className="font-bold">{effectiveDownPayment.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Monthly</span>
                <span className="font-bold">{monthlyAmount.toFixed(2)}</span>
              </div>
            </div>

            <Button onClick={handleCheckout} disabled={loading} className="w-full">
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirm & Create
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Receipt */}
      {receiptSale && (
        <EmiReceiptModal
          open={!!receiptSale}
          onClose={() => setReceiptSale(null)}
          sale={receiptSale}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/emi/EmiSaleTab.tsx
git commit -m "feat(emi): add EMI sale creation tab with checkout modal"
```

---

## Task 13: Create Unified EMI Page

**Files:**
- Create: `src/app/emi/page.tsx`

- [ ] **Step 1: Create the unified EMI page**

```tsx
"use client";

import { useState } from "react";
import { EmiSaleTab } from "@/components/emi/EmiSaleTab";
import { EmiCollectTab } from "@/components/emi/EmiCollectTab";
import { EmiOverviewTab } from "@/components/emi/EmiOverviewTab";
import { EmiReceiptModal } from "@/components/emi/EmiReceiptModal";

const tabs = [
  { id: "sale", label: "New EMI Sale" },
  { id: "collect", label: "Collect Installments" },
  { id: "overview", label: "EMI Overview" },
];

export default function EmiPage() {
  const [activeTab, setActiveTab] = useState("sale");
  const [viewSale, setViewSale] = useState<any>(null);
  const [showSaleDetail, setShowSaleDetail] = useState(false);

  const handleViewSale = async (saleSummary: any) => {
    try {
      const res = await fetch(`/api/emi-sales/${saleSummary.id}`);
      const data = await res.json();
      setViewSale(data.sale);
      setShowSaleDetail(true);
    } catch (err) {
      console.error("Failed to fetch sale detail:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">EMI Management</h1>
        <p className="text-sm text-secondary">
          Create EMI sales, collect installments, and view overview
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-xl border border-border p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${
              activeTab === tab.id
                ? "bg-primary text-white"
                : "text-secondary hover:bg-background"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "sale" && <EmiSaleTab />}
        {activeTab === "collect" && <EmiCollectTab />}
        {activeTab === "overview" && (
          <EmiOverviewTab onViewSale={handleViewSale} />
        )}
      </div>

      {/* Sale Detail Modal */}
      {showSaleDetail && viewSale && (
        <EmiReceiptModal
          open={showSaleDetail}
          onClose={() => {
            setShowSaleDetail(false);
            setViewSale(null);
          }}
          sale={viewSale}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/emi/page.tsx
git commit -m "feat(emi): add unified EMI management page with 3 tabs"
```

---

## Task 14: Update Navigation

**Files:**
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/app/sales/emi/page.tsx`

- [ ] **Step 1: Update sidebar — move EMI to top-level**

Find the EMI entry in the sidebar (around line 41) and remove it from the Sales submenu. Add it as a top-level entry after the Sales section:

Find this block and remove the EMI entry from Sales:
```typescript
{ label: "EMI Sale", href: "/sales/emi", roles: ADMIN_MANAGER },
```

Add after the Sales section (after the last Sales submenu item):
```typescript
{
  label: "EMI",
  href: "/emi",
  icon: CreditCard,
  roles: ADMIN_MANAGER,
},
```

Make sure `CreditCard` is imported from lucide-react at the top of the file.

- [ ] **Step 2: Replace EMI page with redirect**

Replace the content of `src/app/sales/emi/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

export default function EmiRedirect() {
  redirect("/emi");
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx src/app/sales/emi/page.tsx
git commit -m "feat(emi): move EMI to top-level sidebar and redirect old route"
```

---

## Task 15: Verify Build

**Files:**
- None (verification only)

- [ ] **Step 1: Run build check**

Run: `npx next build`
Expected: 0 type errors, all pages compile successfully

- [ ] **Step 2: Start dev server and smoke test**

Run: `npm run dev`
Then verify:
- `http://localhost:3000/emi` → 200
- `http://localhost:3000/api/emi/summary` → 200
- `http://localhost:3000/api/emi-sales` → 200
- `http://localhost:3000/api/health` → 200 (DB connection)

- [ ] **Step 3: Commit any fixes**

If build errors were found and fixed, commit them.

---

## Task 16: Final Commit and Push

- [ ] **Step 1: Review all changes**

Run: `git status`
Run: `git diff --stat`

- [ ] **Step 2: Commit all EMI changes**

```bash
git add -A
git commit -m "feat(emi): complete EMI installment tracking system

- Add EMISchedule model with per-installment due dates and status
- Add EMI config fields to Sale model (emiMonths, interestRate, downPayment, monthlyAmount)
- Update SaleService with schedule generation, installment payment, and early payoff
- Update sale creation API to accept EMI fields
- Rewrite installment collection API with sequential payment and early payoff
- Add EMI sales list API with status enrichment
- Add EMI single sale detail API
- Add EMI summary API for dashboard stats
- Create unified /emi page with 3 tabs: New Sale, Collect, Overview
- Create InstallmentPaymentModal for paying installments
- Create EmiReceiptModal with full installment schedule
- Update sidebar: move EMI to top-level
- Redirect /sales/emi to /emi"
```

- [ ] **Step 3: Push to remote**

Run: `git push`
