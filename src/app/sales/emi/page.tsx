"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Trash2, Plus, Minus, Scan, Receipt, Banknote, Percent, Users, Smartphone, Check, SmartphoneNfc, X, Wallet, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { playBeep } from "@/lib/audio";
import { ReceiptModal } from "@/components/invoice";

export default function EMISalePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [discount, setDiscount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [emiMonths, setEmiMonths] = useState(3);
  const [isIMEIOpen, setIsIMEIOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [tempSelectedImeis, setTempSelectedImeis] = useState<string[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [invoiceSettings, setInvoiceSettings] = useState<any>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", address: "" });
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [currentStore, setCurrentStore] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [productsRes, storeRes, invoiceRes] = await Promise.all([
          fetch("/api/products"),
          fetch("/api/settings/store"),
          fetch("/api/invoice-settings")
        ]);
        const productsData = await productsRes.json();
        setProducts(Array.isArray(productsData) ? productsData : (productsData.products || []));
        setCurrentStore(await storeRes.json());
        setInvoiceSettings(await invoiceRes.json());
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    fetchData();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (customerSearch.length > 1) {
        const res = await fetch(`/api/customers?query=${customerSearch}`);
        const data = await res.json();
        setCustomerResults(data);
      } else { setCustomerResults([]); }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [customerSearch]);

  const addToCart = (product: any) => { setSelectedProduct(product); setIsIMEIOpen(true); };
  
  // Instant barcode detection
  useEffect(() => {
    if (!barcodeInput.trim() || barcodeInput.length < 3) return;
    const timer = setTimeout(() => {
      const trimmed = barcodeInput.trim();
      const foundProduct = products.find(p => p.items?.some((item: any) => item.imei === trimmed || item.barcode === trimmed));
      const found = foundProduct || products.find(p => p.barcode === trimmed);
      if (found) { addToCart(found); playBeep(true); setBarcodeInput(""); }
    }, 100);
    return () => clearTimeout(timer);
  }, [barcodeInput, products]);

  const handleBarcodeScan = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      const foundProduct = products.find(p => p.items?.some((item: any) => item.imei === barcodeInput.trim() || item.barcode === barcodeInput.trim()));
      const found = foundProduct || products.find(p => p.barcode === barcodeInput.trim());
      if (found) { addToCart(found); playBeep(true); setBarcodeInput(""); }
    }
  };
  const confirmIMEIs = (product: any, selectedImeis: string[]) => {
    const existing = cart.find(item => item.productId === product.id);
    if (existing) setCart(cart.map(item => item.productId === product.id ? { ...item, quantity: selectedImeis.length, imeis: selectedImeis } : item));
    else setCart([...cart, { productId: product.id, name: product.name, price: product.price, quantity: selectedImeis.length, imeis: selectedImeis }]);
    setIsIMEIOpen(false);
  };
  const removeFromCart = (productId: string) => setCart(cart.filter(item => item.productId !== productId));
  const handleAddCustomer = async () => {
    try {
      const res = await fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newCustomer) });
      const data = await res.json();
      if (res.ok) { setSelectedCustomer(data); setIsAddingCustomer(false); setNewCustomer({ name: "", phone: "", address: "" }); }
    } catch (err) { console.error(err); }
  };
  const openCheckout = () => { if (cart.length === 0) return setError("Cart is empty"); setIsCheckoutOpen(true); };
  const handleCheckout = async () => {
    setError(null);
    if (cart.length === 0) return setError("Cart is empty");
    if (!selectedCustomer) return setError("Customer required for EMI");
    for (const item of cart) { if (item.imeis.length !== item.quantity) return setError(`Select ${item.quantity} IMEIs`); }
    setSubmitting(true);
    const payload = {
      customerId:        selectedCustomer.id,
      items:             cart,
      totalAmount:       total,
      paidAmount:        firstPayment,
      dueAmount:         total - firstPayment,
      discount,
      paymentMethod:     "EMI",
      saleType:          "EMI",
      emiMonths,
    };
    try {
      const res = await fetch("/api/sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok) {
        setLastSale(data);
        setIsCheckoutOpen(false);
        setShowReceipt(true);
      }
      else { setError(data.error || "Failed"); }
    } catch (err) { setError("Failed"); } finally { setSubmitting(false); }
  };

  const handleCloseReceipt = () => {
    setShowReceipt(false);
    setLastSale(null);
    setCart([]);
    setDiscount(0);
    setSelectedCustomer(null);
    setEmiMonths(3);
  };

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const total = Math.round(subtotal - discount);             // round to nearest whole Taka
  const firstPayment = Math.round(total / emiMonths);         // first EMIs are whole Taka
  const lastEmi       = total - firstPayment * (emiMonths - 1); // last month picks up the residual
  const filteredProducts = products.filter(p => (p.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || (p.model || "").toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading) return <div className="p-8 animate-pulse text-secondary">Loading...</div>;

  return (
    <div className="flex h-screen overflow-hidden">
      {isIMEIOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-lg rounded-3xl p-8">
            <button onClick={() => setIsIMEIOpen(false)} className="absolute top-6 right-6"><X className="w-6 h-6" /></button>
            <h2 className="text-xl font-bold text-center">Select IMEIs</h2>
            <div className="grid grid-cols-2 gap-3 mt-4 max-h-[300px] overflow-y-auto">
              {selectedProduct.items?.map((item: any) => { const isSelected = tempSelectedImeis.includes(item.imei); return (<button key={item.imei} onClick={() => isSelected ? setTempSelectedImeis(prev => prev.filter(i => i !== item.imei)) : setTempSelectedImeis(prev => [...prev, item.imei])} className={`p-3 rounded-xl border ${isSelected ? 'border-primary bg-primary/5' : 'border-border'}`}><p className="text-sm">{item.imei}</p>{isSelected && <Check className="w-4 h-4 text-primary" />}</button>); })}
            </div>
            <button disabled={tempSelectedImeis.length === 0} onClick={() => confirmIMEIs(selectedProduct, tempSelectedImeis)} className="w-full mt-4 py-3 bg-primary text-white rounded-xl font-bold disabled:opacity-50">Add {tempSelectedImeis.length}</button>
          </div>
        </div>
      )}

      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-lg rounded-2xl p-8 space-y-6">
            <div className="flex items-center gap-4"><div className="w-12 h-12 bg-primary text-white rounded-xl flex items-center justify-center"><Calendar className="w-6 h-6" /></div><div><h2 className="text-xl font-black">EMI Sale</h2><p className="text-sm text-secondary">{emiMonths} monthly payments</p></div></div>
            <div className="space-y-3">
              <label className="text-sm font-bold">EMI Duration</label>
              <div className="grid grid-cols-4 gap-2">{[3, 6, 9, 12].map(m => (<button key={m} onClick={() => setEmiMonths(m)} className={`py-3 rounded-xl font-bold ${emiMonths === m ? 'bg-primary text-white' : 'bg-background border border-border'}`}>{m} Mo</button>))}</div>
            </div>
            <div className="bg-background p-4 rounded-xl space-y-2">
              <div className="flex justify-between"><span>Total</span><span className="font-bold">{formatCurrency(total)}</span></div>
              <div className="flex justify-between text-primary"><span>First Payment</span><span className="font-black">{formatCurrency(firstPayment)}</span></div>
              <div className="flex justify-between text-sm text-secondary"><span>{emiMonths - 1} more × {formatCurrency(firstPayment)}</span><span>+ {emiMonths > 1 ? formatCurrency(lastEmi) : "—"}</span></div>
              <p className="text-[10px] text-secondary mt-1">Final month adjusts to cover the balance exactly.</p>
            </div>
            <button disabled={submitting} onClick={handleCheckout} className="w-full py-4 bg-primary text-white rounded-xl font-bold disabled:opacity-50">{submitting ? "Processing..." : "Create EMI Sale"}</button>
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
          <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary w-5 h-5" /><input type="text" placeholder="Search products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-4 rounded-2xl bg-surface border border-border" /><input ref={barcodeInputRef} type="text" value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} onKeyDown={handleBarcodeScan} className="hidden" /></div>
          <button onClick={() => barcodeInputRef.current?.focus()} className="bg-primary/10 text-primary p-4 rounded-2xl"><Scan className="w-6 h-6" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProducts.map((product) => (
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
                <p className="text-sm">Add products in inventory to start creating EMI sales</p>
              </div>
            )}
            {products.length > 0 && filteredProducts.length === 0 && (
              <div className="col-span-full py-12 text-center text-secondary">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-bold">No products match your search</p>
                <p className="text-sm">Try a different search term</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="w-[380px] bg-surface border-l border-border flex flex-col">
        <div className="p-4 border-b">
          <h3 className="font-bold mb-3">Customer (Required)</h3>
          {error && <div className="p-2 bg-red-50 text-red-600 rounded text-sm mb-2">{error}</div>}
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" /><input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Search..." className="w-full pl-10 pr-4 py-3 rounded-xl bg-background" /></div>
          {customerResults.map(c => (<button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); }} className="w-full p-2 text-left hover:bg-primary/5 border-b">{c.name} - {c.phone}</button>))}
        </div>
        <div className="flex-1 p-4 space-y-3">
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
        <div className="p-4 border-t space-y-3">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
          <div className="flex justify-between"><span>Discount</span><input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="w-20 border-b" /></div>
          <div className="flex justify-between text-lg font-black"><span>Total</span><span className="text-primary">{formatCurrency(total)}</span></div>
          <button disabled={submitting || !selectedCustomer} onClick={openCheckout} className="w-full py-4 bg-primary text-white rounded-xl font-bold disabled:opacity-50">EMI Sale</button>
        </div>
      </div>
    </div>
  );
}