"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { ProductRow } from "./ProductRow";

interface SortConfig {
  field: string;
  direction: "asc" | "desc";
}

interface ProductTableProps {
  products: any[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  onSort: (field: string) => void;
  sortConfig: SortConfig | null;
  onUpdate: (id: string, updates: Record<string, any>) => Promise<void>;
  onDelete: (id: string) => void;
  onPrint: (product: any) => void;
  onStockAdjust: (product: any) => void;
}

const COLUMNS = [
  { field: "name", label: "Product" },
  { field: "category", label: "Category" },
  { field: "storage", label: "Storage" },
  { field: "color", label: "Color" },
  { field: "price", label: "Price" },
  { field: "cost", label: "Cost" },
  { field: "stock", label: "Stock" },
  { field: "status", label: "Status" },
];

export function ProductTable({
  products, selectedIds, onToggleSelect, onToggleAll, onSort, sortConfig, onUpdate, onDelete, onPrint, onStockAdjust,
}: ProductTableProps) {
  const allSelected = products.length > 0 && products.every((p) => selectedIds.has(p.id));

  const SortIcon = ({ field }: { field: string }) => {
    if (sortConfig?.field !== field) return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-50" />;
    return sortConfig.direction === "asc"
      ? <ChevronUp className="w-3 h-3 ml-1 text-primary" />
      : <ChevronDown className="w-3 h-3 ml-1 text-primary" />;
  };

  return (
    <div className="bg-surface rounded-2xl border border-border card-shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-background text-secondary text-[10px] font-black uppercase tracking-widest border-b border-border">
              <th className="px-4 py-3 w-10">
                <input type="checkbox" checked={allSelected} onChange={onToggleAll} className="rounded border-border" />
              </th>
              {COLUMNS.map((col) => (
                <th key={col.field} className="px-4 py-3 cursor-pointer group" onClick={() => onSort(col.field)}>
                  <span className="flex items-center">{col.label}<SortIcon field={col.field} /></span>
                </th>
              ))}
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {products.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                selected={selectedIds.has(product.id)}
                onSelect={() => onToggleSelect(product.id)}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onPrint={onPrint}
                onStockAdjust={onStockAdjust}
              />
            ))}
            {products.length === 0 && (
              <tr><td colSpan={10} className="px-6 py-10 text-center text-secondary italic">No products found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
