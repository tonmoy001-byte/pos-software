"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Building2, Search, Filter, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui";

const STATUS_OPTIONS = ["", "active", "trial", "suspended", "pending_approval", "expired"];

export default function TenantListPage() {
  const [stores, setStores] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchStores = async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);

    try {
      const res = await fetch(`/api/admin/stores?${params}`);
      const data = await res.json();
      setStores(data.stores || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, [page, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchStores();
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-green-100 text-green-800",
      trial: "bg-blue-100 text-blue-800",
      suspended: "bg-red-100 text-red-800",
      pending_approval: "bg-yellow-100 text-yellow-800",
      expired: "bg-gray-100 text-gray-800",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-800"}`}>
        {status.replace(/_/g, " ")}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Building2 className="w-6 h-6" /> Tenant Management
      </h1>

      {/* Filters */}
      <div className="bg-surface rounded-2xl border border-border p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
              <input
                type="text"
                placeholder="Search by store or owner name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-xl bg-surface focus:outline-none focus:border-primary"
              />
            </div>
            <Button type="submit" size="sm">Search</Button>
          </form>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-secondary" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-surface"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.filter(Boolean).map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>

          <span className="text-sm text-secondary">{total} stores</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-[10px] font-bold text-secondary uppercase tracking-widest">Store</th>
              <th className="px-4 py-3 text-[10px] font-bold text-secondary uppercase tracking-widest">Owner</th>
              <th className="px-4 py-3 text-[10px] font-bold text-secondary uppercase tracking-widest">Status</th>
              <th className="px-4 py-3 text-[10px] font-bold text-secondary uppercase tracking-widest">Plan</th>
              <th className="px-4 py-3 text-[10px] font-bold text-secondary uppercase tracking-widest">Products</th>
              <th className="px-4 py-3 text-[10px] font-bold text-secondary uppercase tracking-widest">Sales</th>
              <th className="px-4 py-3 text-[10px] font-bold text-secondary uppercase tracking-widest">Created</th>
              <th className="px-4 py-3 text-[10px] font-bold text-secondary uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-secondary">Loading...</td>
              </tr>
            ) : stores.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-secondary">No stores found</td>
              </tr>
            ) : (
              stores.map((store) => (
                <tr key={store.id} className="border-b border-border hover:bg-background/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{store.name}</div>
                    <div className="text-xs text-secondary">{store.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-secondary">
                    {store.users?.[0]?.name || "-"}
                  </td>
                  <td className="px-4 py-3">{statusBadge(store.status)}</td>
                  <td className="px-4 py-3 text-secondary">
                    {store.subscription?.plan?.displayName || "No Plan"}
                  </td>
                  <td className="px-4 py-3 text-secondary">{store._count?.products || 0}</td>
                  <td className="px-4 py-3 text-secondary">{store._count?.sales || 0}</td>
                  <td className="px-4 py-3 text-secondary text-xs">{formatDate(store.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/(admin)/tenants/${store.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" /> View
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="w-4 h-4" /> Previous
          </Button>
          <span className="text-sm">{page} / {totalPages}</span>
          <Button variant="ghost" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
