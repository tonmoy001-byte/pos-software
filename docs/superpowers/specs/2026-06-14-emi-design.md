# EMI Feature Design Spec

**Date:** 2026-06-14
**Approach:** Standard EMI (Approach B)
**Status:** Approved

---

## Overview

Full EMI (Equated Monthly Installment) feature for the POS system. Replaces the current thin wrapper with proper installment schedule tracking, collection workflow, and overview dashboard — all under one unified `/emi` page with 3 tabs.

## Business Rules

| Rule | Value |
|------|-------|
| Interest rate | Owner sets manually per sale (0% = no interest) |
| EMI durations | Fixed: 3, 6, 9, 12 months |
| Down payment | Custom amount entered by owner |
| Due dates | Calculated from sale date (monthly intervals) |
| Late fees | None (visual overdue tracking only) |
| Early payoff | Allowed (pay all remaining at once) |
| Customer info | Basic only (name + phone, same as current) |
| Collection mode | Sequential only (pay next due installment) |
| Receipt | Installment schedule on receipt |

---

## Database Schema

### Sale Model Additions

Add these fields to the existing `Sale` model:

```prisma
model Sale {
  // ... existing fields ...

  // EMI fields (null for non-EMI sales)
  emiMonths       Int?
  interestRate    Decimal?   @db.Decimal(5, 2)  // percentage, e.g. 10.00 for 10%
  downPayment     Decimal?   @db.Decimal(10, 2) // custom first payment amount
  monthlyAmount   Decimal?   @db.Decimal(10, 2) // calculated: (total - downPayment) / (emiMonths - 1)
}
```

### New EMISchedule Model

```prisma
model EMISchedule {
  id            String   @id @default(cuid())
  saleId        String
  installmentNo Int      // 1 = down payment, 2 = first monthly, etc.
  dueDate       DateTime
  amount        Decimal  @db.Decimal(10, 2)
  status        String   @default("PENDING") // PENDING, PAID, OVERDUE
  paidDate      DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  sale Sale @relation(fields: [saleId], references: [id], onDelete: Cascade)

  @@index([saleId])
  @@index([status])
  @@index([dueDate])
}
```

### Sale Model Relation Addition

```prisma
model Sale {
  // ... existing fields ...
  emiSchedules EMISchedule[]
}
```

---

## EMI Page (`/emi`) — Unified Management

Single page with 3 tabs. Sidebar entry moves from "EMI Sale" (under Sales) to top-level "EMI".

### Tab 1: New EMI Sale

Same as current EMI sale flow, with checkout modal upgrades:

**Checkout Modal Fields:**
- Product cart (existing)
- Customer search (existing, required)
- Discount input (existing)
- Interest rate input — owner enters % (default 0%)
- Down payment input — owner enters custom first payment amount (default = equal installment)
- EMI duration selector — 3, 6, 9, 12 buttons

**Calculation Logic (shown live in modal):**
```
Subtotal = sum of product prices × quantities
Net = Subtotal - Discount
Interest = Net × InterestRate / 100
Total = Net + Interest
First Payment = owner-entered down payment amount
Remaining = Total - First Payment
Monthly Installment = Remaining / (EmiMonths - 1)
```

**Example:** 12,000 product, 500 discount, 10% interest, 6-month plan, 3,000 down payment
```
Subtotal = 12,000
Net = 12,000 - 500 = 11,500
Interest = 11,500 × 10% = 1,150
Total = 11,500 + 1,150 = 12,650
First Payment = 3,000
Remaining = 12,650 - 3,000 = 9,650
Monthly = 9,650 / 5 = 1,930
Schedule: 3,000 → 1,930 → 1,930 → 1,930 → 1,930 → 1,930
```

**On "Create EMI Sale":**
1. Create Sale record with `saleType=EMI`, all EMI fields populated
2. Create Payment record for the first payment (down payment)
3. Generate EMISchedule records (N installments with due dates from sale date)
4. Reduce stock, create journal entries (same as current due sale)
5. Show EMI receipt with full installment schedule

### Tab 2: Collect Installments

**Search:**
- Single search bar: customer name/phone OR invoice number
- Results: EMI sales with status (Active/Overdue badge), next due installment

**Select a sale → Installment Payment Modal:**
- Shows: "Installment #3 of 12 — Due: Aug 14 — Amount: 2,040"
- Overdue badge (red) if `dueDate < today AND status = PENDING`
- Payment method selector (Cash, bKash, Nagad, etc.)
- **"Pay Installment" button** — pays the next due installment
- **"Pay All Remaining" button** — early closure, pays all pending installments

**After payment:**
- Installment status → PAID, paidDate set
- Sale `paidAmount` updated
- If all installments paid → Sale status → PAID
- Receipt shown with installment schedule and payment details

### Tab 3: EMI Overview

**Summary Cards (top of page):**
- Total Active EMIs (count of sales with unpaid installments)
- Total Outstanding (sum of remaining amounts across all active EMIs)
- Overdue Count (installments past due date)
- Collected This Month (sum of payments in current month)

**EMI Sales Table:**
| Column | Description |
|--------|-------------|
| Invoice # | Sale invoice number |
| Customer | Customer name |
| Date | Sale date |
| Total | Total EMI amount (with interest) |
| Paid | Amount paid so far |
| Remaining | Total - Paid |
| Status | Active / Overdue / Completed |
| Next Due | Next installment due date |

**Click a row → Expanded View:**
- Full installment schedule with status per installment
- Payment history for this sale

---

## EMI Receipt

Updated `ReceiptModal` for EMI sales:

```
┌─────────────────────────────┐
│         [Store Logo]        │
│       Store Name, Phone     │
│        Address              │
├─────────────────────────────┤
│  EMI SALE INVOICE           │
│  Invoice: #INV-000123       │
│  Date: June 14, 2026        │
├─────────────────────────────┤
│  Customer: John Doe         │
│  Phone: 01712345678         │
├─────────────────────────────┤
│  Product      Qty   Total   │
│  iPhone 15     1   12,000   │
│  Discount            -500   │
│  Net               11,500   │
│  Interest (10%)    +1,150   │
├─────────────────────────────┤
│  TOTAL:          12,650     │
│  Down Payment:    3,000     │
│  Monthly EMI:     1,930     │
├─────────────────────────────┤
│  INSTALLMENT SCHEDULE       │
│  #  Due       Amount Status │
│  1  Jun 14    3,000  PAID   │
│  2  Jul 14    1,930  PENDING│
│  3  Aug 14    1,930  PENDING│
│  4  Sep 14    1,930  PENDING│
│  5  Oct 14    1,930  PENDING│
│  6  Nov 14    1,930  PENDING│
├─────────────────────────────┤
│  Total: 12,650              │
│  Paid:   3,000              │
│  Due:    9,650              │
└─────────────────────────────┘
```

---

## Journal Entries

EMI sales follow the same double-entry rules as due sales.

**When EMI sale is created (down payment collected):**
```
Dr 1000 Cash [down payment amount]
Dr 1100 Accounts Receivable [remaining installments total]
Cr 4000 Sales Revenue [total sale amount]

Dr 5000 COGS [product cost]
Cr 1200 Inventory [product cost]
```

**When installment is collected later:**
```
Dr 1000 Cash [installment amount]
Cr 1100 Accounts Receivable [installment amount]
```

**Early payoff (all remaining at once):**
```
Dr 1000 Cash [remaining total]
Cr 1100 Accounts Receivable [remaining total]
```

No new account codes needed. Same journal pattern as existing due sales.

---

## API Routes

### Modified: `POST /api/sales`
- Accept `emiMonths`, `interestRate`, `downPayment` in request body
- Validate: if `saleType=EMI`, `emiMonths` is required
- Pass EMI fields to `SaleService.create()`

### Modified: `POST /api/sales/[id]/emi`
- Accept `installmentNo` in request body (which installment is being paid)
- Validate: installment must be PENDING
- Update installment status to PAID, set paidDate
- Update Sale `paidAmount`
- If all installments PAID, update Sale status to PAID
- Support `payAll=true` for early payoff (mark all pending as PAID)

### New: `GET /api/emi-sales`
- List all EMI sales with summary data
- Query params: `status` (active/overdue/completed), `search` (customer/invoice)
- Returns: sale list with paid/remaining amounts, next due date

### New: `GET /api/emi-sales/[id]`
- Get single EMI sale with full installment schedule
- Returns: sale details + EMISchedule[] + payment history

### New: `GET /api/emi/summary`
- Dashboard summary stats
- Returns: totalActive, totalOutstanding, overdueCount, collectedThisMonth

---

## Navigation Changes

**Sidebar update:**
- Remove "EMI Sale" from under Sales submenu
- Add top-level "EMI" link → `/emi`
- Icon: CreditCard or similar

**Routes:**
- `/emi` — unified EMI management page (3 tabs)
- Remove `/sales/emi` (redirect to `/emi`)

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `src/app/emi/page.tsx` | Unified EMI page with 3 tabs |
| `src/components/emi/EmiSaleTab.tsx` | Tab 1: New EMI sale creation |
| `src/components/emi/EmiCollectTab.tsx` | Tab 2: Installment collection |
| `src/components/emi/EmiOverviewTab.tsx` | Tab 3: Overview dashboard |
| `src/components/emi/InstallmentPaymentModal.tsx` | Modal for paying installments |
| `src/components/emi/EmiReceiptModal.tsx` | EMI-specific receipt |
| `src/app/api/emi-sales/route.ts` | GET list EMI sales |
| `src/app/api/emi-sales/[id]/route.ts` | GET single EMI sale + schedule |
| `src/app/api/emi/summary/route.ts` | GET dashboard summary |

### Modified Files
| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add EMI fields to Sale, add EMISchedule model |
| `src/app/api/sales/route.ts` | Accept and validate EMI fields |
| `src/app/api/sales/[id]/emi/route.ts` | Add installment-specific payment, early payoff |
| `src/lib/services/sale.ts` | Handle EMI schedule generation, installment payments |
| `src/components/layout/sidebar.tsx` | Move EMI to top-level |
| `src/app/sales/emi/page.tsx` | Replace with redirect to `/emi` |
| `src/components/invoice/ReceiptModal.tsx` | Add EMI-specific receipt layout |

### Deleted/Redirected
| File | Action |
|------|--------|
| `src/app/sales/emi/page.tsx` | Redirect to `/emi` |

---

## Implementation Order

1. **Schema + Migration** — Add fields to Sale, create EMISchedule, run migration
2. **Backend: Sale Creation** — Update SaleService to handle EMI fields, generate schedule
3. **Backend: Installment Collection** — Update `/api/sales/[id]/emi` for per-installment payment
4. **Backend: API Routes** — Create `/api/emi-sales`, `/api/emi/summary`
5. **Frontend: Tab 1 (New Sale)** — Update checkout modal with interest/down payment
6. **Frontend: Tab 2 (Collection)** — New collection UI with search + payment modal
7. **Frontend: Tab 3 (Overview)** — Dashboard with summary cards + table
8. **Receipt** — Update ReceiptModal for EMI layout
9. **Navigation** — Sidebar changes, redirects
10. **Verify** — Build check, functional tests
