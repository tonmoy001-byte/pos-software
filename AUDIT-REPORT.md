# POS System Comprehensive Audit Report

**Date:** 2026-05-19
**Scope:** Full audit of API implementation, business logic, functionality, and performance
**System:** Next.js POS Software with SQLite/Prisma

---

## Executive Summary

| Severity | Count | Key Themes |
|----------|-------|------------|
| **Critical** | 18 | Broken endpoints, missing auth, financial data corruption, SQLite concurrency |
| **High** | 35 | Missing permissions, race conditions, incorrect calculations, security gaps |
| **Medium** | 45 | Validation gaps, performance bottlenecks, UX issues |
| **Low** | 27 | Code quality, minor UX, dead code |

**Total Issues Found: 125**

---

## CRITICAL ISSUES (Must Fix Immediately)

### C1. Refund Endpoint Completely Broken
- **File:** `src/app/api/sales/[id]/refund/route.ts:43`
- **Issue:** `id` variable used on line 43 but never defined — `const { id } = await params` is on line 69 (dead code). Every refund request throws `ReferenceError: id is not defined`.
- **Impact:** **All refunds fail.** Zero refunds can be processed.
- **Fix:**
```ts
// Move to line 13, right after params destructuring:
const { id } = await params;
// Delete lines 67-99 (dead duplicate code)
```

### C2. Unauthenticated Alert Endpoint
- **File:** `src/app/api/alerts/route.ts:16-59`
- **Issue:** Zero authentication. Accepts `storeId` as query parameter. Anyone can trigger alerts against any store.
- **Impact:** Full store data exposure, alert spam, notification abuse.
- **Fix:** Add session check + use `session.user.storeId` instead of query param.

### C3. Partial Refund Wipes Customer Due
- **File:** `src/lib/services/sale.ts:542-547`
- **Issue:** Partial refund sets `dueAmount: 0` unconditionally. If a credit sale has `dueAmount > 0`, a partial refund erases the customer's debt entirely.
- **Impact:** **Financial loss** — customer's outstanding balance is forgiven.
- **Fix:**
```ts
} : {
  refundedAmount: { increment: refunded },
  paidAmount: { decrement: refunded },
  dueAmount: sale.dueAmount, // preserve existing due
},
```

### C4. Customer Deletion with Outstanding Dues
- **File:** `src/app/api/customers/[id]/route.ts:83-107`
- **Issue:** Customer can be deleted even with `dueAmount > 0`. The receivable is silently lost.
- **Impact:** **Financial loss** — outstanding receivables erased.
- **Fix:**
```ts
if (Number(customer.dueAmount) > 0) {
  return NextResponse.json({ error: "Cannot delete customer with outstanding dues" }, { status: 400 });
}
```

### C5. Floating-Point Arithmetic on Financial Data
- **File:** `src/lib/services/sale.ts:116-119`
- **Issue:** `(item.price - itemCost) * item.quantity` uses JS floating-point. `0.1 + 0.2 = 0.30000000000000004`. Over hundreds of sales, this accumulates into material financial discrepancies.
- **Impact:** Incorrect profit reporting, tax misreporting, reconciliation failures.
- **Fix:** Use `decimal.js` library or integer cents.

### C6. Refund Transaction Records Wrong Amount
- **File:** `src/lib/services/sale.ts:586-597`
- **Issue:** `SALE_REFUND` transaction records `amount: Number(sale.totalAmount)` — the full sale total — even for partial refunds.
- **Impact:** Financial reports show inflated refund totals; cash reconciliation fails.
- **Fix:** Use `refunded` instead of `sale.totalAmount`.

### C7. Refund Marks ALL Payments as REFUNDED for Partial Refund
- **File:** `src/lib/services/sale.ts:511-516`
- **Issue:** `payment.updateMany` sets ALL payments to `REFUNDED` regardless of partial vs full refund.
- **Impact:** Payment audit trail corrupted.

### C8. SQLite — No Concurrent Write Support
- **File:** `prisma/schema.prisma:7`
- **Issue:** SQLite has database-level locking. Under concurrent sales (two cashiers), one transaction fails with `SQLITE_BUSY`. Prisma does not auto-retry.
- **Impact:** **Lost sales under concurrent usage.**
- **Fix:** Migrate to PostgreSQL (schema already exists at `postgresql-schema.prisma`).

### C9. Journal Entry Unbalanced on Due Sales
- **File:** `src/lib/services/posting.ts:56-74`
- **Issue:** When `mode === "DUE"` (credit sale), cash is debited for 0 and AR is debited twice. Technically balances but semantically wrong.
- **Impact:** Confusing audit trail; potential double-counting.

### C10. Sidebar Role Filtering Completely Broken
- **File:** `src/components/layout/sidebar.tsx:26-72`
- **Issue:** Sidebar checks for `"STAFF"` role but Prisma enum has `MANAGER` and `CASHIER`. All menu items hidden for non-ADMIN users.
- **Impact:** **Non-admin users see empty sidebar.** App unusable for cashiers/managers.
- **Fix:** Replace all `"STAFF"` with proper role arrays.

### C11. Hardcoded ADMIN Role in SidebarWrapper
- **File:** `src/components/layout/SidebarWrapper.tsx:13`
- **Issue:** `userRole` hardcoded to `"ADMIN"`. ALL users see admin menu regardless of actual role.
- **Impact:** **No frontend RBAC.** Cashiers see admin pages.
- **Fix:** Get role from session: `const session = useSession(); const userRole = session?.data?.user?.role`.

### C12. NID File Upload Never Sent to Server
- **File:** `src/app/second-hand/page.tsx:72-81`
- **Issue:** NID photo selected via file input but never uploaded. API only receives JSON, not the file.
- **Impact:** **PII data not stored.** Compliance violation.
- **Fix:** Use `FormData` to send file with POST request.

### C13. No Duplicate IMEI Validation in POS
- **File:** `src/app/pos/page.tsx:177-193`
- **Issue:** Same IMEI can be sold twice if added to cart multiple times.
- **Impact:** **Duplicate sales of same device.** Inventory and financial corruption.
- **Fix:** Check if selected IMEIs already exist in cart before confirming.

### C14. Second-Hand Purchase Not Linked to Accounting
- **File:** `src/lib/services/secondhand.ts:56-89`
- **Issue:** Creating a second-hand record only stores metadata. Does NOT: create inventory product, record cash outflow, create journal entry.
- **Impact:** **Complete financial blind spot** — cash paid for goods is untracked.

### C15. Daily Closing Does Not Check `isLocked`
- **File:** `src/lib/services/dailyActivity.ts:246-293`
- **Issue:** A locked day can be re-opened and modified via `saveClosing`. No guard prevents modification of locked days.
- **Impact:** **Historical financial data can be retroactively altered.**

### C16. `calculateProfit` Clamps Losses to Zero
- **File:** `src/lib/services/eventStore.ts:118-121`
- **Issue:** `Math.max(0, profit)` means loss-making sales report $0 profit instead of negative.
- **Impact:** **Profit reports systematically overstated.**

### C17. Export Loads Entire Database
- **File:** `src/lib/services/dailyActivity.ts:334-358`
- **Issue:** `exportAllTransactions` fetches ALL sales, transactions, loans, payments with deep includes — no pagination, no date filter.
- **Impact:** **Memory exhaustion** with >10K records. 2-10+ seconds response time.

### C18. Mobile POS Uses Wrong Property Names
- **File:** `src/app/mobile-pos/page.tsx:42`
- **Issue:** Uses `sellingPrice` but API returns `price`. Cart items have `NaN` price.
- **Impact:** **Mobile POS checkout produces invalid sales.**

---

## HIGH ISSUES

### H1. 12 Endpoints Missing Permission Checks
| Endpoint | File | Missing Permission |
|----------|------|-------------------|
| Advance Cancel | `advances/[id]/cancel/route.ts` | `sale:cancel` |
| Advance Complete | `advances/[id]/complete/route.ts` | `sale:create` |
| Second Hand POST | `second-hand/route.ts` | `secondhand:create` |
| Second Hand GET | `second-hand/route.ts` | `secondhand:view` |
| Dues Payment | `dues/[id]/route.ts` | `sale:create` |
| EMI Payment | `sales/[id]/emi/route.ts` | `sale:create` |
| Product Delete | `products/[id]/route.ts` | `product:delete` |
| Transaction Create | `transactions/route.ts` | `transaction:create` |
| Barcode Settings | `barcode-settings/route.ts` | `store:settings` |
| Invoice Settings | `invoice-settings/route.ts` | `store:settings` |
| Customer Payment | `customers/[id]/payment/route.ts` | `customer:update` (wrong) |
| User Delete | `users/[id]/route.ts` | `user:delete` (wrong status code) |

**Impact:** Any authenticated user (including CASHIER) can perform admin operations.

### H2. 8 Endpoints Missing View Permission Checks
| Endpoint | File |
|----------|------|
| Suppliers GET | `suppliers/route.ts` |
| Loans GET | `loans/route.ts` |
| Advances GET | `advances/route.ts` |
| Dues GET | `dues/route.ts` |
| Transactions GET | `transactions/route.ts` |
| Dashboard Stats | `dashboard/stats/route.ts` |
| Reports | `reports/route.ts` |
| Customers Export | `customers/export/route.ts` |

### H3. IDOR — Product Stock Update Without Store Verification
- **File:** `src/app/api/products/[id]/stock/route.ts:28-32`
- **Issue:** Updates product by `id` alone without verifying `storeId`.
- **Impact:** Cross-store stock manipulation.

### H4. No Input Validation — User Creation
- **File:** `src/app/api/users/route.ts:36`
- **Issue:** No Zod schema. No password strength, username format, or role enum validation.

### H5. No Input Validation — Loan Creation
- **File:** `src/app/api/loans/route.ts:37`
- **Issue:** `parseFloat(data.amount)` can produce `NaN`.

### H6. Partial Refund Does Not Restock Items
- **File:** `src/lib/services/sale.ts:496-508`
- **Issue:** Stock only restored on full refunds. Partial refund of 1 of 5 items returns no stock.
- **Impact:** Inventory drift after partial refunds.

### H7. Race Condition on Customer Due Update
- **File:** `src/lib/services/sale.ts:185-203`
- **Issue:** Read-then-write pattern (`findUnique` → compute → `update`). Two concurrent sales cause lost update.
- **Fix:** Use `increment` instead of read-compute-write.

### H8. Stock Movement Records Wrong `stockBefore`
- **File:** `src/lib/services/stockMovement.ts:25-29`
- **Issue:** Re-fetches product after update, so `stockBefore` is actually the post-update value.
- **Impact:** Stock movement audit trail corrupted. *(Already fixed in previous session)*

### H9. Product Deletion Cascades SaleItems
- **File:** `prisma/schema.prisma:189`
- **Issue:** `onDelete: Cascade` erases historical sale line items.
- **Impact:** Irrecoverable loss of sales history.
- **Fix:** Change to `onDelete: Restrict`.

### H10. Loan Payment Records Wrong Amount
- **File:** `src/lib/services/loan.ts:82, 94-105`
- **Issue:** Transaction uses `data.amount` instead of `cappedAmount`. Overstates payments.

### H11. Timezone Mismatch in Daily Activity
- **File:** `src/lib/services/dailyActivity.ts:65-66, 459`
- **Issue:** `getSheet` uses UTC, `exportDailySheetDetailed` uses local time. Different data for same date.

### H12. `collectPayment` Reads Sale Outside Transaction
- **File:** `src/lib/services/sale.ts:384-386`
- **Issue:** Sale fetched before transaction begins. Stale read allows overpayment. *(Already fixed)*

### H13. `ensureAccounts` Runs 12 Upserts Per Journal Entry
- **File:** `src/lib/services/posting.ts:51, 97, 142, 199`
- **Issue:** 12 extra writes per financial operation. ~50-100ms per sale.
- **Fix:** Cache account map per store.

### H14. Per-Item Stock Updates in Loop
- **File:** `src/lib/services/sale.ts:139-152`
- **Issue:** Each item triggers separate `product.update()` + `recordStockMovement()`. 10 items = 20 sequential writes.

### H15. No Response Caching
- **Files:** Multiple
- **Issue:** Dashboard stats, product list, customer list fetched fresh every request. Dashboard alone makes 8+ queries per load.

### H16. SMS Alerts Have No Timeout
- **File:** `src/lib/notifications/alert-service.ts:76-92`
- **Issue:** If SMS API is slow/unresponsive, request blocks indefinitely (30+ seconds).

### H17. Discount Can Make Total Negative
- **File:** `src/app/pos/page.tsx:281`
- **Issue:** If discount > subtotal, total becomes negative. Store "pays" the customer.
- **Fix:** `const total = Math.max(0, subtotal - discount);`

### H18. N+1 Query in `sale.findAll()`
- **File:** `src/lib/services/sale.ts:254-265`
- **Issue:** 100 sales × avg 3 items = 300+ product lookups per request. ~200-500ms.
- **Fix:** Use `select` instead of `include`.

### H19. Dashboard Chart O(n×m) Filtering
- **File:** `src/app/api/dashboard/stats/route.ts:91-111`
- **Issue:** For each day, iterates ALL sales and expenses with `.filter()`. O(days × records).
- **Impact:** 100-300ms CPU time.
- **Fix:** Single-pass Map grouping.

### H20. Reports API Heavy Include
- **File:** `src/app/api/reports/route.ts:53-58`
- **Issue:** 500 sales with all items, products, and payments. ~300-800ms.

### H21. `CapitalService.getCapitalSummary` Loads All Products
- **File:** `src/lib/services/transaction.ts:202-205`
- **Issue:** `findMany` + `reduce` instead of aggregate query. Called on every dashboard/reports load.

### H22. Admin Bypasses Store Isolation in Reports
- **File:** `src/app/api/reports/route.ts:19-20`
- **Issue:** `const storeFilter = isAdmin ? {} : { storeId }` — admin queries ALL stores' data.

### H23. POS Stock Validation Missing on Quantity Increment
- **File:** `src/app/pos/page.tsx:826-829`
- **Issue:** Can add more items to cart than available stock.

### H24. Users Page No Password Strength Validation
- **File:** `src/app/users/page.tsx:228-229`
- **Issue:** Weak passwords accepted for staff accounts.

### H25. Modal `onClose` Causes Infinite Loops
- **File:** `src/components/ui/modal.tsx:29`
- **Issue:** `onClose` in useEffect dependency array — recreated every render.

### H26. Scan Page Uses Wrong Property Names
- **File:** `src/app/scan/page.tsx:97, 107`
- **Issue:** Uses `sellingPrice`/`buyingPrice` but API returns `price`/`cost`.

### H27. No Zod Validation on Multiple POST Endpoints
- **Files:** `daily-activity/route.ts`, `loans/route.ts`, `users/route.ts`, `suppliers/route.ts`
- **Issue:** Direct `req.json()` destructuring with no schema validation.

### H28. Customer Payment Distributes Without Per-Sale Records
- **File:** `src/app/api/customers/[id]/payment/route.ts:46-103`
- **Issue:** FIFO distribution updates sale amounts but creates only one `Payment` without `saleId`.

### H29. `dueAmount` Denormalization Risk
- **File:** `prisma/schema.prisma:132`
- **Issue:** `Customer.dueAmount` must be kept in sync with `Sale.dueAmount`. Race conditions cause drift.

### H30. `Product.profit` Stale Computed Field
- **File:** `prisma/schema.prisma:105`
- **Issue:** Stored `profit = price - cost`. Becomes stale if price/cost change.

### H31. No Permission Check — Supplier Products POST/DELETE
- **Files:** `suppliers/[id]/products/route.ts`, `suppliers/[id]/products/[linkId]/route.ts`
- **Issue:** Any user can modify supplier-product relationships.

### H32. Onboarding Race Condition
- **File:** `src/app/api/onboarding/route.ts:27-29`
- **Issue:** Check-then-create: two concurrent requests both pass the check, creating multiple admins.

### H33. No Rate Limiting on Auth Endpoint
- **File:** `src/app/api/auth/[...nextauth]/route.ts`
- **Issue:** No brute force protection on login.

### H34. Suppliers GET Returns Empty Array with 401
- **File:** `src/app/api/suppliers/route.ts:21`
- **Issue:** Client interprets `[]` as "no suppliers" not "unauthorized".

### H35. Swallowed Session Errors
- **File:** `src/app/api/suppliers/route.ts:34-39`
- **Issue:** try/catch around `getSession()` masks authentication failures.

---

## MEDIUM ISSUES

### M1. No Validation: `totalAmount` vs Item Sum
- **File:** `src/lib/services/sale.ts:30-31`
- **Issue:** `totalAmount` accepted from client without verifying it matches `sum(items.price * quantity)`.
- **Impact:** Financial fraud potential.

### M2. No Validation: `paidAmount + dueAmount` vs `totalAmount`
- **File:** `src/lib/services/sale.ts:31`
- **Issue:** Could create sale where `paid + due > total` (phantom money) or `< total` (lost money).

### M3. Sale Double-Write Pattern
- **File:** `src/lib/services/sale.ts:84-93, 156-162`
- **Issue:** Sale created with `costAmount: 0`, then updated separately. If transaction crashes between writes, sale exists with zero cost/profit.

### M4. Advance Orders Created with Empty Items
- **File:** `src/lib/services/dailyActivity.ts:223-234`
- **Issue:** `ADVANCE_ORDER` with `items: []` — no stock, no cost, no profit tracked.

### M5. Stock Override Allows Negative Values
- **File:** `src/app/api/products/[id]/stock/route.ts:79-83`
- **Issue:** PUT allows `stock < 0`.

### M6. Business Logic Errors Return 500
- **File:** `src/app/api/customers/[id]/payment/route.ts:153-158`
- **Issue:** "No due sales found" returns 500 instead of 400.

### M7. Inconsistent Error Response Formats
- **Files:** Multiple
- **Issue:** `{ error }`, `{ ok: false, error }`, `{ error, details }`, `{ message }` — no standardization.

### M8. Hardcoded Product Limit (200)
- **File:** `src/app/api/products/route.ts:52`
- **Issue:** No pagination support.

### M9. `as any` Type Casts
- **File:** `src/app/api/sales/return/route.ts:105,135`
- **Issue:** Bypasses TypeScript checks.

### M10. POST Delegates to PUT
- **Files:** `settings/store/route.ts:72-73`, `invoice-settings/route.ts:56-58`
- **Issue:** Violates REST semantics.

### M11. No Permission — Daily Activity Export
- **File:** `src/app/api/daily-activity/export/route.ts:77-80`
- **Issue:** No `hasPermission()` for exporting financial data.

### M12. No Permission — Export Transactions
- **File:** `src/app/api/export/transactions/route.ts:6-10`

### M13. No Permission — Settings Store GET
- **File:** `src/app/api/settings/store/route.ts:8-12`

### M14. No Permission — ADVANCE Type in Daily Activity
- **File:** `src/app/api/daily-activity/route.ts:98-99`
- **Issue:** Falls through without permission check.

### M15. Customer Delete Without storeId in WHERE
- **File:** `src/app/api/customers/[id]/route.ts:96`
- **Issue:** Race condition could allow deletion of customer moved to another store.

### M16. POS `prompt()` for Price Override
- **File:** `src/app/pos/page.tsx:788-797`
- **Issue:** Native `prompt()` blocks UI, no validation, no audit trail.

### M17. Barcode Input Loses Focus
- **File:** `src/app/pos/page.tsx:591-599`
- **Issue:** Barcode scanner may not work if focus shifts.

### M18. No Phone Number Format Validation
- **File:** `src/app/customers/page.tsx:374-377`

### M19. Payment Amount Not Validated Against Due
- **File:** `src/app/customers/page.tsx:131-155`

### M20. Return Page — No Quantity vs Original Validation
- **File:** `src/app/sales/return/page.tsx:143-154`

### M21. Exchange Page — Negative Values Not Validated
- **File:** `src/app/sales/exchange/page.tsx:78-79`

### M22. Loan Overpayment Not Validated
- **File:** `src/app/loans/page.tsx:67-79`

### M23. Reports Page — No Error State
- **File:** `src/app/reports/page.tsx:37-46`

### M24. Due Adjustment No Audit Note
- **File:** `src/app/suppliers/page.tsx:108-111`

### M25. Barcode Settings No Error Feedback
- **File:** `src/app/settings/barcode/page.tsx:69-84`

### M26. Button No Default `type`
- **File:** `src/components/ui/button.tsx:9-39`
- **Issue:** Defaults to `submit`, causing unexpected form submissions.

### M27. No Focus Trap in Modal
- **File:** `src/components/ui/modal.tsx:14-72`
- **Issue:** Accessibility problem.

### M28. No Centralized Validation Library
- **Severity:** Medium
- **Issue:** Each page implements ad-hoc validation.

### M29. API Responses Not Validated on Frontend
- **Severity:** High
- **Issue:** If API response shape changes, frontend crashes silently.

### M30. Network Failure During Checkout
- **File:** `src/app/pos/page.tsx:248-277`
- **Issue:** Sale may have been created but user sees error (double-sale risk).

### M31. `cn` Utility Doesn't Use `tailwind-merge`
- **File:** `src/lib/utils.ts:31-33`
- **Issue:** Conflicting Tailwind classes not resolved.

### M32. `generateBarcode` Uses `Math.random()`
- **File:** `src/lib/barcode.ts:1-6`
- **Issue:** Collision possible with enough products.

### M33. Audio Context Not Closed
- **File:** `src/lib/audio.ts:1-31`
- **Issue:** AudioContext accumulates in memory.

### M34. SW Caching Headers Too Long
- **File:** `next.config.ts:10-31`
- **Issue:** Service worker cached 24h. If SW has bug, users stuck.

### M35. Missing Routes in Proxy Matcher
- **File:** `src/proxy.ts:58-73`
- **Issue:** `/reports`, `/suppliers`, `/settings`, `/scan`, `/mobile-pos`, `/admin` not protected by auth middleware.

### M36. `xlsx` Package Outdated
- **File:** `package.json:30`
- **Issue:** SheetJS community edition has known limitations.

### M37. `recharts` Version May Not Exist
- **File:** `package.json:28`
- **Issue:** Recharts v3.x doesn't exist yet.

### M38. No `NEXTAUTH_SECRET` in `.env.example`
- **Severity:** Critical
- **Issue:** New deployments fail to authenticate.

### M39. `model` and `brand` Defaults Create Junk Data
- **File:** `prisma/schema.prisma:98-101`
- **Issue:** `data.model || data.name` creates junk when model is empty.

### M40. No Pagination — Sales GET
- **File:** `src/app/api/sales/route.ts:47`
- **Issue:** `findAll` returns all sales.

### M41. Inefficient Client-Side Date Filtering
- **File:** `src/app/api/dashboard/stats/route.ts:91-111`

### M42. `store:settings` Permission Not in RBAC
- **File:** `src/lib/services/rbac.ts`
- **Issue:** Permission defined but not assigned to any role properly.

### M43. Second-Hand NID Access Control Missing
- **File:** `src/lib/services/secondhand.ts:19-44`
- **Issue:** Any authenticated user can download encrypted NID photos.

### M44. Supplier Due Adjustment Transaction Type Wrong
- **File:** `src/lib/services/supplier.ts:55-91`
- **Issue:** Positive adjustment (increasing what we owe) logged as PURCHASE.

### M45. `postTransactionEntry` Missing `DUE_PAYMENT` Case
- **File:** `src/lib/services/posting.ts:151-178`
- **Issue:** Due payment transactions create no journal entry.

---

## LOW ISSUES

### L1. Health Endpoint No Rate Limiting
- **File:** `src/app/api/health/route.ts`

### L2. Onboarding Status Information Disclosure
- **File:** `src/app/api/onboarding/status/route.ts:16-19`

### L3. Schema: No Soft Delete
- **File:** `prisma/schema.prisma` (all models)

### L4. Schema: `SecondHandRecord.nidNumber` No Unique Constraint
- **File:** `prisma/schema.prisma:401`

### L5. Cookie Name Collision Risk
- **File:** `src/app/api/auth/[...nextauth]/route.ts:13`

### L6. Inconsistent `try/catch` Patterns
- **Files:** Multiple

### L7. Error Messages Leak Internal Details
- **File:** `src/app/api/products/[id]/route.ts:54`

### L8. No CORS Configuration
- **Files:** All API routes

### L9. Schema: `DailyBalance.date` Precision Issues
- **File:** `prisma/schema.prisma:273`

### L10. `isAdmin` and `isStaff` Helpers Not Used
- **File:** `src/lib/auth.ts:22-28`

### L11. Session Role Cast Without Validation
- **Files:** Multiple API routes

### L12. MANAGER Lacks `product:delete` and `sale:view_all`
- **File:** `src/lib/services/rbac.ts:64-76`

### L13. No Low Stock Alert Mechanism
- **File:** `src/app/api/products/route.ts`

### L14. Supplier Due Adjustment Not in Transaction
- **File:** `src/lib/services/supplier.ts:94-111`

### L15. Loan Payment `Promise.all` is Pointless
- **File:** `src/lib/services/loan.ts:84-92`

### L16. `formatCurrency` Uses `any` Type
- **File:** `src/lib/utils.ts:1`

### L17. `generateInvoiceId` Not Race-Condition Safe
- **File:** `src/lib/barcode.ts:32-38`

### L18. Dashboard Page Has No `useMemo` for Computed Values
- **File:** `src/app/dashboard/page.tsx:140-157`

### L19. POS Page Renders All Products Without Virtualization
- **File:** `src/app/pos/page.tsx:611-638`

### L20. POS Page `filteredProducts` Recomputes Every Render
- **File:** `src/app/pos/page.tsx:283-287`

### L21. Dashboard Makes Two Separate API Calls
- **File:** `src/app/dashboard/page.tsx:99-137`

### L22. Large Component Trees Without Code Splitting
- **Files:** `pos/page.tsx` (913 lines), `dashboard/page.tsx` (419 lines)

### L23. `getToken` Called on Every Request
- **File:** `src/proxy.ts:12`

### L24. No `optimizePackageImports` in Next.js Config
- **File:** `next.config.ts`

### L25. No `output: 'standalone'` for Production
- **File:** `next.config.ts`

### L26. Prisma Client Singleton Pattern Incomplete
- **File:** `src/lib/prisma.ts:21-24`

### L27. No `$extends` for Soft Deletes or Audit
- **File:** `src/lib/prisma.ts`

### L28. `bcryptjs` Has No Native Fallback
- **File:** `package.json:17`

### L29. `react-to-print` Included But Not Used in Most Pages
- **File:** `package.json:27`

### L30. Wholesale Page No Minimum Quantity Enforcement
- **File:** `src/app/sales/wholesale/page.tsx:42-49`

### L31. Online Sale Page No Customer Required
- **File:** `src/app/sales/online/page.tsx:54-69`

### L32. Due Sale Page Hardcoded Expected Today
- **File:** `src/app/sales/due/page.tsx:515`

### L33. Second-Hand "Blacklist Check" is Fake UI
- **File:** `src/app/second-hand/page.tsx:211-221`

### L34. Delete Confirmation Uses Native `confirm()`
- **File:** `src/app/users/page.tsx:71`

### L35. Invoice Settings Preview Uses Hardcoded Data
- **File:** `src/app/settings/invoice/page.tsx:169-185`

### L36. Emoji in Admin Summary
- **File:** `src/app/onboarding/page.tsx:407`

### L37. Brand Name Mismatch
- **File:** `src/components/layout/sidebar.tsx:86` vs `layout.tsx`

### L38. SidebarWrapper Renders on Every Page
- **File:** `src/app/layout.tsx:47`

### L39. Missing Cleanup in Multiple useEffect Hooks
- **Files:** Multiple pages

### L40. No Global State Management
- **Severity:** Low

### L41. Empty States Missing on Several Pages
- **Files:** `sales/emi/page.tsx`, `sales/online/page.tsx`, `sales/wholesale/page.tsx`

### L42. Concurrent Cart Modifications
- **Severity:** Low

### L43. `window.print()` Without Printer Check
- **Files:** Multiple

### L44. No Dependency for Form Validation
- **Severity:** Low

### L45. No `suppressHydrationWarning` Needed
- **File:** `src/app/layout.tsx:45`

---

## PERFORMANCE OPTIMIZATION PLAN

### Priority 1: Quick Wins (1-2 hours each)

| # | Fix | File | Est. Savings |
|---|-----|------|-------------|
| 1 | Replace `CapitalService.findMany` with raw `SUM(cost * stock)` query | `transaction.ts:202` | 50-100ms |
| 2 | Replace O(n×m) chart filtering with single-pass Map | `dashboard/stats:91` | 100-300ms |
| 3 | Use `select` instead of `include` in `sale.findAll()` | `sale.ts:254` | 200-500ms |
| 4 | Add timeouts to SMS calls | `alert-service.ts:76` | Prevents 30s+ blocks |
| 5 | Add `optimizePackageImports` to `next.config.ts` | `next.config.ts` | -100-200KB bundle |
| 6 | Cache `ensureAccounts` account map per store | `posting.ts:51` | 50-100ms/sale |

### Priority 2: Medium Effort (Half day each)

| # | Fix | Description |
|---|-----|-------------|
| 7 | Add in-memory response caching with TTL | Dashboard, products, customers |
| 8 | Add pagination to all list endpoints | Sales, products, transactions |
| 9 | Batch stock updates with `Promise.all` | `sale.ts:139` |
| 10 | Add database indexes on frequently filtered columns | `Customer.phone`, `Sale.dueAmount`, etc. |
| 11 | Migrate to PostgreSQL | Eliminates SQLite concurrency issues |

### Priority 3: Long-term (1-2 days each)

| # | Fix | Description |
|---|-----|-------------|
| 12 | Implement streaming export for large datasets | `dailyActivity.ts:334` |
| 13 | Add React.memo to all UI components | Prevent unnecessary re-renders |
| 14 | Virtualize POS product grid | `react-window` |
| 15 | Combine dashboard API calls into single endpoint | Reduce round-trips |
| 16 | Implement soft deletes across all models | Audit trail preservation |

---

## RBAC Coverage Gaps

| Permission | Defined | Used in Routes |
|-----------|---------|----------------|
| `sale:cancel` | Yes | Never |
| `sale:view_all` | Yes | Never |
| `supplier:due_adjust` | Yes | Never |
| `expense:view` | Yes | Never |
| `expense:delete` | Yes | Never |
| `cash:opening` | Yes | Never |
| `cash:closing` | Yes | Never |
| `cash:view` | Yes | Never |
| `secondhand:edit` | Yes | Never |
| `document:view` | Yes | Never |
| `document:upload` | Yes | Never |
| `user:update` | Yes | Never |
| `store:view_all` | Yes | Never |

---

## SCHEMA-LEVEL ISSUES

| # | Issue | File | Recommendation |
|---|-------|------|----------------|
| S1 | SQLite as production database | `schema.prisma:7` | Migrate to PostgreSQL |
| S2 | `Payment.saleId` nullable, no FK enforcement | `schema.prisma:202-206` | Add FK constraint |
| S3 | `JournalLine` no direct `storeId` | `schema.prisma:384-395` | Add storeId field |
| S4 | `Transaction.userId` not a FK | `schema.prisma:338` | Add FK relation |
| S5 | No soft delete on any model | All models | Add `deletedAt DateTime?` |
| S6 | `SecondHandRecord.nidNumber` no unique constraint | `schema.prisma:401` | Add `@unique` |

---

## RECOMMENDED FIX ORDER

### Phase 1: Emergency (Today)
1. **C1** — Fix broken refund endpoint
2. **C2** — Add auth to alerts endpoint
3. **C10, C11** — Fix sidebar role filtering
4. **C12** — Fix NID file upload
5. **C13** — Add duplicate IMEI validation
6. **C18** — Fix mobile POS property names

### Phase 2: Financial Integrity (This Week)
7. **C3** — Fix partial refund due wipe
8. **C4** — Block customer deletion with dues
9. **C5** — Fix floating-point arithmetic
10. **C6** — Fix refund transaction amount
11. **C7** — Fix partial refund payment status
12. **C14** — Link second-hand to accounting
13. **C15** — Add isLocked check to saveClosing
14. **C16** — Fix profit clamping
15. **H1** — Add permission checks to all 12 endpoints
16. **H2** — Add view permission checks to 8 endpoints

### Phase 3: Security & Data Integrity (Next Week)
17. **H3** — Fix IDOR in product stock
18. **H4, H5** — Add Zod validation to user/loan creation
19. **H6** — Fix partial refund stock restoration
20. **H7** — Fix customer due race condition
21. **H9** — Change product delete to Restrict
22. **H10** — Fix loan payment amount
23. **H11** — Fix timezone mismatch
24. **H27** — Add Zod validation to all POST endpoints
25. **M1, M2** — Validate totalAmount and paid+due
26. **M35** — Add missing routes to proxy matcher
27. **M38** — Add NEXTAUTH_SECRET to .env.example

### Phase 4: Performance (Following Weeks)
28. **P1-P6** — Quick wins (caching, select vs include, SMS timeout)
29. **P7-P11** — Medium effort (pagination, batching, indexes)
30. **P12-P16** — Long-term (streaming, memoization, virtualization)

### Phase 5: Production Readiness
31. **C8, S1** — Migrate SQLite to PostgreSQL
32. **S2-S6** — Schema fixes
33. **L3, L16** — Soft deletes, audit trail
