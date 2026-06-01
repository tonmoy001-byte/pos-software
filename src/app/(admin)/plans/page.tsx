"use client";

import { useState, useEffect } from "react";
import { CreditCard, Plus, Edit2, Trash2 } from "lucide-react";
import { Button, Input, Modal } from "@/components/ui";

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
    setForm({
      name: "",
      displayName: "",
      maxProducts: "100",
      maxUsers: "3",
      maxBranches: "1",
      features: "",
    });
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
      features: (() => {
        try {
          return JSON.parse(plan.features || "[]").join(", ");
        } catch {
          return "";
        }
      })(),
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
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="w-6 h-6" /> Plans
        </h1>
        <Button onClick={openCreateForm}>
          <Plus className="w-4 h-4" /> Create Plan
        </Button>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
          message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        }`}>
          {message.type === "success" ? "✓" : "⚠"} {message.text}
          <button className="ml-auto" onClick={() => setMessage(null)}>✕</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-[10px] font-bold text-secondary uppercase tracking-widest">Plan</th>
              <th className="px-4 py-3 text-[10px] font-bold text-secondary uppercase tracking-widest">Products</th>
              <th className="px-4 py-3 text-[10px] font-bold text-secondary uppercase tracking-widest">Users</th>
              <th className="px-4 py-3 text-[10px] font-bold text-secondary uppercase tracking-widest">Branches</th>
              <th className="px-4 py-3 text-[10px] font-bold text-secondary uppercase tracking-widest">Subscribers</th>
              <th className="px-4 py-3 text-[10px] font-bold text-secondary uppercase tracking-widest">Status</th>
              <th className="px-4 py-3 text-[10px] font-bold text-secondary uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-secondary">Loading...</td>
              </tr>
            ) : plans.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-secondary">No plans found</td>
              </tr>
            ) : (
              plans.map((plan) => (
                <tr key={plan.id} className="border-b border-border hover:bg-background/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{plan.displayName}</div>
                    <div className="text-xs text-secondary">{plan.name}</div>
                  </td>
                  <td className="px-4 py-3 text-secondary">{plan.maxProducts}</td>
                  <td className="px-4 py-3 text-secondary">{plan.maxUsers}</td>
                  <td className="px-4 py-3 text-secondary">{plan.maxBranches}</td>
                  <td className="px-4 py-3 text-secondary">{plan._count?.subscriptions || 0}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      plan.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                    }`}>
                      {plan.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditForm(plan)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(plan.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingPlan ? "Edit Plan" : "Create Plan"}>
        <div className="space-y-4">
          <div className="space-y-4">
            <Input
              label="Internal Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={!!editingPlan}
              placeholder="e.g. pro"
            />
            <Input
              label="Display Name"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              placeholder="e.g. Professional"
            />
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Max Products"
                type="number"
                value={form.maxProducts}
                onChange={(e) => setForm({ ...form, maxProducts: e.target.value })}
              />
              <Input
                label="Max Users"
                type="number"
                value={form.maxUsers}
                onChange={(e) => setForm({ ...form, maxUsers: e.target.value })}
              />
              <Input
                label="Max Branches"
                type="number"
                value={form.maxBranches}
                onChange={(e) => setForm({ ...form, maxBranches: e.target.value })}
              />
            </div>
            <Input
              label="Features (comma-separated)"
              value={form.features}
              onChange={(e) => setForm({ ...form, features: e.target.value })}
              placeholder="e.g. Reports, Inventory, Multi-branch"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingPlan ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
