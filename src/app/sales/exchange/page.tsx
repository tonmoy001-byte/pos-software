"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, Plus, Minus, Trash2, RefreshCw, Smartphone, X, ArrowRightLeft, Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ReceiptModal } from "@/components/invoice";
import { safeFetch } from "@/lib/api-client";

export default function ExchangeSalePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [cart,         setCart]         = useState<any[]>([]);
  const [exchangeItems,setExchangeItems]= useState<any[]>([]);
  const [submitting, setSubmitting]    = useState(false);
  const [error,      setError]         = useState<string | null>(null);
  const [success,    setSuccess]       = useState<string | null>(null);
  const [showReceipt,setShowReceipt]   = useState(false);
  const [lastSale,   setLastSale]      = useState<any>(null);
  const [invoiceSettings,setInvoiceSettings] = useState<any>(null);

  // ── Derived values (no const-in-JSX closure risk) ───────────────────────
  const cartTotal       = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const exchangeTotal   = useMemo(() => exchangeItems.reduce((sum, item) => sum + (Number(item.estimatedValue) || 0), 0), [exchangeItems]);
  const netPayable      = useMemo(() => Math.max(0, cartTotal - exchangeTotal), [cartTotal, exchangeTotal]);

  useEffect(() => {
    Promise.all([
      safeFetch<any>("/api/products"),
      safeFetch<any>("/api/invoice-settings"),
    ]).then(([productsData, invoiceData]) => {
      setProducts(Array.isArray(productsData) ? productsData : (productsData.products || []));
      setInvoiceSettings(invoiceData);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => products.filter(p => (p.name || "").toLowerCase().includes(searchQuery.toLowerCase())),
    [products, searchQuery]
  );

  // ── Cart / exchange helpers ───────────────────────────────────────────────
  const addToCart = useCallback((product: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart(prev => prev.filter(i => i.productId !== id));
  }, []);

  const updateCartQty = useCallback((productId: string, newQty: number) => {
    if (newQty <= 0) { removeFromCart(productId); return; }
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity: newQty } : i));
  }, [removeFromCart]);

  const addExchangeItem = useCallback(() => {
    setExchangeItems(prev => [...prev, { description: "", estimatedValue: 0, condition: "good" }]);
  }, []);

  const updateExchangeItem = useCallback((idx: number, field: string, value: any) => {
    setExchangeItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }, []);

  const removeExchangeItem = useCallback((idx: number) => {
    setExchangeItems(prev => prev.filter((_, i) => i !== idx));
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (cart.length === 0) return setError("Select products to sell");

    // Validate exchange values
    const invalidExchange = exchangeItems.find(i => !i.description || Number(i.estimatedValue) <= 0);
    if (invalidExchange) return setError("Enter a description and valid trade-in value for all items.");

    const exchangeValue = exchangeItems.reduce((sum, item) => sum + (Number(item.estimatedValue) || 0), 0);

    setSubmitting(true);
    try {
      const payload: any = {
        items: cart,
        totalAmount:      netPayable,
        paidAmount:       netPayable,
        dueAmount:        0,
        discount:         0,
        paymentMethod:    "EXCHANGE",
        saleType:         "EXCHANGE",
        exchangeItems:    exchangeItems.map(i => ({ description: i.description, estimatedValue: Number(i.estimatedValue), condition: i.condition })),
      };
      const data = await safeFetch<any>("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setLastSale(data);
      setShowReceipt(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [cart, exchangeItems, netPayable]);

  const handleCloseReceipt = useCallback(() => {
    setShowReceipt(false);
    setLastSale(null);
    setCart([]);
    setExchangeItems([]);
    setSuccess("Exchange completed!");
    safeFetch<any>("/api/products").then(data => setProducts(Array.isArray(data) ? data : (data.products || []))).catch(() => {});
  }, []);

  // ── Render guard ─────────────────────────────────────────────────────────
  if (loading) return <div className="p-8 animate-pulse">Loading...</div>;

  return (
    <div className="flex h-screen">
      {/* Col 1 – new products */}
      <div className="flex-1 p-6 overflow-y-auto">
        <h2 className="text-2xl font-black mb-6 flex items-center gap-3"><RefreshCw className="w-8 h-8" /> Exchange Sale</h2>
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary w-5" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search new products to add..."
            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-surface border border-border"
          />
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((product) => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              className={`bg-surface p-4 rounded-2xl border text-left transition-all
                ${(product.stock ?? 0) > 0 ? 'border-green-300 cursor-pointer group' : 'border-border hover:border-primary/30 cursor-pointer group'}`}
            >
              <div className="aspect-square bg-background rounded-xl mb-4 flex items-center justify-center relative overflow-hidden">
                {product.metadata?.imageUrl ? (
                  <img src={product.metadata.imageUrl} alt={product.name} className="w-full h-full object-contain p-3" />
                ) : (
                  <Smartphone className={`w-12 h-12 ${(product.stock ?? 0) > 0 ? 'text-green-400' : 'text-primary/20 group-hover:scale-110'} transition-transform`} />
                )}
                {(product.stock ?? 0) > 0 && (
                  <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-1 rounded-md bg-green-500 text-white">{product.stock} in stock</span>
                )}
              </div>
              <h4 className="font-bold text-sm">{product.name}</h4>
              <p className="text-xs text-secondary mt-1">{product.model} | {product.brand}</p>
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/50">
                <span className="font-black text-primary">{formatCurrency(product.price)}</span>
                <Plus className="w-4 h-4 text-primary" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Col 2 – exchange items + summary */}
      <div className="w-[400px] bg-surface border-l border-border p-6 overflow-y-auto">
        <h3 className="font-black text-lg mb-4">Old Device Trade-In</h3>
        {exchangeItems.map((item, idx) => (
          <div key={idx} className="p-3 bg-background rounded-xl mb-2">
            <input
              placeholder="Device description (e.g. Samsung Galaxy S23)"
              value={item.description}
              onChange={e => updateExchangeItem(idx, "description", e.target.value)}
              className="w-full mb-2 p-2 rounded border border-border text-sm"
            />
            <div className="flex gap-2 mb-2">
              <select
                value={item.condition}
                onChange={e => updateExchangeItem(idx, "condition", e.target.value)}
                className="p-2 rounded border border-border text-sm"
              >
                <option value="like-new">Like New</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
              <input
                placeholder="Trade-in value (৳)"
                type="number"
                min="0"
                step="0.01"
                value={item.estimatedValue || ""}
                onChange={e => updateExchangeItem(idx, "estimatedValue", e.target.value)}
                className="flex-1 p-2 rounded border border-border text-sm"
              />
              <button onClick={() => removeExchangeItem(idx)} className="text-red-500 px-2"><X className="w-5 h-5" /></button>
            </div>
          </div>
        ))}
        <button onClick={addExchangeItem} className="w-full py-3 border-2 border-dashed border-border rounded-xl text-secondary mb-6">
          + Add Trade-In Device
        </button>

        <h3 className="font-black text-lg mb-4">New Products</h3>
        <div className="space-y-3 mb-6">
          {cart.map((item) => (
            <div key={item.productId} className="p-4 bg-background rounded-2xl border border-border">
              <div className="flex justify-between items-center mb-2">
                <p className="font-black text-sm">{item.name}</p>
                <button onClick={() => removeFromCart(item.productId)} className="text-secondary hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-border/30">
                <div className="flex items-center gap-2">
                  <button onClick={() => updateCartQty(item.productId, item.quantity - 1)} className="w-7 h-7 bg-surface border border-border rounded-lg flex items-center justify-center text-secondary hover:text-primary hover:border-primary"><Minus className="w-4 h-4" /></button>
                  <span className="font-bold text-sm w-8 text-center">{item.quantity}</span>
                  <button onClick={() => updateCartQty(item.productId, item.quantity + 1)} className="w-7 h-7 bg-surface border border-border rounded-lg flex items-center justify-center text-secondary hover:text-primary hover:border-primary"><Plus className="w-4 h-4" /></button>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      const newPrice = prompt("Enter new price:", item.price.toString());
                      if (newPrice && !isNaN(Number(newPrice))) {
                        setCart(cart.map(c => c.productId === item.productId ? { ...c, price: Number(newPrice) } : c));
                      }
                    }}
                    className="p-1 text-secondary hover:text-primary transition-colors"
                    title="Edit price"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-black text-foreground">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="h-24 flex flex-col items-center justify-center opacity-30">
              <Smartphone className="w-10 h-10 mb-2" />
              <p className="font-bold text-sm">No new products</p>
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="border-t border-border mt-4 pt-4 space-y-2">
          <div className="flex justify-between text-sm"><span>New products</span><span>{formatCurrency(cartTotal)}</span></div>
          <div className="flex justify-between text-sm text-secondary"><span>Trade-in credit</span><span>-{formatCurrency(exchangeTotal)}</span></div>
          <div className="flex justify-between text-xl font-black"><span>Net Payable</span><span className="text-primary">{formatCurrency(netPayable)}</span></div>
        </div>

        {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg mt-4 text-sm">{error}</div>}
        {success && <div className="p-3 bg-green-50 text-green-600 rounded-lg mt-4 text-sm">{success}</div>}

        <button
          onClick={handleSubmit}
          disabled={submitting || cart.length === 0}
          className="w-full mt-4 py-4 bg-primary text-white rounded-xl font-bold disabled:opacity-50"
        >
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
