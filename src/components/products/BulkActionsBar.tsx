"use client";

import { Trash2, Tag, ToggleLeft, DollarSign, X } from "lucide-react";
import { Button } from "@/components/ui";

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onDelete: () => void;
  onSetCategory: () => void;
  onSetStatus: () => void;
  onUpdatePrice: () => void;
}

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onDelete,
  onSetCategory,
  onSetStatus,
  onUpdatePrice,
}: BulkActionsBarProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface border border-border rounded-2xl px-6 py-3 shadow-2xl flex items-center gap-4">
      <span className="text-sm font-bold">{selectedCount} selected</span>
      <div className="h-6 w-px bg-border" />
      <Button size="sm" variant="ghost" onClick={onUpdatePrice}>
        <DollarSign className="w-4 h-4" /> Price
      </Button>
      <Button size="sm" variant="ghost" onClick={onSetCategory}>
        <Tag className="w-4 h-4" /> Category
      </Button>
      <Button size="sm" variant="ghost" onClick={onSetStatus}>
        <ToggleLeft className="w-4 h-4" /> Status
      </Button>
      <Button size="sm" variant="danger" onClick={onDelete}>
        <Trash2 className="w-4 h-4" /> Delete
      </Button>
      <Button size="sm" variant="ghost" onClick={onClearSelection}>
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
