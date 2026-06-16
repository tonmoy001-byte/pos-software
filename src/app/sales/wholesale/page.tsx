"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Trash2, Plus, Minus, Scan, Receipt, CreditCard, Banknote, Percent, Users, Smartphone, X, Truck, Package } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ReceiptModal } from "@/components/invoice";

export default function WholesaleSalePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [discountPercent, setDiscountPercent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [invoiceSettings, setInvoiceSettings] = useState<any>(null);
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [currentStore, setCurrentStore] = useState<any>(null);

  useEffect(() => { 
    Promise.all([
      fetch("/api/products").then(r => r.json()),
      fetch("/api/settings/store").then(r => r.json()),
      fetch("/api/invoice-settings").then(r => r.json())
    ]).then(([productsData, storeData, invoiceData]) => {
      setProducts(Array.isArray(productsData) ? productsData : (productsData.products || []));
      setCurrentStore(storeData);
      setInvoiceSettings(invoiceData);
    }).finally(() => setLoading(false)); 
  }, []);
  useEffect(() => { if (customerSearch.length > 1) fetch(`/api/customers?query=${customerSearch}`).then(r => r.json()).then(d => setCustomerResults(d.data || [])); }, [customerSearch]);

  const addToCart = (product: any) => {
    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      setCart(cart.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { productId: product.id, name: product.name, price: product.wholesalePrice || product.price * 0.9, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => item.productId === productId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter(item => item.quantity > 0));
  };

  const updatePrice = (productId: string, price: number) => {
    setCart(cart.map(item => item.productId === productId ? { ...item, price } : item));
  };

  const removeFromCart = (productId: string) => setCart(cart.filter(item => item.productId !== productId));

  const openCheckout = () => { if (cart.length === 0) return setError("Cart is empty"); setPaidAmount(String(total)); setIsCheckoutOpen(true); };
  const handleCheckout = async () => {
    setError(null);
    if (cart.length === 0) return setError("Cart is empty");
    setSubmitting(true);
    const payload = { customerId: selectedCustomer?.id || null, items: cart, totalAmount: total, paidAmount: Number(paidAmount) || 0, dueAmount: Math.max(0, total - (Number(paidAmount) || 0)), discount: discountTotal, paymentMethod, saleType: "WHOLESALE" };
    try {
      const res = await fetch("/api/sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok) {
        setLastSale(data);
        setIsCheckoutOpen(false);
        setShowReceipt(true);
      }
      else { setError(data.error); }
    } catch { setError("Failed"); }
    finally { setSubmitting(false); }
  };

  const handleCloseReceipt = () => {
    setShowReceipt(false);
    setLastSale(null);
    setCart([]);
    setDiscountPercent("");
    setSelectedCustomer(null);
    setPaidAmount("");
  };

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const discountTotal = subtotal * ((Number(discountPercent) || 0) / 100);
  const total = subtotal - discountTotal;

  if (loading) return <div className="p-8 animate-pulse">Loading...</div>;

  return (
    <div className="flex h-screen overflow-hidden">
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-lg rounded-2xl p-8 space-y-6">
            <div className="flex items-center gap-4"><div className="w-12 h-12 bg-primary text-white rounded-xl flex items-center justify-center"><Truck className="w-6 h-6" /></div><div><h2 className="text-xl font-black">Wholesale Sale</h2><p className="text-sm text-secondary">Bulk order</p></div></div>
            <div className="space-y-3">
              <label className="text-sm font-bold">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">{["CASH", "BKASH", "NAGAD", "DUE"].map(m => (<button key={m} onClick={() => { setPaymentMethod(m); if (m !== "DUE") setPaidAmount(String(total)); else setPaidAmount(""); }} className={`py-3 rounded-lg font-bold ${paymentMethod === m ? 'bg-primary text-white' : 'bg-background border border-border'}`}>{m}</button>))}</div>
            </div>
            <div className="bg-background p-4 rounded-xl space-y-2">
              <div className="flex justify-between"><span>Total</span><span className="font-bold">{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between text-green-600"><span>Discount ({discountPercent}%)</span><span>-{formatCurrency(discountTotal)}</span></div>
              <div className="flex justify-between text-xl font-black"><span>Total</span><span className="text-primary">{formatCurrency(total)}</span></div>
            </div>
            <button disabled={submitting} onClick={handleCheckout} className="w-full py-4 bg-primary text-white rounded-xl font-bold disabled:opacity-50">{submitting ? "Processing..." : "Complete Wholesale"}</button>
          </div>
        </div>
      )}

            <ReceiptModal 
        isOpen={showReceipt}
        onClose={handleCloseReceipt}
        data={lastSale}
        settings={invoiceSettings}
      />

      <div className="flex-1 flex flex-col p-6 space-y-4">
        <h2 className="text-2xl font-black flex items-center gap-3"><Truck className="w-8 h-8" /> Wholesale Sale</h2>
        <div className="flex gap-4">
          <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary w-5" /><input type="text" placeholder="Search products..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-4 rounded-2xl bg-surface border border-border" /></div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {products.filter(p => (p.name || "").toLowerCase().includes(searchQuery.toLowerCase())).map((product) => (
              <div 
                key={product.id} 
                onClick={() => addToCart(product)}
                className={`bg-surface p-4 rounded-2xl border ${(product.stock ?? 0) > 0 ? 'border-green-300' : 'border-border hover:border-primary/30'} cursor-pointer group transition-all`}
              >
                <div className="aspect-square bg-background rounded-xl mb-4 flex items-center justify-center relative overflow-hidden">
                  {product.metadata?.imageUrl ? (
                    <img src={product.metadata.imageUrl} alt={product.name} className="w-full h-full object-contain p-3" />
                  ) : (
                    <Package className={`w-12 h-12 ${(product.stock ?? 0) > 0 ? 'text-green-400' : 'text-primary/20 group-hover:scale-110'} transition-transform`} />
                  )}
                  <span className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-1 rounded-md ${(product.stock ?? 0) > 0 ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                    {(product.stock ?? 0) > 0 ? 'IN STOCK' : 'OUT OF STOCK'}
                  </span>
                  {(product.stock ?? 0) > 0 && (
                    <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-1 rounded-md bg-white/90 text-green-600">
                      {product.stock || 0} units
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-sm">{product.name}</h4>
                <p className="text-xs text-secondary mt-1">{product.model} | {product.brand}</p>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/50">
                  <span className="font-black text-primary">{formatCurrency(product.wholesalePrice || product.price * 0.9)}</span>
                  <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
            {products.length === 0 && (
              <div className="col-span-full py-12 text-center text-secondary">
                <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-bold">No products available</p>
                <p className="text-sm">Add products in inventory to start creating wholesale sales</p>
              </div>
            )}
            {products.length > 0 && products.filter(p => (p.name || "").toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
              <div className="col-span-full py-12 text-center text-secondary">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-bold">No products match your search</p>
                <p className="text-sm">Try a different search term</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="w-[350px] bg-surface border-l border-border p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4"><h3 className="font-black text-lg">Wholesale Order</h3><button onClick={() => setCart([])} className="text-red-500">Clear</button></div>
        {error && <div className="p-2 bg-red-50 text-red-600 rounded text-sm mb-4">{error}</div>}
        <div className="space-y-3 mb-4">
          {cart.map((item) => (
            <div key={item.productId} className="p-4 bg-background rounded-2xl border border-border group">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-black text-sm">{item.name}</p>
                  <p className="text-xs text-secondary">Unit: {formatCurrency(item.price)}</p>
                </div>
                <button onClick={() => removeFromCart(item.productId)} className="text-secondary hover:text-red-500 p-1 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-border/30">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => updateQuantity(item.productId, -1)}
                    className="w-7 h-7 bg-surface border border-border rounded-lg flex items-center justify-center text-secondary hover:text-primary hover:border-primary transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-sm w-8 text-center">{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.productId, 1)}
                    className="w-7 h-7 bg-surface border border-border rounded-lg flex items-center justify-center text-secondary hover:text-primary hover:border-primary transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <span className="font-black text-foreground">{formatCurrency(item.price * item.quantity)}</span>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="h-40 flex flex-col items-center justify-center text-center opacity-30">
              <Package className="w-12 h-12 mb-2" />
              <p className="font-bold text-sm">Cart is empty</p>
            </div>
          )}
        </div>
        <div className="border-t border-border pt-4 space-y-2">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
          <div className="flex justify-between items-center"><span>Extra Discount</span><input type="number" value={discountPercent || undefined} onChange={e => setDiscountPercent(e.target.value)} className="w-16 text-right border-b" /><span>%</span></div>
          <div className="flex justify-between text-xl font-black"><span>Total</span><span className="text-primary">{formatCurrency(total)}</span></div>
        </div>
        <button onClick={openCheckout} disabled={cart.length === 0} className="w-full mt-4 py-4 bg-primary text-white rounded-xl font-bold disabled:opacity-50">Process Wholesale</button>
      </div>
    </div>
  );
}