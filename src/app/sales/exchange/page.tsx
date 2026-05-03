"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Trash2, RefreshCw, Smartphone, X, ArrowRightLeft } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ReceiptModal } from "@/components/invoice";

export default function ExchangeSalePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<any[]>([]);
  const [exchangeItems, setExchangeItems] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [invoiceSettings, setInvoiceSettings] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [productsRes, invoiceRes] = await Promise.all([
          fetch("/api/products"),
          fetch("/api/invoice-settings")
        ]);
        setProducts(await productsRes.json());
        setInvoiceSettings(await invoiceRes.json());
      } catch (err) {
        console.error("Failed to fetch data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const addToCart = (product: any) => setCart([...cart, { productId: product.id, name: product.name, price: product.price, quantity: 1, imeis: [] }]);
  const removeFromCart = (id: string) => setCart(cart.filter(i => i.productId !== id));
  
  const addExchangeItem = () => setExchangeItems([...exchangeItems, { imei: "", value: 0 }]);
  const updateExchangeItem = (idx: number, field: string, value: any) => {
    const updated = [...exchangeItems];
    updated[idx] = { ...updated[idx], [field]: value };
    setExchangeItems(updated);
  };
  const removeExchangeItem = (idx: number) => setExchangeItems(exchangeItems.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (cart.length === 0) return setError("Select products to sell");
    const exchangeTotal = exchangeItems.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    setSubmitting(true);
    try {
      const payload = { items: cart, totalAmount: cartTotal - exchangeTotal, paidAmount: cartTotal - exchangeTotal, dueAmount: 0, discount: 0, paymentMethod: "EXCHANGE", saleType: "EXCHANGE", exchangeItems };
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
    setExchangeItems([]);
    setSuccess("Exchange completed!");
    fetch("/api/products").then(r => r.json()).then(setProducts);
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const exchangeTotal = exchangeItems.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const netPayable = Math.max(0, cartTotal - exchangeTotal);
  const filtered = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading) return <div className="p-8 animate-pulse">Loading...</div>;

  return (
    <div className="flex h-screen">
      <div className="flex-1 p-6 overflow-y-auto">
        <h2 className="text-2xl font-black mb-6 flex items-center gap-3"><RefreshCw className="w-8 h-8" /> Exchange Sale</h2>
        <div className="relative mb-4"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary w-5" /><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search products..." className="w-full pl-12 pr-4 py-4 rounded-2xl bg-surface border border-border" /></div>
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => (<div key={p.id} onClick={() => addToCart(p)} className="bg-surface p-4 rounded-2xl border border-border hover:border-primary cursor-pointer"><Smartphone className="w-10 h-10 text-primary/20 mb-2" /><h4 className="font-bold text-sm">{p.name}</h4><p className="text-xs text-secondary">{p.model}</p><span className="font-bold text-primary">{formatCurrency(p.price)}</span></div>))}
        </div>
      </div>
      <div className="w-[400px] bg-surface border-l border-border p-6 overflow-y-auto">
        <h3 className="font-black text-lg mb-4">Exchange Items (Old Devices)</h3>
        {exchangeItems.map((item, idx) => (
          <div key={idx} className="p-3 bg-background rounded-xl mb-2">
            <input placeholder="IMEI" value={item.imei} onChange={e => updateExchangeItem(idx, "imei", e.target.value)} className="w-full mb-2 p-2 rounded border border-border text-sm" />
            <div className="flex gap-2"><input placeholder="Value" type="number" value={item.value} onChange={e => updateExchangeItem(idx, "value", e.target.value)} className="flex-1 p-2 rounded border border-border text-sm" /><button onClick={() => removeExchangeItem(idx)} className="text-red-500"><X className="w-5 h-5" /></button></div>
          </div>
        ))}
        <button onClick={addExchangeItem} className="w-full py-3 border-2 border-dashed border-border rounded-xl text-secondary mb-6">+ Add Exchange Item</button>
        
        <h3 className="font-black text-lg mb-4">New Products</h3>
        {cart.map(item => (<div key={item.productId} className="p-3 bg-background rounded-xl flex justify-between mb-2"><div><p className="font-bold text-sm">{item.name}</p><p className="text-xs">{formatCurrency(item.price)}</p></div><button onClick={() => removeFromCart(item.productId)} className="text-red-500"><Trash2 className="w-4" /></button></div>))}
        
        <div className="border-t border-border mt-6 pt-4 space-y-2">
          <div className="flex justify-between"><span>Total</span><span>{formatCurrency(cartTotal)}</span></div>
          <div className="flex justify-between text-secondary"><span>Exchange Credit</span><span>-{formatCurrency(exchangeTotal)}</span></div>
          <div className="flex justify-between text-xl font-black"><span>Net Payable</span><span className="text-primary">{formatCurrency(netPayable)}</span></div>
        </div>
        
        {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg mt-4 text-sm">{error}</div>}
        {success && <div className="p-3 bg-green-50 text-green-600 rounded-lg mt-4 text-sm">{success}</div>}
        
        <button onClick={handleSubmit} disabled={submitting || cart.length === 0} className="w-full mt-4 py-4 bg-primary text-white rounded-xl font-bold disabled:opacity-50">
          {submitting ? "Processing..." : "Complete Exchange"}
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