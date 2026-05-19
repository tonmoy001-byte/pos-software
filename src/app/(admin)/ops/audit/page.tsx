"use client";

import { useState, useEffect } from "react";
import { History, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui";

const AGGREGATE_TYPES = [
  "Sale", "Product", "Customer", "Supplier", "Loan", "Transaction", "SecondHandRecord", "DailyBalance"
];

export default function AuditLogPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState("");

  const pageSize = 50;

  const fetchEvents = () => {
    const params = new URLSearchParams({ limit: String(pageSize), page: String(page) });
    if (typeFilter) params.set("type", typeFilter);
    fetch(`/api/admin/events?${params}`)
      .then(r => r.json())
      .then(data => {
        setEvents(data.events || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      })
      .catch(() => {});
  };

  useEffect(() => { fetchEvents(); }, [page, typeFilter]);

  const eventColor = (type: string) => {
    if (type.includes("CREATED") || type.includes("SALE_CREATED")) return "text-green-600";
    if (type.includes("DELETED") || type.includes("CANCELLED")) return "text-red-600";
    if (type.includes("PAYMENT") || type.includes("REFUND")) return "text-blue-600";
    return "text-yellow-600";
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <History className="w-6 h-6" /> Audit Log
      </h1>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Filter className="w-4 h-4 text-text-secondary" />
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-surface"
        >
          <option value="">All Types</option>
          {AGGREGATE_TYPES.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <span className="text-sm text-text-secondary">{total} events</span>
      </div>

      {/* Event list */}
      <div className="space-y-2">
        {events.map((event: any) => (
          <div key={event.id} className="card-shadow bg-surface rounded-lg p-4 text-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium">{event.aggregateType}</span>
              <span className={eventColor(event.type)}>{event.type}</span>
            </div>
            <div className="flex items-center justify-between text-text-secondary text-xs">
              <span>{event.aggregateId}</span>
              <span>{formatDate(event.createdAt)}</span>
            </div>
            {event.payload && (
              <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto max-h-24">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            )}
          </div>
        ))}
        {events.length === 0 && (
          <p className="text-text-secondary text-center py-8">No events found</p>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button variant="ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="w-4 h-4" /> Previous
          </Button>
          <span className="text-sm">{page} / {totalPages}</span>
          <Button variant="ghost" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
