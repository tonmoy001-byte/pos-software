"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Building2, Search, Filter, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { formatDate } from "@/lib/utils";

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
      active: "bg-green-50 text-green-700",
      trial: "bg-blue-50 text-blue-700",
      suspended: "bg-red-50 text-red-700",
      pending_approval: "bg-yellow-50 text-yellow-700",
      expired: "bg-gray-50 text-gray-600",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || "bg-gray-50 text-gray-600"}`}>
        {status.replace(/_/g, " ")}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
          <p className="text-sm text-gray-500 mt-1">{total} stores registered</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by store or owner name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Search
            </button>
          </form>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.filter(Boolean).map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Store</th>
              <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Owner</th>
              <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
              <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Plan</th>
              <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Products</th>
              <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sales</th>
              <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Created</th>
              <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-gray-400">Loading...</td>
              </tr>
            ) : stores.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-gray-400">No stores found</td>
              </tr>
            ) : (
              stores.map((store) => (
                <tr key={store.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">{store.name}</div>
                    <div className="text-xs text-gray-400">{store.phone}</div>
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {store.users?.[0]?.name || "-"}
                  </td>
                  <td className="px-5 py-3">{statusBadge(store.status)}</td>
                  <td className="px-5 py-3 text-gray-500">
                    {store.subscription?.plan?.displayName || "No Plan"}
                  </td>
                  <td className="px-5 py-3 text-gray-500">{store._count?.products || 0}</td>
                  <td className="px-5 py-3 text-gray-500">{store._count?.sales || 0}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{formatDate(store.createdAt)}</td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/tenants/${store.id}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      <Eye className="w-4 h-4" /> View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4 inline" /> Previous
          </button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next <ChevronRight className="w-4 h-4 inline" />
          </button>
        </div>
      )}
    </div>
  );
}
