"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Trash2, Plus, Minus, Scan, Receipt, CreditCard, Banknote, Percent, Users, Smartphone, Check, SmartphoneNfc, X, Package, Truck } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ReceiptModal } from "@/components/invoice";

export default function OnlineSalePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [discount, setDiscount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isIMEIOpen, setIsIMEIOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [tempSelectedImeis, setTempSelectedImeis] = useState<string[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [invoiceSettings, setInvoiceSettings] = useState<any>(null);
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [platform, setPlatform] = useState("BANGLAVISION");
  const [courier, setCourier] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { 
    Promise.all([
      fetch("/api/products").then(r => r.json()),
      fetch("/api/invoice-settings").then(r => r.json())
    ]).then(([productsData, invoiceData]) => {
      setProducts(Array.isArray(productsData) ? productsData : (productsData.products || []));
      setInvoiceSettings(invoiceData);
    }).finally(() => setLoading(false)); 
  }, []);
  useEffect(() => { if (customerSearch.length > 1) fetch(`/api/customers?query=${customerSearch}`).then(r => r.json()).then(setCustomerResults); }, [customerSearch]);

  const platforms = ["BANGLAVISION", "FACEBOOK", "INSTAGRAM", "TikTok", "DARAZ", "EVABE", "OTHER"];
  const couriers = ["SSL Commerze", "Pathao", "Steadfast", "Paperfly", "eCourier", "Other"];

  const addToCart = (product: any) => { setSelectedProduct(product); setIsIMEIOpen(true); };
  const confirmIMEIs = (product: any, selectedImeis: string[]) => {
    setCart([...cart, { productId: product.id, name: product.name, price: product.price, quantity: selectedImeis.length, imeis: selectedImeis }]);
    setIsIMEIOpen(false);
  };
  const removeFromCart = (productId: string) => setCart(cart.filter(item => item.productId !== productId));
  const openCheckout = () => { if (cart.length === 0) return setError("Cart is empty"); setPaidAmount(String(total)); setIsCheckoutOpen(true); };
  const handleCheckout = async () => {
    setError(null);
    if (cart.length === 0) return setError("Cart is empty");
    setSubmitting(true);
    const payload = { customerId: selectedCustomer?.id || null, items: cart, totalAmount: total, paidAmount: Number(paidAmount) || 0, dueAmount: Math.max(0, total - (Number(paidAmount) || 0)), discount, paymentMethod, saleType: "ONLINE", platform, courier };
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
    setDiscount(0);
    setSelectedCustomer(null);
    setPaidAmount("");
  };

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const total = subtotal - discount;

  if (loading) return <div className="p-8 animate-pulse">Loading...</div>;

  return (
    <div className="flex h-screen overflow-hidden">
      {isIMEIOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-lg rounded-3xl p-8">
            <button onClick={() => setIsIMEIOpen(false)} className="absolute top-6 right-6"><X className="w-6 h-6" /></button>
            <h2 className="text-xl font-bold text-center mb-4">Select IMEIs</h2>
            <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
              {selectedProduct.items?.map((item: any) => { const isSelected = tempSelectedImeis.includes(item.imei); return (<button key={item.imei} onClick={() => isSelected ? setTempSelectedImeis(prev => prev.filter(i => i !== item.imei)) : setTempSelectedImeis(prev => [...prev, item.imei])} className={`p-3 rounded-xl border ${isSelected ? 'border-primary bg-primary/5' : 'border-border'}`}><p className="text-sm">{item.imei}</p>{isSelected && <Check className="w-4 h-4 text-primary" />}</button>); })}
            </div>
            <button disabled={tempSelectedImeis.length === 0} onClick={() => confirmIMEIs(selectedProduct, tempSelectedImeis)} className="w-full mt-4 py-3 bg-primary text-white rounded-xl font-bold disabled:opacity-50">Add {tempSelectedImeis.length}</button>
          </div>
        </div>
      )}

      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-lg rounded-2xl p-8 space-y-6 relative">
            <button onClick={() => setIsCheckoutOpen(false)} className="absolute top-6 right-6 text-secondary hover:text-foreground"><X className="w-6 h-6" /></button>
            <div className="flex items-center gap-4"><div className="w-12 h-12 bg-primary text-white rounded-xl flex items-center justify-center"><Truck className="w-6 h-6" /></div><div><h2 className="text-xl font-black">Online Sale</h2><p className="text-sm text-secondary">Platform order</p></div></div>
            <div className="space-y-3">
              <label className="text-sm font-bold">Platform</label>
              <div className="grid grid-cols-3 gap-2">{platforms.map(p => (<button key={p} onClick={() => setPlatform(p)} className={`py-2 rounded-lg text-sm ${platform === p ? 'bg-primary text-white' : 'bg-background border border-border'}`}>{p}</button>))}</div>
            </div>
            <div className="space-y-3">
              <label className="text-sm font-bold">Courier</label>
              <select value={courier} onChange={e => setCourier(e.target.value)} className="w-full p-3 rounded-xl bg-background border border-border">
                <option value="">Select Courier</option>
                {couriers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="bg-background p-4 rounded-xl space-y-2">
              <div className="flex justify-between"><span>Total</span><span className="font-bold">{formatCurrency(total)}</span></div>
              <div className="flex justify-between text-primary"><span>Paid</span><span className="font-bold">{formatCurrency(Number(paidAmount) || 0)}</span></div>
              {total - (Number(paidAmount) || 0) > 0 && <div className="flex justify-between text-red-500"><span>Due</span><span>{formatCurrency(total - (Number(paidAmount) || 0))}</span></div>}
            </div>
            <button disabled={submitting} onClick={handleCheckout} className="w-full py-4 bg-primary text-white rounded-xl font-bold disabled:opacity-50">{submitting ? "Processing..." : "Confirm Order"}</button>
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
                  <Smartphone className={`w-12 h-12 ${(product.stock ?? 0) > 0 ? 'text-green-400' : 'text-primary/20 group-hover:scale-110'} transition-transform`} />
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
                  <span className="font-black text-primary">{formatCurrency(product.price)}</span>
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
                <p className="text-sm">Add products in inventory to start creating online sales</p>
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
        <div className="flex items-center justify-between mb-4"><h3 className="font-black text-lg">Online Order</h3><button onClick={() => setCart([])} className="text-red-500">Clear</button></div>
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
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-border/30">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      if (item.quantity <= 1) {
                        removeFromCart(item.productId);
                      } else {
                        setCart(cart.map(c => c.productId === item.productId ? { ...c, quantity: c.quantity - 1 } : c));
                      }
                    }} 
                    className="w-7 h-7 bg-surface border border-border rounded-lg flex items-center justify-center text-secondary hover:text-primary hover:border-primary transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-sm w-8 text-center">{item.quantity}</span>
                  <button 
                    onClick={() => setCart(cart.map(c => c.productId === item.productId ? { ...c, quantity: c.quantity + 1 } : c))} 
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
              <Smartphone className="w-12 h-12 mb-2" />
              <p className="font-bold text-sm">Cart is empty</p>
            </div>
          )}
        </div>
        <div className="border-t border-border pt-4 space-y-2">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
          <div className="flex justify-between items-center"><span>Discount</span><input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value))} className="w-20 border-b" /></div>
          <div className="flex justify-between text-xl font-black"><span>Total</span><span className="text-primary">{formatCurrency(total)}</span></div>
        </div>
        <button onClick={openCheckout} disabled={cart.length === 0} className="w-full mt-4 py-4 bg-primary text-white rounded-xl font-bold disabled:opacity-50">Process Online Order</button>
      </div>
    </div>
  );
}