"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Plus, Minus, Trash2, Banknote, Smartphone, Camera, Check } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function MobilePOSPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const [paymentMode, setPaymentMode] = useState<"CASH" | "MOBILE">("CASH");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/products")
      .then(r => r.json())
      .then(d => setProducts(Array.isArray(d) ? d : d.products || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (search.length < 1) { setResults([]); return; }
    const q = search.toLowerCase();
    setResults(
      products.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.barcode?.includes(q) ||
        p.sku?.toLowerCase().includes(q)
      ).slice(0, 10)
    );
  }, [search, products]);

  function addToCart(product: any) {
    setCart(prev => {
      const exist = prev.find(c => c.id === product.id);
      if (exist) return prev.map(c => c.id === product.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { id: product.id, name: product.name, price: Number(product.price || product.sellingPrice), qty: 1 }];
    });
    setSearch("");
    setShowSearch(false);
  }

  function updateQty(id: string, delta: number) {
    setCart(prev => prev.map(c => c.id === id ? { ...c, qty: Math.max(1, c.qty + delta) } : c));
  }

  function removeItem(id: string) {
    setCart(prev => prev.filter(c => c.id !== id));
  }

  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);

  async function checkout() {
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleType: "REGULAR",
          items: cart.map(c => ({ productId: c.id, quantity: c.qty, price: c.price })),
          payments: [{ method: paymentMode, amount: total }],
        }),
      });
      if (!res.ok) throw new Error("Checkout failed");
      setCart([]);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-md mx-auto bg-background">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h1 className="text-lg font-black">Quick POS</h1>
        <button onClick={() => { setShowSearch(true); setTimeout(() => searchRef.current?.focus(), 100); }}
          className="p-2 rounded-xl bg-accent text-accent-foreground">
          <Search size={20} />
        </button>
      </div>

      {success && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-surface p-8 rounded-2xl shadow-card text-center">
            <Check size={48} className="mx-auto text-green-500 mb-2" />
            <p className="text-lg font-bold">Payment Successful!</p>
          </div>
        </div>
      )}

      {showSearch && (
        <div className="p-3 border-b border-border">
          <input ref={searchRef} autoFocus value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, barcode, or SKU..."
            className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground text-base" />
          {results.length > 0 && (
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
              {results.map(p => (
                <button key={p.id} onClick={() => addToCart(p)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-surface border border-border">
                  <div>
                    <p className="font-bold text-sm">{p.name}</p>
                    <p className="text-xs text-secondary">{formatCurrency(Number(p.sellingPrice))}</p>
                  </div>
                  <Plus size={20} className="text-primary shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-secondary">
            <Smartphone size={48} strokeWidth={1.5} className="mb-3" />
            <p className="font-bold">Tap search to add items</p>
          </div>
        ) : (
          cart.map(c => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{c.name}</p>
                <p className="text-xs text-secondary">{formatCurrency(c.price)} × {c.qty}</p>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <button onClick={() => updateQty(c.id, -1)} className="p-1.5 rounded-lg bg-background border border-border"><Minus size={16} /></button>
                <span className="font-bold w-6 text-center">{c.qty}</span>
                <button onClick={() => updateQty(c.id, 1)} className="p-1.5 rounded-lg bg-background border border-border"><Plus size={16} /></button>
                <button onClick={() => removeItem(c.id)} className="p-1.5 rounded-lg text-red-500"><Trash2 size={16} /></button>
              </div>
            </div>
          ))
        )}
      </div>

      {cart.length > 0 && (
        <div className="border-t border-border p-3 space-y-3">
          <div className="flex justify-between text-lg font-black">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPaymentMode("CASH")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${paymentMode === "CASH" ? "bg-primary text-primary-foreground" : "bg-surface border border-border"}`}>
              <Banknote size={18} /> Cash
            </button>
            <button onClick={() => setPaymentMode("MOBILE")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${paymentMode === "MOBILE" ? "bg-primary text-primary-foreground" : "bg-surface border border-border"}`}>
              <Smartphone size={18} /> Mobile
            </button>
          </div>
          <button onClick={checkout}
            className="w-full py-3 rounded-xl bg-green-600 text-white font-black text-lg hover:bg-green-700 transition-all">
            Pay {formatCurrency(total)}
          </button>
        </div>
      )}
    </div>
  );
}
