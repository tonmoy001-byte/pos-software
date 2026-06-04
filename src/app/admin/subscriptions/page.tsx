"use client";

import { useState, useEffect } from "react";
import { FileText, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils";

const STATUS_OPTIONS = ["", "trial", "active", "cancelled", "expired"];

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<any[]>([]);
  const [editingSub, setEditingSub] = useState<string | null>(null);
  const [editPlanId, setEditPlanId] = useState("");

  const fetchSubscriptions = async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (statusFilter) params.set("status", statusFilter);

    try {
      const res = await fetch(`/api/admin/subscriptions?${params}`);
      const data = await res.json();
      setSubscriptions(data.subscriptions || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await fetch("/api/admin/plans");
      const data = await res.json();
      setPlans(data.plans || []);
    } catch {}
  };

  useEffect(() => {
    fetchSubscriptions();
    fetchPlans();
  }, [page, statusFilter]);

  const handlePlanChange = async (subId: string) => {
    if (!editPlanId) return;
    try {
      const res = await fetch(`/api/admin/subscriptions/${subId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: editPlanId }),
      });
      if (res.ok) {
        setEditingSub(null);
        setEditPlanId("");
        fetchSubscriptions();
      }
    } catch {}
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-green-50 text-green-700",
      trial: "bg-blue-50 text-blue-700",
      cancelled: "bg-red-50 text-red-700",
      expired: "bg-gray-50 text-gray-600",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || "bg-gray-50 text-gray-600"}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
        <p className="text-sm text-gray-500 mt-1">{total} subscriptions</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Store</th>
              <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Plan</th>
              <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
              <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Trial End</th>
              <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Current Period</th>
              <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-gray-400">Loading...</td>
              </tr>
            ) : subscriptions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-gray-400">No subscriptions found</td>
              </tr>
            ) : (
              subscriptions.map((sub) => (
                <tr key={sub.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">{sub.store?.name}</div>
                    <div className="text-xs text-gray-400">Store status: {sub.store?.status}</div>
                  </td>
                  <td className="px-5 py-3">
                    {editingSub === sub.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={editPlanId}
                          onChange={(e) => setEditPlanId(e.target.value)}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Select plan</option>
                          {plans.filter((p) => p.isActive).map((p) => (
                            <option key={p.id} value={p.id}>{p.displayName}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handlePlanChange(sub.id)}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingSub(null)}
                          className="text-xs font-medium text-gray-400 hover:text-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-900 font-medium">{sub.plan?.displayName}</span>
                    )}
                  </td>
                  <td className="px-5 py-3">{statusBadge(sub.status)}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{formatDate(sub.trialEndsAt)}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {sub.currentPeriodStart ? formatDate(sub.currentPeriodStart) : "-"} → {sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : "-"}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => {
                        setEditingSub(editingSub === sub.id ? null : sub.id);
                        setEditPlanId("");
                      }}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      Change Plan
                    </button>
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
