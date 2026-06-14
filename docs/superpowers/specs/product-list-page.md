# Product List Page — Design Spec

## Goal
Replace the `/inventory` page with a full-featured `/products` page for product management.

## Features
- Search + filters (name, barcode, brand, category, stock status)
- Inline edit (name, price, cost, minStock, category, brand, status)
- Bulk actions (delete, set category, set status, update price)
- Sortable columns
- Stock status badges (out of stock, low stock, in stock)
- Server-side pagination (25/50/100 per page)
- Barcode printing (carried from inventory)
- Stock adjustment modal (carried from inventory)

## Architecture

### New Files
```
src/app/products/page.tsx
src/app/api/products/[id]/route.ts
src/app/api/products/bulk/route.ts
src/components/products/ProductTable.tsx
src/components/products/ProductFilters.tsx
src/components/products/ProductRow.tsx
src/components/products/BulkActionsBar.tsx
src/components/products/StockAdjustModal.tsx
src/components/products/BarcodePrintModal.tsx
src/components/products/Pagination.tsx
src/components/products/StockBadge.tsx
```

### Modified Files
- `src/components/layout/sidebar.tsx` — Inventory → Products link
- `src/app/inventory/page.tsx` — redirect to /products

## API

### GET /api/products (existing)
Query params: page, limit, search, category

### PATCH /api/products/[id] (new)
Body: { name?, price?, cost?, minStock?, category?, brand?, status? }
Returns: updated product

### DELETE /api/products/[id] (new)
Returns: { success: true }

### POST /api/products/bulk (new)
Body: { action: "delete" | "updateCategory" | "updateStatus" | "updatePrice", productIds: string[], value?: any }
Returns: { affected: number }

## Table Columns
| Column | Sort | Edit | Notes |
|--------|------|------|-------|
| ☑ | — | — | Bulk select |
| Product | ✓ | ✓ | Name + brand |
| Category | ✓ | ✓ | Badge |
| Storage | ✓ | — | Read-only |
| Color | ✓ | — | Read-only |
| Price | ✓ | ✓ | Currency |
| Cost | ✓ | ✓ | Currency |
| Stock | ✓ | — | StockBadge |
| Status | ✓ | ✓ | Toggle |
| Actions | — | — | Edit/Print/Delete |

## Stock Badges
- Red: stock = 0
- Amber: stock ≤ minStock
- Green: stock > minStock
