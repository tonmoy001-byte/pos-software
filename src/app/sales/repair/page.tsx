"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Trash2, Wrench, Smartphone, X, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ReceiptModal } from "@/components/invoice";

export default function RepairSalePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [invoiceSettings, setInvoiceSettings] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", address: "" });
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [productsRes, invoiceRes] = await Promise.all([
          fetch("/api/products"),
          fetch("/api/invoice-settings")
        ]);
        const productsData = await productsRes.json();
        setProducts(Array.isArray(productsData) ? productsData : (productsData.products || []));
        setInvoiceSettings(await invoiceRes.json());
      } catch (err) {
        console.error("Failed to fetch data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (customerSearch.length > 1) {
      fetch(`/api/customers?query=${customerSearch}`).then(r => r.json()).then(d => setCustomerResults(d.data || []));
    }
  }, [customerSearch]);

  const addToCart = () => setCart([...cart, { id: Date.now(), name: "", price: 0, quantity: 1, description: "" }]);
  const updateCartItem = (idx: number, field: string, value: any) => {
    const updated = [...cart];
    updated[idx] = { ...updated[idx], [field]: value };
    setCart(updated);
  };
  const removeFromCart = (idx: number) => setCart(cart.filter((_, i) => i !== idx));

  const handleAddCustomer = async () => {
    try {
      const res = await fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newCustomer) });
      if (res.ok) { const data = await res.json(); setSelectedCustomer(data); setIsAddingCustomer(false); }
    } catch (err) {
      console.error("Failed to add customer:", err);
    }
  };

  const handleSubmit = async () => {
    if (cart.length === 0) return setError("Add repair services");
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setSubmitting(true);
    try {
      const payload = { customerId: selectedCustomer?.id || null, items: cart, totalAmount: total, paidAmount: total, dueAmount: 0, discount: 0, paymentMethod: "CASH", saleType: "REPAIR" };
      const res = await fetch("/api/sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok) {
        setLastSale(data);
        setShowReceipt(true);
      } else {
        setError("Failed");
      }
    } catch {
      setError("Error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseReceipt = () => {
    setShowReceipt(false);
    setLastSale(null);
    setCart([]);
    setSuccess("Repair order created!");
    fetch("/api/products").then(r => r.json()).then(data => setProducts(Array.isArray(data) ? data : (data.products || [])));
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const filtered = products.filter(p => (p.name || "").toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading) return <div className="p-8 animate-pulse">Loading...</div>;

  return (
    <div className="flex h-screen">
      <div className="flex-1 p-6 overflow-y-auto">
        <h2 className="text-2xl font-black mb-6 flex items-center gap-3"><Wrench className="w-8 h-8" /> Repair Service</h2>
        
        <div className="mb-6 p-4 bg-surface rounded-2xl border border-border">
          <h3 className="font-bold mb-3">Customer</h3>
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary w-4" /><input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Search customer..." className="w-full pl-10 pr-3 py-2 rounded-xl bg-background border border-border text-sm" />{customerResults.length > 0 && (<div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-xl overflow-hidden z-20 shadow-lg">{customerResults.map(c => (<button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); setCustomerResults([]); }} className="w-full p-2 text-left hover:bg-primary/5 border-b border-border/50 last:border-0 text-sm"><span className="font-bold">{c.name}</span><span className="text-secondary ml-2">{c.phone}</span></button>))}</div>)}</div>
            <button onClick={() => setIsAddingCustomer(true)} className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-sm">+ New</button>
          </div>
          {isAddingCustomer && (
            <div className="space-y-2 p-3 bg-background rounded-xl">
              <input placeholder="Name" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} className="w-full p-2 rounded border border-border text-sm" />
              <input placeholder="Phone" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} className="w-full p-2 rounded border border-border text-sm" />
              <button onClick={handleAddCustomer} className="w-full py-2 bg-primary text-white rounded-lg text-sm">Save</button>
            </div>
          )}
          {selectedCustomer && <div className="p-2 bg-primary/5 rounded-lg text-sm font-bold">{selectedCustomer.name} - {selectedCustomer.phone}</div>}
        </div>

        <button onClick={addToCart} className="w-full py-4 border-2 border-dashed border-border rounded-2xl text-secondary mb-4">+ Add Repair Service</button>
        
        <div className="space-y-3">
          {cart.map((item, idx) => (
            <div key={idx} className="p-4 bg-surface rounded-2xl border border-border space-y-3">
              <input placeholder="Service Name" value={item.name} onChange={e => updateCartItem(idx, "name", e.target.value)} className="w-full p-2 rounded-lg border border-border" />
              <div className="flex gap-2">
                <div className="flex-1"><label className="text-xs text-secondary">Price</label><input type="number" value={item.price} onChange={e => updateCartItem(idx, "price", Number(e.target.value))} className="w-full p-2 rounded-lg border border-border" /></div>
                <div className="w-20"><label className="text-xs text-secondary">Qty</label><input type="number" value={item.quantity} onChange={e => updateCartItem(idx, "quantity", Number(e.target.value))} className="w-full p-2 rounded-lg border border-border" /></div>
                <button onClick={() => removeFromCart(idx)} className="self-end text-red-500"><Trash2 className="w-5" /></button>
              </div>
              <input placeholder="Description (optional)" value={item.description} onChange={e => updateCartItem(idx, "description", e.target.value)} className="w-full p-2 rounded-lg border border-border text-sm" />
            </div>
          ))}
        </div>
      </div>

      <div className="w-[350px] bg-surface border-l border-border p-6">
        <h3 className="font-black text-lg mb-4">Summary</h3>
        <div className="space-y-2 mb-6">
          {cart.map(item => (<div key={item.id} className="flex justify-between text-sm"><span>{item.name || "Service"}</span><span>{formatCurrency(item.price * item.quantity)}</span></div>))}
        </div>
        <div className="border-t border-border pt-4">
          <div className="flex justify-between text-xl font-black"><span>Total</span><span className="text-primary">{formatCurrency(total)}</span></div>
        </div>
        {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg mt-4 text-sm">{error}</div>}
        {success && <div className="p-3 bg-green-50 text-green-600 rounded-lg mt-4 text-sm">{success}</div>}
        <button onClick={handleSubmit} disabled={submitting || cart.length === 0} className="w-full mt-4 py-4 bg-primary text-white rounded-xl font-bold disabled:opacity-50">
          {submitting ? "Processing..." : "Complete Repair"}
        </button>
      </div>
      <ReceiptModal 
        isOpen={showReceipt}
        onClose={handleCloseReceipt}
        data={lastSale}
        settings={invoiceSettings}
      />
    </div>
  );
}