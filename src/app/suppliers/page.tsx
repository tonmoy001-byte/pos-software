"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Search, 
  Plus, 
  Phone,
  MapPin,
  DollarSign,
  X,
  ChevronRight,
  Package,
  CreditCard
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustType, setAdjustType] = useState<"PAY" | "DUE">("PAY");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{type: "success"|"error", text: string} | null>(null);

  const [form, setForm] = useState({ name: "", phone: "", address: "" });

  useEffect(() => {
    async function fetchSuppliers() {
      try {
        const res = await fetch("/api/suppliers");
        const json = await res.json();
        setSuppliers(json);
      } catch (err) {
        console.error("Failed to fetch suppliers", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSuppliers();
  }, []);

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Supplier added!" });
        setIsAddOpen(false);
        setForm({ name: "", phone: "", address: "" });
        const res = await fetch("/api/suppliers");
        setSuppliers(await res.json());
      } else {
        setMessage({ type: "error", text: "Failed to add supplier" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjustDue = async () => {
    if (!selectedSupplier || !adjustAmount) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const adjustment = adjustType === "PAY" 
        ? -parseFloat(adjustAmount) 
        : parseFloat(adjustAmount);
      
      const res = await fetch(`/api/suppliers/${selectedSupplier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dueAdjustment: adjustment,
          note: `Manual adjustment`
        })
      });
      
      if (res.ok) {
        setMessage({ type: "success", text: adjustType === "PAY" ? "Payment made!" : "Credit added!" });
        setSelectedSupplier(null);
        setAdjustAmount("");
        const res = await fetch("/api/suppliers");
        setSuppliers(await res.json());
      } else {
        setMessage({ type: "error", text: "Failed" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const totalDue = suppliers.reduce((acc, s) => acc + Number(s.dueAmount || 0), 0);

  const filteredSuppliers = useMemo(() => {
    if (!searchQuery) return suppliers;
    const q = searchQuery.toLowerCase();
    return suppliers.filter(s => 
      s.name?.toLowerCase().includes(q) ||
      s.phone?.includes(q)
    );
  }, [suppliers, searchQuery]);

  if (loading) return <div className="p-8 animate-pulse text-secondary font-bold">Loading Suppliers...</div>;

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Supplier Ledger</h1>
          <p className="text-secondary">Track unpaid stock and supplier dues.</p>
        </div>
        <button 
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:scale-105 transition-all"
        >
          <Plus className="w-5 h-5" />
          Add Supplier
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface p-6 rounded-2xl border border-border card-shadow border-t-4 border-t-orange-500">
          <h3 className="text-secondary text-sm font-medium">Total Supplier Due</h3>
          <p className="text-3xl font-black text-foreground mt-1">{formatCurrency(totalDue)}</p>
          <p className="text-xs text-orange-500 mt-2 font-bold flex items-center gap-1">
            <Package className="w-3 h-3" />
            Stock on credit
          </p>
        </div>
        <div className="bg-surface p-6 rounded-2xl border border-border card-shadow border-t-4 border-t-green-500">
          <h3 className="text-secondary text-sm font-medium">Active Suppliers</h3>
          <p className="text-3xl font-black text-foreground mt-1">{suppliers.filter(s => s.dueAmount > 0).length}</p>
          <p className="text-xs text-green-500 mt-2 font-bold flex items-center gap-1">
            <ChevronRight className="w-3 h-3" />
            With pending dues
          </p>
        </div>
        <div className="bg-surface p-6 rounded-2xl border border-border card-shadow border-t-4 border-t-blue-500">
          <h3 className="text-secondary text-sm font-medium">All Suppliers</h3>
          <p className="text-3xl font-black text-foreground mt-1">{suppliers.length}</p>
          <p className="text-xs text-blue-500 mt-2 font-bold flex items-center gap-1">
            <Plus className="w-3 h-3" />
            Total registered
          </p>
        </div>
      </div>

      {/* Adjust Modal */}
      {selectedSupplier && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-md rounded-3xl p-8 card-shadow space-y-6">
            <button onClick={() => setSelectedSupplier(null)} className="absolute top-6 right-6 text-secondary hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold">Adjust Due</h2>
            
            <div className="bg-background p-4 rounded-xl">
              <p className="font-bold">{selectedSupplier.name}</p>
              <p className="text-xs text-secondary">{selectedSupplier.phone}</p>
              <div className="mt-2 pt-2 border-t border-border">
                <span className="text-xs text-secondary">Current Due: </span>
                <span className="font-black text-primary">{formatCurrency(selectedSupplier.dueAmount)}</span>
              </div>
            </div>

            <div className="flex p-1 bg-background rounded-xl border border-border">
              <button 
                onClick={() => setAdjustType("PAY")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${adjustType === "PAY" ? "bg-white text-green-600 shadow-sm" : "text-secondary"}`}
              >
                Make Payment
              </button>
              <button 
                onClick={() => setAdjustType("DUE")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${adjustType === "DUE" ? "bg-white text-orange-600 shadow-sm" : "text-secondary"}`}
              >
                Add Credit
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-secondary uppercase ml-1">Amount (BDT)</label>
              <input 
                type="number" 
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary font-black text-xl" 
              />
            </div>

            {message && (
              <div className={`p-3 rounded-xl text-sm font-bold ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {message.text}
              </div>
            )}

            <button 
              onClick={handleAdjustDue}
              disabled={submitting || !adjustAmount}
              className="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-lg hover:scale-[1.02] disabled:opacity-50 transition-all"
            >
              {submitting ? "Processing..." : "Confirm"}
            </button>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddSupplier} className="bg-surface w-full max-w-md rounded-3xl p-8 card-shadow space-y-6">
            <button type="button" onClick={() => setIsAddOpen(false)} className="absolute top-6 right-6 text-secondary hover:text-foreground">
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-bold">Add New Supplier</h2>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-secondary uppercase ml-1">Supplier Name</label>
                <input 
                  required 
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  type="text" 
                  className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-secondary uppercase ml-1">Phone Number</label>
                <input 
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  type="tel" 
                  className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-secondary uppercase ml-1">Address (Optional)</label>
                <input 
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  type="text" 
                  className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary" 
                />
              </div>
            </div>

            <button 
              disabled={submitting}
              type="submit"
              className="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-xl hover:scale-[1.02] transition-all"
            >
              {submitting ? "Saving..." : "Add Supplier"}
            </button>
          </form>
        </div>
      )}

      <div className="bg-surface rounded-2xl border border-border card-shadow overflow-hidden">
        <div className="p-6 border-b border-border bg-background/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search suppliers..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-border outline-none focus:border-primary transition-all bg-white"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-background text-secondary text-[10px] font-black uppercase tracking-widest border-b border-border">
                <th className="px-6 py-4">Supplier</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Total Due</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredSuppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-background/50 transition-colors">
                  <td className="px-6 py-5">
                    <p className="font-bold">{supplier.name}</p>
                    <p className="text-xs text-secondary">{supplier.address}</p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-sm flex items-center gap-2">
                      <Phone className="w-3 h-3 text-secondary" />
                      {supplier.phone || "N/A"}
                    </p>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`text-lg font-black ${supplier.dueAmount > 0 ? "text-orange-600" : "text-green-600"}`}>
                      {formatCurrency(supplier.dueAmount)}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button 
                      onClick={() => setSelectedSupplier(supplier)}
                      className="bg-primary/10 text-primary hover:bg-primary hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-all"
                    >
                      Adjust
                    </button>
                  </td>
                </tr>
              ))}
              {filteredSuppliers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-secondary italic">
                    No suppliers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}