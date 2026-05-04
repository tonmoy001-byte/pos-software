"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search, Trash2, Plus, Minus, Scan, Receipt, CreditCard, Banknote, Percent, Users, Smartphone, Check, SmartphoneNfc, X, UserPlus, Wallet, Clock, Filter, Calendar, ChevronRight, AlertTriangle, Phone
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { playBeep } from "@/lib/audio";
import { ReceiptModal } from "@/components/invoice";

export default function DueSalePage() {
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
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", address: "" });
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [currentStore, setCurrentStore] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"sale" | "ledger">("sale");
  const [dues, setDues] = useState<any[]>([]);
  const [loadingDues, setLoadingDues] = useState(false);
  const [duesSearch, setDuesSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PARTIAL" | "DUE">("ALL");
  const [selectedDue, setSelectedDue] = useState<any>(null);
  const [payAmount, setPayAmount] = useState("");
  const [submittingDue, setSubmittingDue] = useState(false);
  const [message, setMessage] = useState<{type: "success"|"error", text: string} | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [productsRes, storeRes, invoiceRes] = await Promise.all([
          fetch("/api/products"),
          fetch("/api/settings/store"),
          fetch("/api/invoice-settings")
        ]);
        setProducts(await productsRes.json());
        setCurrentStore(await storeRes.json());
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
    const delayDebounceFn = setTimeout(async () => {
      if (customerSearch.length > 1) {
        const res = await fetch(`/api/customers?query=${customerSearch}`);
        const data = await res.json();
        setCustomerResults(data);
      } else {
        setCustomerResults([]);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [customerSearch]);

  const fetchDues = async () => {
    setLoadingDues(true);
    try {
      const res = await fetch("/api/dues");
      const json = await res.json();
      setDues(json);
    } catch (err) {
      console.error("Failed to fetch dues", err);
    } finally {
      setLoadingDues(false);
    }
  };

  const handleCollectDue = async () => {
    if (!selectedDue || !payAmount) return;
    setSubmittingDue(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/dues/${selectedDue.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: payAmount, method: "CASH" })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Payment collected successfully" });
        setSelectedDue(null);
        setPayAmount("");
        fetchDues();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to collect payment" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Connection error" });
    } finally {
      setSubmittingDue(false);
    }
  };

  const totalOutstanding = dues.reduce((acc, d) => acc + Number(d.dueAmount), 0);
  const filteredDues = dues.filter(d => {
    if (duesSearch) {
      const q = duesSearch.toLowerCase();
      if (!d.customer?.name?.toLowerCase().includes(q) && !d.customer?.phone?.toLowerCase().includes(q) && !d.invoiceId?.toLowerCase().includes(q)) return false;
    }
    if (filterStatus !== "ALL" && d.status !== filterStatus) return false;
    return true;
  });

  const addToCart = (product: any) => {
    setSelectedProduct(product);
    setIsIMEIOpen(true);
  };

  // Instant barcode detection
  useEffect(() => {
    if (!barcodeInput.trim() || barcodeInput.length < 3) return;
    const timer = setTimeout(() => {
      const trimmed = barcodeInput.trim();
      const foundProduct = products.find(p => p.items?.some((item: any) => item.imei === trimmed || item.barcode === trimmed));
      const foundByProductBarcode = products.find(p => p.barcode === trimmed);
      const found = foundProduct || foundByProductBarcode;
      if (found) {
        addToCart(found);
        setBarcodeInput("");
      } else if (barcodeInput.length >= 8) {
        setError("Product not found");
        setTimeout(() => setError(null), 3000);
        setBarcodeInput("");
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [barcodeInput, products]);

  const handleBarcodeScan = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      const foundProduct = products.find(p => p.items?.some((item: any) => item.imei === barcodeInput.trim() || item.barcode === barcodeInput.trim()));
      const foundByProductBarcode = products.find(p => p.barcode === barcodeInput.trim());
      const found = foundProduct || foundByProductBarcode;
      if (found) {
        addToCart(found);
        setBarcodeInput("");
      } else {
        setError("Product not found");
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  const confirmIMEIs = (product: any, selectedImeis: string[]) => {
    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      setCart(cart.map(item => item.productId === product.id ? { ...item, quantity: selectedImeis.length, imeis: selectedImeis } : item));
    } else {
      setCart([...cart, { productId: product.id, name: product.name, price: product.price, quantity: selectedImeis.length, imeis: selectedImeis }]);
    }
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
    if (!selectedCustomer) return setError("Customer required for due sale");
    for (const item of cart) { if (item.imeis.length !== item.quantity) return setError(`Select ${item.quantity} IMEIs for ${item.name}`); }
    setSubmitting(true);
    const payload = { customerId: selectedCustomer.id, items: cart, totalAmount: total, paidAmount: 0, dueAmount: total, discount, paymentMethod: "DUE", saleType: "DUE" };
    try {
      const res = await fetch("/api/sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok) {
        setLastSale(data);
        setIsCheckoutOpen(false);
        setShowReceipt(true);
      } else { setError(data.error || "Checkout failed"); }
    } catch (err) { setError("Checkout failed"); } finally { setSubmitting(false); }
  };

  const handleCloseReceipt = () => {
    setShowReceipt(false);
    setLastSale(null);
    setCart([]);
    setDiscount(0);
    setSelectedCustomer(null);
    fetch("/api/products").then(res => res.json()).then(setProducts);
  };

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const total = subtotal - discount;
  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.model.toLowerCase().includes(searchQuery.toLowerCase()) || p.brand.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading) return <div className="p-8 animate-pulse text-secondary font-bold">Loading Inventory...</div>;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Tab Switcher */}
      <div className="bg-surface border-b border-border px-8 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-black text-foreground">Due Management</h1>
            <p className="text-xs text-secondary font-bold uppercase tracking-widest mt-1">
              {activeTab === "sale" ? "Create New Credit Sale" : "Outstanding Dues Ledger"}
            </p>
          </div>
          <div className="flex bg-background p-1 rounded-2xl border border-border">
            <button 
              onClick={() => setActiveTab("sale")}
              className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'sale' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-secondary hover:text-foreground'}`}
            >
              New Sale
            </button>
            <button 
              onClick={() => { setActiveTab("ledger"); fetchDues(); }}
              className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'ledger' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-secondary hover:text-foreground'}`}
            >
              Ledger
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {isIMEIOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-lg rounded-3xl p-8 card-shadow space-y-6 relative">
            <button onClick={() => { setIsIMEIOpen(false); setTempSelectedImeis([]); }} className="absolute top-6 right-6"><X className="w-6 h-6" /></button>
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto"><SmartphoneNfc className="w-8 h-8" /></div>
              <h2 className="text-2xl font-bold">Select IMEIs</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto p-2">
              {selectedProduct.items?.map((item: any) => {
                const isSelected = tempSelectedImeis.includes(item.imei);
                return (
                  <button key={item.imei} onClick={() => isSelected ? setTempSelectedImeis(prev => prev.filter(i => i !== item.imei)) : setTempSelectedImeis(prev => [...prev, item.imei])} className={`p-4 rounded-xl border-2 text-left ${isSelected ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <p className="text-sm font-bold">{item.imei}</p>
                    {isSelected && <Check className="w-5 h-5 text-primary" />}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-4 pt-4">
              <button onClick={() => { setIsIMEIOpen(false); }} className="flex-1 py-4 bg-background border border-border rounded-2xl font-bold">Cancel</button>
              <button disabled={tempSelectedImeis.length === 0} onClick={() => confirmIMEIs(selectedProduct, tempSelectedImeis)} className="flex-1 py-4 bg-primary text-white rounded-2xl font-black disabled:opacity-50">Add {tempSelectedImeis.length}</button>
            </div>
          </div>
        </div>
      )}

      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[80] flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-lg rounded-[2rem] p-8 card-shadow space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary text-white rounded-xl flex items-center justify-center"><Receipt className="w-6 h-6" /></div>
              <div><h2 className="text-xl font-black">Due Sale</h2><p className="text-sm text-secondary">Customer will pay later</p></div>
            </div>
            <div className="space-y-4 bg-background p-6 rounded-2xl">
              <div className="flex justify-between text-lg font-bold"><span>Total Due</span><span className="text-primary">{formatCurrency(total)}</span></div>
              <div className="flex justify-between text-sm text-secondary"><span>Customer</span><span className="font-bold">{selectedCustomer?.name}</span></div>
            </div>
            <button disabled={submitting} onClick={handleCheckout} className="w-full py-4 bg-primary text-white rounded-xl font-black disabled:opacity-50">
              {submitting ? "Processing..." : "Create Due Sale"}
            </button>
          </div>
        </div>
      )}

      {selectedDue && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-md rounded-3xl p-8 card-shadow space-y-6 relative">
            <button onClick={() => setSelectedDue(null)} className="absolute top-6 right-6 text-secondary hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto"><CreditCard className="w-8 h-8" /></div>
              <h2 className="text-2xl font-bold">Collect Payment</h2>
            </div>
            <div className="space-y-4">
              <div className="bg-background p-4 rounded-xl border border-border">
                <p className="text-xs text-secondary font-bold uppercase tracking-widest">Total Due</p>
                <p className="text-2xl font-black text-primary mt-1">{formatCurrency(selectedDue.dueAmount)}</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-secondary uppercase ml-1">Payment Amount</label>
                <input 
                  type="number" 
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Enter amount to collect" 
                  className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary font-bold" 
                />
              </div>
            </div>
            {message && (
               <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                 <AlertTriangle className="w-4 h-4" />
                 {message.text}
               </div>
            )}
            <button 
              disabled={submittingDue || !payAmount}
              onClick={handleCollectDue}
              className="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-lg hover:scale-[1.02] disabled:opacity-50 transition-all"
            >
              {submittingDue ? "Processing..." : "Confirm Payment"}
            </button>
          </div>
        </div>
      )}

      <ReceiptModal 
        isOpen={showReceipt}
        onClose={handleCloseReceipt}
        data={lastSale}
        settings={invoiceSettings}
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "sale" ? (
          <div className="flex h-full overflow-hidden">
            <div className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary w-5 h-5" />
                  <input type="text" placeholder="Search products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-4 rounded-2xl bg-surface border border-border focus:border-primary outline-none font-medium" />
                  <input ref={barcodeInputRef} type="text" value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} onKeyDown={handleBarcodeScan} className="hidden" />
                </div>
                <button onClick={() => barcodeInputRef.current?.focus()} className="bg-primary/10 text-primary px-6 py-4 rounded-2xl font-bold flex items-center gap-2"><Scan className="w-6 h-6" /> Scan</button>
              </div>
              <div className="flex-1 overflow-y-auto pb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredProducts.map((product) => (
                    <div 
                      key={product.id} 
                      onClick={() => addToCart(product)}
                      className={`bg-surface p-4 rounded-2xl border ${(product._count?.items ?? 0) > 0 ? 'border-green-300' : 'border-border hover:border-primary/30'} cursor-pointer group transition-all`}
                    >
                      <div className="aspect-square bg-background rounded-xl mb-4 flex items-center justify-center relative overflow-hidden">
                        <Smartphone className={`w-12 h-12 ${(product._count?.items ?? 0) > 0 ? 'text-green-400' : 'text-primary/20 group-hover:scale-110'} transition-transform`} />
                        <span className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-1 rounded-md ${(product._count?.items ?? 0) > 0 ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                          {(product._count?.items ?? 0) > 0 ? 'IN STOCK' : 'OUT OF STOCK'}
                        </span>
                        {(product._count?.items ?? 0) > 0 && (
                          <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-1 rounded-md bg-white/90 text-green-600">
                            {product._count?.items || 0} units
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
                </div>
              </div>
            </div>

            <div className="w-[400px] bg-surface border-l border-border flex flex-col shadow-2xl">
              <div className="p-6 border-b border-border">
                <h3 className="font-black text-lg mb-4">Customer Details</h3>
                {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold mb-4 flex items-center justify-between">{error}<button onClick={() => setError(null)}><X className="w-4 h-4" /></button></div>}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
                  <input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Search by name or phone..." className="w-full pl-10 pr-4 py-3 rounded-xl bg-background border border-border outline-none focus:border-primary font-medium" />
                  {customerResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-surface border border-border rounded-2xl mt-2 z-10 shadow-2xl overflow-hidden max-h-[300px] overflow-y-auto">
                      {customerResults.map(c => (<button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); setCustomerResults([]); }} className="w-full p-4 text-left hover:bg-primary/5 border-b border-border/50 last:border-0"><p className="font-bold">{c.name}</p><p className="text-xs text-secondary flex items-center gap-1 mt-1"><Phone className="w-3 h-3" /> {c.phone}</p></button>))}
                    </div>
                  )}
                </div>
                {selectedCustomer ? (
                  <div className="mt-4 p-4 bg-primary/5 rounded-2xl border border-primary/20 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-primary uppercase tracking-widest">Selected Customer</p>
                      <p className="font-black text-foreground mt-0.5">{selectedCustomer.name}</p>
                    </div>
                    <button onClick={() => setSelectedCustomer(null)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <button onClick={() => setIsAddingCustomer(true)} className="w-full mt-4 py-3 border-2 border-dashed border-border rounded-xl text-sm font-bold text-secondary hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    New Customer
                  </button>
                )}
                {isAddingCustomer && (
                  <div className="mt-4 p-4 bg-background rounded-2xl border border-border space-y-3">
                    <input 
                      placeholder="Customer Name" 
                      value={newCustomer.name} 
                      onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})} 
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm font-medium" 
                    />
                    <input 
                      placeholder="Phone Number" 
                      value={newCustomer.phone} 
                      onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})} 
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm font-medium" 
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setIsAddingCustomer(false)} 
                        className="flex-1 py-2 bg-secondary/10 text-secondary rounded-lg text-sm font-bold"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleAddCustomer} 
                        disabled={!newCustomer.name || !newCustomer.phone} 
                        className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-bold disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-2">Cart Items</p>
                {cart.map((item) => (
                  <div key={item.productId} className="p-4 bg-background rounded-2xl border border-border group">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-black text-sm">{item.name}</p>
                        <p className="text-xs text-secondary">Qty: {item.quantity}</p>
                      </div>
                      <button onClick={() => removeFromCart(item.productId)} className="text-secondary hover:text-red-500 p-1 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-border/30">
                      <div className="flex gap-1 flex-wrap">
                        {item.imeis.map((imei: string) => <span key={imei} className="text-[9px] bg-surface px-1.5 py-0.5 rounded border border-border text-secondary font-medium">{imei}</span>)}
                      </div>
                      <span className="font-black text-foreground">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  </div>
                ))}
                {cart.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                    <Smartphone className="w-16 h-16 mb-4" />
                    <p className="font-bold">Your cart is empty</p>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-border bg-background/50 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-secondary font-medium"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                  <div className="flex justify-between items-center text-sm text-secondary font-medium">
                    <span>Discount</span>
                    <div className="flex items-center gap-2">
                      <Percent className="w-3 h-3" />
                      <input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="w-20 text-right bg-transparent border-b border-border outline-none focus:border-primary font-bold text-foreground" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-end py-2">
                  <span className="text-xs font-black text-secondary uppercase tracking-widest">Total Payable</span>
                  <span className="text-3xl font-black text-primary">{formatCurrency(total)}</span>
                </div>
                <button disabled={submitting || !selectedCustomer || cart.length === 0} onClick={openCheckout} className="w-full py-5 bg-primary text-white rounded-[1.25rem] font-black shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3">
                  <Wallet className="w-5 h-5" />
                  CREATE DUE SALE
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-8 space-y-8 pb-20">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-surface p-6 rounded-2xl border border-border card-shadow border-t-4 border-t-red-500">
                <h3 className="text-secondary text-sm font-medium">Total Outstanding</h3>
                <p className="text-3xl font-black text-foreground mt-1">{formatCurrency(totalOutstanding)}</p>
                <p className="text-xs text-red-500 mt-2 font-bold flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Across {filteredDues.length} customers
                </p>
              </div>
              <div className="bg-surface p-6 rounded-2xl border border-border card-shadow border-t-4 border-t-blue-500">
                <h3 className="text-secondary text-sm font-medium">Expected Today</h3>
                <p className="text-3xl font-black text-foreground mt-1">{formatCurrency(totalOutstanding * 0.1)}</p>
                <p className="text-xs text-blue-500 mt-2 font-bold flex items-center gap-1">
                  <ChevronRight className="w-3 h-3" />
                  Based on installments
                </p>
              </div>
              <div className="bg-surface p-6 rounded-2xl border border-border card-shadow border-t-4 border-t-green-500">
                <h3 className="text-secondary text-sm font-medium">Collections</h3>
                <p className="text-3xl font-black text-foreground mt-1">Healthy</p>
                <p className="text-xs text-green-500 mt-2 font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Recovery on track
                </p>
              </div>
            </div>

            {/* Table */}
            <div className="bg-surface rounded-3xl border border-border card-shadow overflow-hidden">
              <div className="p-6 border-b border-border bg-background/50 flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
                  <input 
                    type="text" 
                    placeholder="Search by customer, phone or invoice..." 
                    value={duesSearch}
                    onChange={(e) => setDuesSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-border outline-none focus:border-primary transition-all bg-white font-medium"
                  />
                </div>
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-4 py-2 text-sm rounded-xl border border-border outline-none focus:border-primary bg-white font-black uppercase tracking-tighter"
                >
                  <option value="ALL">All Status</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="DUE">Full Due</option>
                </select>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-background text-secondary text-[10px] font-black uppercase tracking-widest border-b border-border">
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-6 py-4">Invoice</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Financials</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {loadingDues ? (
                      <tr><td colSpan={6} className="px-6 py-10 text-center text-secondary font-bold animate-pulse">Loading Ledger...</td></tr>
                    ) : filteredDues.map((due) => (
                      <tr key={due.id} className="hover:bg-background/50 transition-colors group">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-primary font-black text-xs">
                              {due.customer?.name?.[0] || 'W'}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground">{due.customer?.name || 'Walking Customer'}</p>
                              <p className="text-xs text-secondary flex items-center gap-1 mt-1">
                                <Phone className="w-3 h-3" /> {due.customer?.phone || 'N/A'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <p className="text-sm font-bold">#{due.invoiceId}</p>
                          <p className="text-xs text-secondary mt-1 line-clamp-1">{due.items?.[0]?.product?.name || 'Items List'}</p>
                        </td>
                        <td className="px-6 py-5">
                          <p className="text-sm text-secondary font-medium">{formatDate(due.createdAt)}</p>
                        </td>
                        <td className="px-6 py-5">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] w-32">
                              <span className="text-secondary">Total:</span>
                              <span className="font-bold">{formatCurrency(due.totalAmount)}</span>
                            </div>
                            <div className="flex justify-between text-[10px] w-32">
                              <span className="text-secondary">Paid:</span>
                              <span className="font-bold text-green-600">{formatCurrency(due.paidAmount)}</span>
                            </div>
                            <div className="flex justify-between text-[10px] w-32 pt-1 border-t border-border/50">
                              <span className="text-secondary font-black">Due:</span>
                              <span className="font-black text-primary">{formatCurrency(due.dueAmount)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${due.status === "PARTIAL" ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                            {due.status}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <button 
                            onClick={() => { setSelectedDue(due); setPayAmount(due.dueAmount); setMessage(null); }}
                            className="bg-primary text-white text-[10px] font-black px-4 py-2 rounded-xl hover:bg-primary/90 transition-all flex items-center gap-2 ml-auto shadow-lg shadow-primary/10"
                          >
                            <CreditCard className="w-3 h-3" />
                            COLLECT
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!loadingDues && filteredDues.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-20 text-center flex flex-col items-center opacity-30">
                          <Users className="w-12 h-12 mb-4" />
                          <p className="font-bold">No dues found matching your query</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
