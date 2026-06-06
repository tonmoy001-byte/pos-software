# Combine Pricing & Stock Card + Remove Reorder Quantity

**Date:** 2026-06-06
**Status:** Approved
**Scope:** `src/app/products/new/page.tsx` only

## Goal

Combine the "Pricing & Cost" and "Stock & Inventory" FormSectionCards into a single card titled "Pricing & Stock" to fill the empty space that currently appears below Pricing & Cost. Remove the Reorder Quantity field from the Stock section.

## Final Card Structure

**New FormSectionCard:**
- Title: "Pricing & Stock"
- Description: "Set pricing, stock levels, and warehouse."
- Icon: `DollarSign`
- Children:
  - Sub-heading `<h3>Pricing</h3>`
  - 2-col grid with 4 fields: Cost Price, Selling Price, Tax/VAT, Unit
  - Horizontal divider `<hr className="border-border" />`
  - Sub-heading `<h3>Stock & Inventory</h3>`
  - 2-col grid with 5 fields: Opening Stock, Opening Cost, Warehouse / Store, Minimum Stock Alert, Track By IMEI

## Sub-heading styling

```jsx
<h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
  Pricing
</h3>
```

Reuse the same style for "Stock & Inventory" sub-heading.

## Final Section Order (2-col grid)

1. **Basic Information** (unchanged)
2. **Pricing & Stock** (NEW combined card)
3. **Product Image**
4. **Supplier & Warranty**
5. **Additional Information**

In a 2-col grid this renders as:
- Row 1: [Basic] [Pricing & Stock]
- Row 2: [Image] [Supplier]
- Row 3: [Additional] [empty]

## Removed Field

- **Reorder Quantity** (was in Stock & Inventory, the only `sm:col-span-2` field in that section)
- Zod schema still has `reorderQuantity: z.coerce.number().int().min(0).optional().default(0)` — the default of 0 is used
- The form payload still includes `reorderQuantity: values.reorderQuantity` (always 0)
- No API or schema changes required

## Implementation

1. Delete the separate `<FormSectionCard title="Pricing & Cost">` block (lines 316-362)
2. Delete the separate `<FormSectionCard title="Stock & Inventory">` block (lines 364-423)
3. Add a new `<FormSectionCard title="Pricing & Stock" icon={DollarSign}>` block at position 2
4. Inside the new card, add the sub-headings, divider, and both field grids
5. Omit the Reorder Quantity NumberInput entirely

## Verification

1. `npx next build` succeeds with 43/43 pages, 0 type errors
2. Dev-browser screenshot of `/products/new` shows:
   - Combined "Pricing & Stock" card with two sub-sections
   - Reorder Quantity field absent
   - Section order: Basic → Pricing & Stock → Image → Supplier → Additional
3. E2E: fill form (Name, SKU, Brand via dropdown, Category via dropdown, Cost=1000, Selling=1500) → submit → POST /api/products returns 201 → redirect to /inventory
4. Smoke test key pages: /admin 200, /suspended 200, /api/health 200, /auth/signin 200

## Out of Scope

- No data model changes
- No API changes
- No Zod schema changes
- No new components
- No new validation rules
- No change to other pages
