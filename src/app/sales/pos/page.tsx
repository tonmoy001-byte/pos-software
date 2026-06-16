"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { 
  Search, 
  User, 
  Trash2, 
  Plus,
  Minus,
  Scan, 
  Receipt, 
  CreditCard, 
  Banknote,
  Percent,
  Users,
  Smartphone,
  Check,
  SmartphoneNfc,
  X,
  UserPlus,
  Wallet
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { playBeep } from "@/lib/audio";
import { InvoiceRenderer, ReceiptModal } from "@/components/invoice";

export default function POSPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [customerType, setCustomerType] = useState<"WALKING" | "REGISTERED">("WALKING");
  const [discount, setDiscount] = useState("");
  const [error, setError] = useState<string | null>(null);

  
  
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", address: "" });
const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [currentStore, setCurrentStore] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [invoiceSettings, setInvoiceSettings] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch("/api/products");
        const json = await res.json();
        // Handle both paginated response { products: [...] } and legacy array response
        setProducts(Array.isArray(json) ? json : (json.products || []));
      } catch (err) {
        console.error("Failed to fetch products", err);
      } finally {
        setLoading(false);
      }
    }
    async function fetchStoreData() {
      try {
        const res = await fetch("/api/settings/store");
        const storeData = await res.json();
        setCurrentStore(storeData);
      } catch (err) {
        console.error("Failed to fetch store", err);
      }
    }
    async function fetchInvoiceSettings() {
      try {
        const res = await fetch("/api/invoice-settings");
        if (res.ok) {
          const data = await res.json();
          setInvoiceSettings(data);
        }
      } catch (err) {
        console.error("Failed to fetch invoice settings", err);
      }
    }
    fetchProducts();
    fetchStoreData();
    fetchInvoiceSettings();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (customerSearch.length > 1) {
        const res = await fetch(`/api/customers?query=${customerSearch}`);
        const data = await res.json();
        setCustomerResults(data.data || []);
      } else {
        setCustomerResults([]);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [customerSearch]);

  const addToCart = (product: any) => {
    // Block if product is out of stock
    if (!product.stock || product.stock <= 0) {
      return;
    }
    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      // Check if adding more exceeds available stock
      if (existing.quantity >= product.stock) {
        return;
      }
      setCart(cart.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { productId: product.id, name: product.name, price: product.price, quantity: 1 }]);
    }
  };

  // Instant barcode detection - no need to press Enter
  useEffect(() => {
    if (!barcodeInput.trim() || barcodeInput.length < 3) return;
    
    const timer = setTimeout(() => {
      const trimmed = barcodeInput.trim();
      const found = products.find(p => p.barcode === trimmed);
      
      if (found) {
        addToCart(found);
        playBeep(true);
        setBarcodeInput("");
      } else if (barcodeInput.length >= 8) {
        setError("Product not found");
        playBeep(false);
        setTimeout(() => setError(null), 3000);
        setBarcodeInput("");
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [barcodeInput, products]);

  const handleBarcodeScan = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      const found = products.find(p => p.barcode === barcodeInput.trim());
      if (found) {
        addToCart(found);
        setBarcodeInput("");
      } else {
        setError("Product not found");
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  const focusBarcodeInput = () => {
    barcodeInputRef.current?.focus();
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const handleAddCustomer = async () => {
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCustomer)
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedCustomer(data);
        setIsAddingCustomer(false);
        setNewCustomer({ name: "", phone: "", address: "" });
      } else {
        alert(data.error || "Failed to add customer");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openCheckout = () => {
    if (cart.length === 0) return setError("Cart is empty");
    setPaidAmount(String(total));
    setIsCheckoutOpen(true);
  };

  const handleCheckout = async () => {
    setError(null);
    if (cart.length === 0) return setError("Cart is empty");

    setSubmitting(true);
    
    const payload = {
      customerId: selectedCustomer?.id || null,
      items: cart,
      totalAmount: total,
      paidAmount: Number(paidAmount) || 0,
      dueAmount: Math.max(0, total - (Number(paidAmount) || 0)),
      discount: Number(discount) || 0,
      paymentMethod: paymentMethod
    };

    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setLastSale(data);
        setIsCheckoutOpen(false);
        setShowReceipt(true);
      } else {
        setError(data.error || "Checkout failed");
      }
    } catch (err) {
      setError("Checkout failed - connection error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseReceipt = () => {
    setShowReceipt(false);
    setLastSale(null);
    setCart([]);
    setDiscount("");
    setSelectedCustomer(null);
    setPaidAmount("");
    fetch("/api/products").then(res => res.json()).then(data => setProducts(Array.isArray(data) ? data : (data.products || [])));
  };

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const total = subtotal - (Number(discount) || 0);

  const lowerQuery = searchQuery.toLowerCase();
  const filteredProducts = useMemo(() => products.filter(p => 
    (p.name || "").toLowerCase().includes(lowerQuery) ||
    (p.model || "").toLowerCase().includes(lowerQuery) ||
    (p.brand || "").toLowerCase().includes(lowerQuery)
  ), [products, lowerQuery]);

  if (loading) return <div className="p-8 animate-pulse text-secondary font-bold">Loading POS Inventory...</div>;

  return (
    <div className="flex h-screen overflow-hidden">
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-2xl rounded-[2.5rem] p-10 card-shadow space-y-8 relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setIsCheckoutOpen(false)} className="absolute top-8 right-8 text-secondary hover:text-foreground transition-colors">
              <X className="w-8 h-8" />
            </button>
            
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-primary text-white rounded-[1.25rem] flex items-center justify-center shadow-lg shadow-primary/20">
                <Receipt className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tight">Complete Checkout</h2>
                <p className="text-secondary font-medium">Finalize payment and generate invoice</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-10">
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-xs font-black text-secondary uppercase tracking-widest">Customer Information</label>
                    <button onClick={() => setIsAddingCustomer(!isAddingCustomer)} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                      <UserPlus className="w-3 h-3" />
                      {isAddingCustomer ? "Search Existing" : "New Customer"}
                    </button>
                  </div>

                  {isAddingCustomer ? (
                    <div className="space-y-3 p-5 bg-background rounded-3xl border-2 border-primary/10 animate-in slide-in-from-top-2">
                      <input placeholder="Full Name" value={newCustomer.name} onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})} className="w-full bg-transparent border-b border-border py-2 text-sm outline-none focus:border-primary font-bold" />
                      <input placeholder="Phone Number" value={newCustomer.phone} onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})} className="w-full bg-transparent border-b border-border py-2 text-sm outline-none focus:border-primary font-bold" />
                      <button onClick={handleAddCustomer} className="w-full py-3 bg-primary/10 text-primary rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all">
                        Create & Select
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      {selectedCustomer ? (
                        <div className="p-4 bg-primary/5 border-2 border-primary rounded-2xl flex items-center justify-between group">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center font-black">
                              {selectedCustomer.name[0]}
                            </div>
                            <div>
                              <p className="text-sm font-black">{selectedCustomer.name}</p>
                              <p className="text-[10px] text-secondary font-bold">{selectedCustomer.phone}</p>
                            </div>
                          </div>
                          <button onClick={() => setSelectedCustomer(null)} className="text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
                          <input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Search by name or phone..." className="w-full pl-12 pr-4 py-4 rounded-2xl bg-background border-2 border-border focus:border-primary outline-none transition-all font-bold text-sm" />
                          {customerResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-surface border-2 border-border rounded-2xl mt-2 overflow-hidden z-10 shadow-xl">
                              {customerResults.map(c => (
                                <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); setCustomerResults([]); }} className="w-full p-4 text-left hover:bg-primary/5 transition-colors border-b border-border last:border-0 flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-black">{c.name}</p>
                                    <p className="text-xs text-secondary font-medium">{c.phone}</p>
                                  </div>
                                  <Plus className="w-4 h-4 text-primary" />
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black text-secondary uppercase tracking-widest px-1">Payment Method</label>
                  <div className="grid grid-cols-2 gap-3">
                    {["CASH", "BKASH", "NAGAD", "CARD", "DUE"].map(m => (
                      <button
                        key={m}
                        onClick={() => {
                          setPaymentMethod(m);
                          if (m === "DUE") {
                            setPaidAmount("");
                          } else {
                            setPaidAmount(String(total));
                          }
                        }}
                        className={`py-4 rounded-2xl border-2 font-bold text-xs transition-all flex items-center justify-center gap-2 ${paymentMethod === m ? 'border-primary bg-primary text-white shadow-lg shadow-primary/20' : 'border-border text-secondary hover:border-primary/30'}`}
                      >
                        {m === "CASH" && <Banknote className="w-4 h-4" />}
                        {m === "CARD" && <CreditCard className="w-4 h-4" />}
                        {(m === "BKASH" || m === "NAGAD") && <Wallet className="w-4 h-4" />}
                        {m === "DUE" && <Receipt className="w-4 h-4" />}
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6 bg-background/50 p-8 rounded-[2rem] border-2 border-border">
                <div className="space-y-4">
                  <div className="flex justify-between text-secondary font-bold">
                    <span>Invoice Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-black text-secondary uppercase tracking-widest">Amount Paid</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-primary text-xl">৳</div>
                      <input 
                        type="number" 
                        value={paidAmount || undefined}
                        onChange={(e) => setPaidAmount(e.target.value)}
                        placeholder="0"
                        className="w-full pl-10 pr-4 py-6 bg-surface rounded-2xl border-2 border-primary/20 text-3xl font-black text-primary outline-none focus:border-primary transition-all"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t-2 border-border space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-secondary">Remaining Due</span>
                      <span className={`text-xl font-black ${total - (Number(paidAmount) || 0) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {formatCurrency(Math.max(0, total - (Number(paidAmount) || 0)))}
                      </span>
                    </div>
                    {paymentMethod === "DUE" && !selectedCustomer && (
                      <p className="text-[10px] text-red-500 font-bold bg-red-50 p-2 rounded-lg border border-red-100 flex items-center gap-1">
                        <Users className="w-3 h-3" /> Customer selection required for due
                      </p>
                    )}
                  </div>
                </div>

                <button 
                  disabled={submitting || (paymentMethod === "DUE" && !selectedCustomer)}
                  onClick={handleCheckout}
                  className="w-full py-6 bg-primary text-white rounded-2xl font-black text-xl shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {submitting ? "Processing..." : paymentMethod === "DUE" ? <><Receipt className="w-6 h-6" /> Create Due Sale</> : <><Receipt className="w-6 h-6" /> Finalize Sale</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ReceiptModal 
        isOpen={showReceipt}
        onClose={handleCloseReceipt}
        data={lastSale}
        settings={invoiceSettings}
      />

      <div className="flex-1 flex flex-col p-6 space-y-6 overflow-hidden">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search by Product Name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-surface border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all card-shadow"
            />
            <input ref={barcodeInputRef} type="text" value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} onKeyDown={handleBarcodeScan} placeholder="Scan barcode..." className="hidden" />
          </div>
          <button onClick={focusBarcodeInput} className="bg-primary/10 text-primary p-4 rounded-2xl border border-primary/20 hover:bg-primary/20 transition-colors" title="Click to scan barcode">
            <Scan className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProducts.map((product) => {
              const isOutOfStock = !product.stock || product.stock <= 0;
              return (
                <div 
                  key={product.id} 
                  onClick={() => !isOutOfStock && addToCart(product)}
                  className={`bg-surface p-4 rounded-2xl border ${isOutOfStock ? 'border-gray-200 opacity-60 cursor-not-allowed' : 'border-green-300 cursor-pointer group transition-all'}`}
                >
                  <div className="aspect-square bg-background rounded-xl mb-4 flex items-center justify-center relative overflow-hidden">
                    {product.metadata?.imageUrl ? (
                      <img src={product.metadata.imageUrl} alt={product.name} className="w-full h-full object-contain p-3" />
                    ) : (
                      <Smartphone className={`w-12 h-12 ${isOutOfStock ? 'text-gray-300' : 'text-green-400 group-hover:scale-110'} transition-transform`} />
                    )}
                    <span className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-1 rounded-md ${isOutOfStock ? 'bg-gray-500 text-white' : 'bg-green-500 text-white'}`}>
                      {isOutOfStock ? 'OUT OF STOCK' : 'IN STOCK'}
                  </span>
                  {(product.stock ?? 0) > 0 && (
                    <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-1 rounded-md bg-white/90 text-green-600">
                      {product.stock || 0} units
                    </span>
                  )}
                  {(product.advanceOrderQuantity ?? 0) > 0 && (
                    <span className="absolute bottom-2 left-2 text-[10px] font-bold px-2 py-1 rounded-md bg-orange-500 text-white">
                      {product.advanceOrderQuantity} in Advance Order
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-sm">{product.name}</h4>
                <p className="text-xs text-secondary mt-1">{product.model} | {product.brand}</p>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/50">
                  <span className="font-black text-primary">{formatCurrency(product.price)}</span>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${!isOutOfStock ? 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white' : 'bg-gray-200 text-gray-400'}`}>
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
          {filteredProducts.length === 0 && (
            <p className="text-secondary italic col-span-full text-center py-8">No products in inventory.</p>
          )}
        </div>
      </div>
      </div>

      <div className="w-[500px] bg-surface border-l border-border flex flex-col card-shadow">
        <div className="p-6 border-b border-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">Customer Information</h3>
              <p className="text-xs text-secondary">Select or add customer</p>
            </div>
            <button onClick={() => setCart([])} className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-200 text-sm font-bold flex items-center justify-between">
              {error}
              <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex p-1 bg-background rounded-xl border border-border flex-1">
                <button onClick={() => { setCustomerType("WALKING"); setSelectedCustomer(null); }} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${customerType === "WALKING" ? "bg-white text-primary shadow-sm" : "text-secondary"}`}>
                  <User className="w-4 h-4" />
                  Walking
                </button>
                <button onClick={() => setCustomerType("REGISTERED")} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${customerType === "REGISTERED" ? "bg-white text-primary shadow-sm" : "text-secondary"}`}>
                  <Users className="w-4 h-4" />
                  Registered
                </button>
              </div>
              <button onClick={() => { setIsAddingCustomer(true); setCustomerType("REGISTERED"); }} className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors ml-2" title="Add New Customer">
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {isAddingCustomer && (
              <div className="p-4 bg-background rounded-xl border-2 border-primary/20 space-y-3">
                <p className="text-xs font-bold text-secondary uppercase">Add New Customer</p>
                <input placeholder="Full Name" value={newCustomer.name} onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-border text-sm" />
                <input placeholder="Phone Number" value={newCustomer.phone} onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-border text-sm" />
                <div className="flex gap-2">
                  <button onClick={() => setIsAddingCustomer(false)} className="flex-1 py-2 bg-secondary/10 text-secondary rounded-lg text-sm font-bold">Cancel</button>
                  <button onClick={handleAddCustomer} disabled={!newCustomer.name || !newCustomer.phone} className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-bold disabled:opacity-50">Save</button>
                </div>
              </div>
            )}

            {customerType === "REGISTERED" && !isAddingCustomer && (
              <div className="relative">
                {selectedCustomer ? (
                  <div className="p-3 bg-primary/5 border-2 border-primary rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      <span className="font-bold text-sm">{selectedCustomer.name}</span>
                      <span className="text-xs text-secondary">({selectedCustomer.phone})</span>
                    </div>
                    <button onClick={() => setSelectedCustomer(null)} className="text-secondary hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary w-4 h-4 z-10" />
                    <input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Search customer..." className="w-full pl-10 pr-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary outline-none transition-all font-bold text-sm" />
                    {customerResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-surface border-2 border-border rounded-xl mt-1 overflow-hidden z-20 shadow-xl">
                        {customerResults.map(c => (
                          <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); setCustomerResults([]); }} className="w-full p-3 text-left hover:bg-primary/5 transition-colors border-b border-border last:border-0 flex items-center justify-between">
                            <div>
                              <p className="font-bold text-sm">{c.name}</p>
                              <p className="text-xs text-secondary">{c.phone}</p>
                            </div>
                            {Number(c.dueAmount) > 0 && (
                              <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded">
                                Due: {c.dueAmount}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cart.map((item) => (
            <div key={item.productId} className="p-4 bg-background rounded-2xl border border-border group">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-black text-sm">{item.name}</p>
                  <button 
                    onClick={() => {
                      const newPrice = prompt("Enter new price:", item.price.toString());
                      if (newPrice && !isNaN(Number(newPrice))) {
                        setCart(cart.map(c => c.productId === item.productId ? { ...c, price: Number(newPrice) } : c));
                      }
                    }}
                    className="text-[10px] text-primary hover:underline"
                  >
                    Unit: {formatCurrency(item.price)}
                  </button>
                </div>
                <button 
                  onClick={() => removeFromCart(item.productId)}
                  className="text-secondary hover:text-red-500 p-1 transition-colors"
                >
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
            <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
              <Smartphone className="w-16 h-16 mb-4" />
              <p className="font-bold">Your cart is empty</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-background border-t border-border space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-secondary">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-sm text-secondary">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4" />
                <span>Discount</span>
              </div>
              <input type="number" value={discount || undefined} onChange={(e) => setDiscount(e.target.value)} className="w-20 text-right bg-transparent border-b border-border outline-none focus:border-primary text-foreground font-bold" />
            </div>
            <div className="flex justify-between text-xl font-black text-foreground pt-2 border-t border-border/50">
              <span>Total Payable</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <button disabled={submitting} onClick={() => { setPaymentMethod("CASH"); setPaidAmount(String(total)); openCheckout(); }} className="flex items-center justify-center gap-2 py-4 bg-white border border-border rounded-2xl font-bold text-sm text-secondary hover:bg-surface transition-all disabled:opacity-50">
              <Banknote className="w-5 h-5" />
              Cash
            </button>
            <button disabled={submitting} onClick={() => { if (!selectedCustomer) { setError("Select customer first"); return; } setPaymentMethod("DUE"); setPaidAmount(""); openCheckout(); }} className="flex items-center justify-center gap-2 py-4 bg-white border border-border rounded-2xl font-bold text-sm text-secondary hover:bg-surface transition-all disabled:opacity-50">
              <Receipt className="w-5 h-5" />
              Due
            </button>
            <button disabled={submitting} onClick={() => { setPaidAmount(String(total)); openCheckout(); }} className="flex items-center justify-center gap-2 py-4 bg-white border border-border rounded-2xl font-bold text-sm text-secondary hover:bg-surface transition-all disabled:opacity-50">
              <Receipt className="w-5 h-5" />
              Quick Pay
            </button>
          </div>

          <button disabled={submitting} onClick={openCheckout} className="w-full flex items-center justify-center gap-3 py-5 bg-primary text-white rounded-2xl font-black text-lg shadow-xl shadow-primary/30 hover:scale-[1.02] transition-all group disabled:opacity-50">
            <Receipt className="w-6 h-6 group-hover:rotate-12 transition-transform" />
            {submitting ? "Processing..." : "Complete Checkout"}
          </button>
        </div>
      </div>
    </div>
  );
}