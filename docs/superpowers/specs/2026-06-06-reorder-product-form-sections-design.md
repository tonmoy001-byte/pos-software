# Reorder Product Form Sections + Remove 3 Fields

**Date:** 2026-06-06
**Status:** Approved
**Scope:** `src/app/products/new/page.tsx` only

## Goal

Reorder the 6 FormSectionCards in the Add New Product page, and remove 3 fields (Product Type, Condition, Network) from the form. Keep 2-column grid layout. Keep Additional Information section (only contains Product Status + Tags).

## Final Section Order (2-column grid, left-to-right, top-to-bottom)

1. **Basic Information** — 10 fields:
   - Product Name *
   - SKU / Product Code *
   - Barcode (optional, auto-generates if blank)
   - Brand *
   - Category *
   - Model Number
   - RAM
   - Storage / Variant
   - Color
   - Description
2. **Pricing & Cost** — 4 fields:
   - Cost Price *
   - Selling Price *
   - Tax / VAT
   - Unit *
3. **Stock & Inventory** — 6 fields:
   - Opening Stock
   - Opening Cost (auto-calculated = stock × cost)
   - Warehouse / Store
   - Minimum Stock Alert
   - Reorder Quantity
   - Track By IMEI / Serial Number
4. **Product Image** — image uploader
5. **Supplier & Warranty** — 3 fields:
   - Default Supplier
   - Purchase Warranty
   - Sales Warranty
6. **Additional Information** — 2 fields:
   - Product Status
   - Tags

## Removed Fields

The following 3 fields are removed from the form entirely:

- **Product Type** (was in Basic Information)
- **Condition** (was in Basic Information)
- **Network** (was in Basic Information)

## productType Submission

The Zod schema (`src/lib/validators/product.ts`) requires `productType` to be one of `SERIALIZED | NON_SERIALIZED | SERVICE`. To keep the API and schema unchanged, the form's submit handler will hardcode `values.productType = "NON_SERIALIZED"` before building the payload.

## Data, API, and Schema Unchanged

- Zod schema (`productFormSchema`) — unchanged
- API route `POST /api/products` — unchanged
- Prisma model `Product` — unchanged
- Form components (`TextInput`, `SelectInput`, etc.) — unchanged
- Only the JSX section ordering + 3 field removals + 1 line in `handleSubmit`

## Implementation

1. Move `<FormSectionCard title="Stock & Inventory">` block (lines 388-447) to position 3
2. Move `<FormSectionCard title="Product Image">` block (lines 539-548) to position 4
3. Move `<FormSectionCard title="Supplier & Warranty">` block (lines 449-484) to position 5
4. Move `<FormSectionCard title="Additional Information">` block (lines 486-537) to position 6
5. Delete the following input components from Basic Information:
   - `<SelectInput label="Product Type">` (lines 254-261)
   - `<SelectInput label="Condition">` (lines 289-296)
   - `<SelectInput label="Network">` (lines 313-320)
6. In `handleSubmit` (line 96), add `values.productType = "NON_SERIALIZED"` before building the payload
7. Remove unused import: `NETWORK_OPTIONS` from `@/lib/validators/product` import (line 13)
8. Leave the `condition` field in the Zod schema and the `values.condition` defaults intact — they remain valid (the field is `optional().nullable()` and payload sends `null` when undefined). Only the UI input for Condition is removed.

Wait — `NETWORK_OPTIONS` is also used in `useMemo` or other? Need to verify. Will check during implementation.

## Verification

1. `npx next build` succeeds with 43/43 pages, 0 type errors
2. Dev-browser screenshot of `/products/new` shows sections in the new order with Product Type, Condition, Network fields gone
3. E2E: fill form (Name, SKU, Brand via dropdown, Category via dropdown, Cost=1000, Selling=1500) → submit → POST /api/products returns 201 → redirect to /inventory
4. Smoke test key pages: /admin 200, /suspended 200, /api/health 200, /auth/signin 200

## Out of Scope

- No data model changes
- No API changes
- No Zod schema changes
- No new components
- No new validation rules
- No change to other pages (inventory list, products list, etc.)
