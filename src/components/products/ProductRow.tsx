"use client";

import { useState } from "react";
import { Pencil, Printer, Trash2, Check, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { StockBadge } from "./StockBadge";

interface ProductRowProps {
  product: any;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (id: string, updates: Record<string, any>) => Promise<void>;
  onDelete: (id: string) => void;
  onPrint: (product: any) => void;
  onStockAdjust: (product: any) => void;
}

export function ProductRow({ product, selected, onSelect, onUpdate, onDelete, onPrint, onStockAdjust }: ProductRowProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const startEdit = (field: string) => {
    setEditing(field);
    setDraft({ [field]: product[field] ?? "" });
  };

  const cancelEdit = () => { setEditing(null); setDraft({}); };

  const saveEdit = async (field: string) => {
    setSaving(true);
    try {
      await onUpdate(product.id, { [field]: draft[field] });
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const EditableCell = ({ field, format }: { field: string; format?: (v: any) => string }) => {
    if (editing === field) {
      return (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            type={typeof product[field] === "number" ? "number" : "text"}
            value={draft[field]}
            onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(field); if (e.key === "Escape") cancelEdit(); }}
            className="w-full px-2 py-1 rounded border border-primary text-sm bg-surface"
          />
          <button onClick={() => saveEdit(field)} disabled={saving} className="text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
          <button onClick={cancelEdit} className="text-secondary hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
      );
    }
    return (
      <span className="group cursor-pointer" onClick={() => startEdit(field)}>
        {format ? format(product[field]) : (product[field] || "-")}
        <Pencil className="w-3 h-3 inline ml-1 opacity-0 group-hover:opacity-100 text-secondary" />
      </span>
    );
  };

  const STATUS_OPTIONS = ["ACTIVE", "INACTIVE"];

  return (
    <tr className={`hover:bg-background/50 transition-colors ${selected ? "bg-primary/5" : ""}`}>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="rounded border-border"
        />
      </td>
      <td className="px-4 py-3">
        <EditableCell field="name" />
        <p className="text-xs text-secondary">{product.brand}</p>
      </td>
      <td className="px-4 py-3">
        {editing === "category" ? (
          <div className="flex items-center gap-1">
            <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="px-2 py-1 rounded border border-primary text-xs bg-surface">
              {["SMARTPHONE", "TABLET", "ACCESSORIES", "PARTS", "EARBUDS", "GADGET"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={() => saveEdit("category")} disabled={saving} className="text-green-600"><Check className="w-3 h-3" /></button>
            <button onClick={cancelEdit} className="text-secondary"><X className="w-3 h-3" /></button>
          </div>
        ) : (
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded cursor-pointer hover:bg-primary/20" onClick={() => startEdit("category")}>
            {product.category}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-sm">{product.storage || "-"}</td>
      <td className="px-4 py-3 text-sm">{product.color || "-"}</td>
      <td className="px-4 py-3 font-bold"><EditableCell field="price" format={formatCurrency} /></td>
      <td className="px-4 py-3 text-secondary"><EditableCell field="cost" format={formatCurrency} /></td>
      <td className="px-4 py-3">
        <span className="cursor-pointer" onClick={() => onStockAdjust(product)}>
          <StockBadge stock={product.stock || 0} minStock={product.minStock || 5} />
        </span>
      </td>
      <td className="px-4 py-3">
        {editing === "status" ? (
          <div className="flex items-center gap-1">
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className="px-2 py-1 rounded border border-primary text-xs bg-surface">
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => saveEdit("status")} disabled={saving} className="text-green-600"><Check className="w-3 h-3" /></button>
            <button onClick={cancelEdit} className="text-secondary"><X className="w-3 h-3" /></button>
          </div>
        ) : (
          <span className={`text-xs font-bold px-2 py-1 rounded cursor-pointer ${product.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`} onClick={() => startEdit("status")}>
            {product.status || "ACTIVE"}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => onStockAdjust(product)} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-500 hover:text-white transition-all" title="Add Stock">
            <span className="text-xs font-bold">+</span>
          </button>
          <button onClick={() => onPrint(product)} className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all" title="Print Label">
            <Printer className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(product.id)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
