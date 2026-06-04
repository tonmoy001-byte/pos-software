"use client";

import { useState, useEffect, use } from "react";
import { Building2, Save, AlertTriangle, CheckCircle, Users, Package, ShoppingCart, Ban, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    description: "",
  });

  const fetchStore = async () => {
    try {
      const res = await fetch(`/api/admin/stores/${id}`);
      const data = await res.json();
      if (data.store) {
        setStore(data.store);
        setForm({
          name: data.store.name || "",
          phone: data.store.phone || "",
          email: data.store.email || "",
          description: data.store.description || "",
        });
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStore();
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/stores/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Store updated successfully" });
        fetchStore();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to update" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to update store" });
    }
    setSaving(false);
  };

  const handleSuspend = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/stores/${id}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: suspendReason }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Store suspended" });
        setShowSuspendModal(false);
        setSuspendReason("");
        fetchStore();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to suspend" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to suspend store" });
    }
    setSaving(false);
  };

  const handleActivate = async () => {
    if (!confirm("Activate this store? All users will regain access.")) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/stores/${id}/activate`, {
        method: "POST",
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Store activated" });
        fetchStore();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to activate" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to activate store" });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-gray-400 text-center py-8">Loading...</p>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-gray-400 text-center py-8">Store not found</p>
      </div>
    );
  }

  const isSuspended = store.status === "suspended";
  const isActive = store.status === "active" || store.status === "trial";

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/tenants"
          className="text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{store.name}</h1>
          <p className="text-sm text-gray-500">Tenant details and management</p>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
          message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {message.text}
          <button className="ml-auto" onClick={() => setMessage(null)}>✕</button>
        </div>
      )}

      {/* Status banner */}
      {isSuspended && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-center gap-3">
          <Ban className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">Store Suspended</p>
            {store.suspendedReason && (
              <p className="text-sm text-red-600 mt-0.5">Reason: {store.suspendedReason}</p>
            )}
          </div>
        </div>
      )}

      {/* Store Info */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Store Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Store Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Phone</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[80px]"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </section>

      {/* Subscription Info */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Subscription</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Plan</label>
            <div className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700">
              {store.subscription?.plan?.displayName || "No Plan"}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Status</label>
            <div className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                store.subscription?.status === "active" ? "bg-green-50 text-green-700" :
                store.subscription?.status === "trial" ? "bg-blue-50 text-blue-700" :
                "bg-gray-50 text-gray-600"
              }`}>
                {store.subscription?.status || "None"}
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Trial End</label>
            <div className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700">
              {formatDate(store.subscription?.trialEndsAt)}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-4 rounded-lg border border-gray-200">
            <Package className="w-8 h-8 text-indigo-600" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{store._count?.products || 0}</div>
              <div className="text-xs text-gray-400">Products</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-lg border border-gray-200">
            <ShoppingCart className="w-8 h-8 text-indigo-600" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{store._count?.sales || 0}</div>
              <div className="text-xs text-gray-400">Sales</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-lg border border-gray-200">
            <Users className="w-8 h-8 text-indigo-600" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{store._count?.customers || 0}</div>
              <div className="text-xs text-gray-400">Customers</div>
            </div>
          </div>
        </div>
      </section>

      {/* Users */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Users</h2>
        <div className="space-y-2">
          {store.users?.map((user: any) => (
            <div key={user.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
              <div>
                <div className="font-medium text-gray-900">{user.name}</div>
                <div className="text-xs text-gray-400">@{user.username}</div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                {user.role}
              </span>
            </div>
          ))}
          {(!store.users || store.users.length === 0) && (
            <p className="text-gray-400 text-center py-4">No users</p>
          )}
        </div>
      </section>

      {/* Actions */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Actions</h2>
        <div className="flex items-center gap-4">
          {isSuspended ? (
            <button
              onClick={handleActivate}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" /> Activate Store
            </button>
          ) : (
            <button
              onClick={() => setShowSuspendModal(true)}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Ban className="w-4 h-4" /> Suspend Store
            </button>
          )}
        </div>
      </section>

      {/* Suspend modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Suspend Store</h3>
            <p className="text-sm text-gray-500">
              This will block all users from accessing this store. Are you sure?
            </p>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Reason (optional)</label>
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="e.g. Payment overdue, Terms violation..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[80px]"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowSuspendModal(false); setSuspendReason(""); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSuspend}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? "Suspending..." : "Suspend Store"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
