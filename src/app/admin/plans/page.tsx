"use client";

import { useState, useEffect } from "react";
import { CreditCard, Plus, Edit2, Trash2 } from "lucide-react";

export default function PlansPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [form, setForm] = useState({
    name: "",
    displayName: "",
    maxProducts: "100",
    maxUsers: "3",
    maxBranches: "1",
    features: "",
  });

  const fetchPlans = async () => {
    try {
      const res = await fetch("/api/admin/plans");
      const data = await res.json();
      setPlans(data.plans || []);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const openCreateForm = () => {
    setEditingPlan(null);
    setForm({ name: "", displayName: "", maxProducts: "100", maxUsers: "3", maxBranches: "1", features: "" });
    setShowForm(true);
  };

  const openEditForm = (plan: any) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      displayName: plan.displayName,
      maxProducts: String(plan.maxProducts),
      maxUsers: String(plan.maxUsers),
      maxBranches: String(plan.maxBranches),
      features: (() => { try { return JSON.parse(plan.features || "[]").join(", "); } catch { return ""; } })(),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    const payload = {
      name: form.name,
      displayName: form.displayName,
      maxProducts: parseInt(form.maxProducts) || 100,
      maxUsers: parseInt(form.maxUsers) || 3,
      maxBranches: parseInt(form.maxBranches) || 1,
      features: form.features ? form.features.split(",").map((f) => f.trim()).filter(Boolean) : [],
    };

    try {
      const url = editingPlan ? `/api/admin/plans/${editingPlan.id}` : "/api/admin/plans";
      const method = editingPlan ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setMessage({ type: "success", text: editingPlan ? "Plan updated" : "Plan created" });
        setShowForm(false);
        fetchPlans();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to save" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to save plan" });
    }
    setSaving(false);
  };

  const handleDelete = async (planId: string) => {
    if (!confirm("Are you sure you want to delete this plan?")) return;
    try {
      const res = await fetch(`/api/admin/plans/${planId}`, { method: "DELETE" });
      if (res.ok) {
        setMessage({ type: "success", text: "Plan deleted" });
        fetchPlans();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to delete" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to delete plan" });
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plans</h1>
          <p className="text-sm text-gray-500 mt-1">Manage subscription plans</p>
        </div>
        <button
          onClick={openCreateForm}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Create Plan
        </button>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
          message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message.type === "success" ? "✓" : "⚠"} {message.text}
          <button className="ml-auto" onClick={() => setMessage(null)}>✕</button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Plan</th>
              <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Products</th>
              <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Users</th>
              <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Branches</th>
              <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Subscribers</th>
              <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
              <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-gray-400">Loading...</td>
              </tr>
            ) : plans.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-gray-400">No plans found</td>
              </tr>
            ) : (
              plans.map((plan) => (
                <tr key={plan.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">{plan.displayName}</div>
                    <div className="text-xs text-gray-400">{plan.name}</div>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{plan.maxProducts}</td>
                  <td className="px-5 py-3 text-gray-500">{plan.maxUsers}</td>
                  <td className="px-5 py-3 text-gray-500">{plan.maxBranches}</td>
                  <td className="px-5 py-3 text-gray-500">{plan._count?.subscriptions || 0}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      plan.isActive ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-600"
                    }`}>
                      {plan.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditForm(plan)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(plan.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">{editingPlan ? "Edit Plan" : "Create Plan"}</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Internal Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={!!editingPlan}
                  placeholder="e.g. pro"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Display Name</label>
                <input
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="e.g. Professional"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Max Products</label>
                  <input
                    type="number"
                    value={form.maxProducts}
                    onChange={(e) => setForm({ ...form, maxProducts: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Max Users</label>
                  <input
                    type="number"
                    value={form.maxUsers}
                    onChange={(e) => setForm({ ...form, maxUsers: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Max Branches</label>
                  <input
                    type="number"
                    value={form.maxBranches}
                    onChange={(e) => setForm({ ...form, maxBranches: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Features (comma-separated)</label>
                <input
                  value={form.features}
                  onChange={(e) => setForm({ ...form, features: e.target.value })}
                  placeholder="e.g. Reports, Inventory, Multi-branch"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : editingPlan ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
