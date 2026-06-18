"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  label?: string;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

export function Pagination({ page, totalPages, total, limit, label = "items", onPageChange, onLimitChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-secondary">
        {total} {label}{total !== 1 ? "s" : ""} total
      </p>
      <div className="flex items-center gap-4">
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="px-3 py-1.5 rounded-lg border border-border bg-surface text-sm"
        >
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium px-2">
            {page} / {totalPages || 1}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
