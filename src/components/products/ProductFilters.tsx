"use client";

import { Search, X } from "lucide-react";

const CATEGORIES = ["ALL", "SMARTPHONE", "TABLET", "ACCESSORIES", "PARTS", "EARBUDS", "GADGET"];
const STOCK_FILTERS = [
  { label: "All Stock", value: "all" },
  { label: "In Stock", value: "in_stock" },
  { label: "Low Stock", value: "low_stock" },
  { label: "Out of Stock", value: "out_of_stock" },
];

interface ProductFiltersProps {
  search: string;
  category: string;
  stockStatus: string;
  onSearchChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onStockStatusChange: (v: string) => void;
}

export function ProductFilters({
  search,
  category,
  stockStatus,
  onSearchChange,
  onCategoryChange,
  onStockStatusChange,
}: ProductFiltersProps) {
  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
          <input
            type="text"
            placeholder="Search by name, barcode, brand..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border outline-none focus:border-primary text-sm"
          />
          {search && (
            <button onClick={() => onSearchChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <select
          value={stockStatus}
          onChange={(e) => onStockStatusChange(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-border bg-surface text-sm"
        >
          {STOCK_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${
              category === cat
                ? "bg-primary text-white"
                : "bg-surface border border-border text-secondary hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}
