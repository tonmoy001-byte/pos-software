"use client";

import { useState, useEffect, use } from "react";
import { Building2, Save, AlertTriangle, CheckCircle, Users, Package, ShoppingCart } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Button, Input } from "@/components/ui";

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  const handleStatusChange = async (newStatus: string) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/stores/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: `Store ${newStatus === "active" ? "activated" : "suspended"}` });
        fetchStore();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to change status" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to change status" });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-secondary text-center py-8">Loading...</p>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-secondary text-center py-8">Store not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Building2 className="w-6 h-6" /> {store.name}
      </h1>

      {message && (
        <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
          message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        }`}>
          {message.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {message.text}
          <button className="ml-auto" onClick={() => setMessage(null)}>✕</button>
        </div>
      )}

      {/* Store Info */}
      <section className="bg-surface rounded-2xl border border-border p-6 space-y-4">
        <h2 className="text-[10px] font-bold text-secondary uppercase tracking-widest">Store Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Store Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <div className="space-y-1">
            <label className="text-xs font-bold text-secondary uppercase ml-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-border outline-none transition-all duration-200 focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-secondary/50 min-h-[100px]"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </section>

      {/* Subscription Info */}
      <section className="bg-surface rounded-2xl border border-border p-6 space-y-4">
        <h2 className="text-[10px] font-bold text-secondary uppercase tracking-widest">Subscription</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-secondary uppercase ml-1">Plan</label>
            <div className="px-4 py-3 rounded-xl border border-border bg-background">
              {store.subscription?.plan?.displayName || "No Plan"}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-secondary uppercase ml-1">Status</label>
            <div className="px-4 py-3 rounded-xl border border-border bg-background">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                store.subscription?.status === "active" ? "bg-green-100 text-green-800" :
                store.subscription?.status === "trial" ? "bg-blue-100 text-blue-800" :
                "bg-gray-100 text-gray-800"
              }`}>
                {store.subscription?.status || "None"}
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-secondary uppercase ml-1">Trial End</label>
            <div className="px-4 py-3 rounded-xl border border-border bg-background">
              {formatDate(store.subscription?.trialEnd)}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-surface rounded-2xl border border-border p-6 space-y-4">
        <h2 className="text-[10px] font-bold text-secondary uppercase tracking-widest">Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-4 rounded-xl border border-border">
            <Package className="w-8 h-8 text-primary" />
            <div>
              <div className="text-2xl font-bold">{store._count?.products || 0}</div>
              <div className="text-xs text-secondary">Products</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl border border-border">
            <ShoppingCart className="w-8 h-8 text-primary" />
            <div>
              <div className="text-2xl font-bold">{store._count?.sales || 0}</div>
              <div className="text-xs text-secondary">Sales</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl border border-border">
            <Users className="w-8 h-8 text-primary" />
            <div>
              <div className="text-2xl font-bold">{store._count?.customers || 0}</div>
              <div className="text-xs text-secondary">Customers</div>
            </div>
          </div>
        </div>
      </section>

      {/* Users */}
      <section className="bg-surface rounded-2xl border border-border p-6 space-y-4">
        <h2 className="text-[10px] font-bold text-secondary uppercase tracking-widest">Users</h2>
        <div className="space-y-2">
          {store.users?.map((user: any) => (
            <div key={user.id} className="flex items-center justify-between p-3 rounded-xl border border-border">
              <div>
                <div className="font-medium">{user.name}</div>
                <div className="text-xs text-secondary">@{user.username}</div>
              </div>
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                {user.role}
              </span>
            </div>
          ))}
          {(!store.users || store.users.length === 0) && (
            <p className="text-secondary text-center py-4">No users</p>
          )}
        </div>
      </section>

      {/* Actions */}
      <section className="bg-surface rounded-2xl border border-border p-6 space-y-4">
        <h2 className="text-[10px] font-bold text-secondary uppercase tracking-widest">Actions</h2>
        <div className="flex items-center gap-4">
          {store.status === "active" || store.status === "trial" ? (
            <Button
              variant="danger"
              onClick={() => handleStatusChange("suspended")}
              disabled={saving}
            >
              <AlertTriangle className="w-4 h-4" /> Suspend Store
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => handleStatusChange("active")}
              disabled={saving}
            >
              <CheckCircle className="w-4 h-4" /> Activate Store
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
