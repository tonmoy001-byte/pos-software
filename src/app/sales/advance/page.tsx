"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, 
  User, 
  Trash2, 
  Plus, 
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
  Wallet,
  Clock,
  ClipboardList,
  Phone,
  Filter
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ReceiptModal } from "@/components/invoice";

export default function AdvanceOrderPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"sale" | "ledger">("sale");
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [customerType, setCustomerType] = useState<"WALKING" | "REGISTERED">("WALKING");
  const [discount, setDiscount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [advancePercent, setAdvancePercent] = useState(30);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [isIMEIOpen, setIsIMEIOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [tempSelectedImeis, setTempSelectedImeis] = useState<string[]>([]);
  
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [invoiceSettings, setInvoiceSettings] = useState<any>(null);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", address: "" });
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [currentStore, setCurrentStore] = useState<any>(null);
  const [advances, setAdvances] = useState<any[]>([]);
  const [advancesLoading, setAdvancesLoading] = useState(false);
  const [duesSearch, setDuesSearch] = useState("");

  const fetchAdvances = async () => {
    setAdvancesLoading(true);
    try {
      const res = await fetch("/api/advances");
      const data = await res.json();
      setAdvances(data);
    } catch (err) {
      console.error("Failed to fetch advances:", err);
    }
    setAdvancesLoading(false);
  };

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

  const addToCart = (product: any) => {
    const availableStock = product._count?.items ?? 0;
    if (availableStock > 0) {
      setError(`Product available in stock (${availableStock} units). Please complete sale from POS sales page.`);
      setTimeout(() => setError(null), 4000);
      return;
    }
    const newItem = {
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      imeis: [],
      cost: product.cost || 0
    };
    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      setCart(cart.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, newItem]);
    }
  };

  const handleBarcodeScan = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      const foundProduct = products.find(p => 
        p.items?.some((item: any) => item.imei === barcodeInput.trim() || item.barcode === barcodeInput.trim())
      );
      const foundByProductBarcode = products.find(p => p.barcode === barcodeInput.trim());
      const found = foundProduct || foundByProductBarcode;
      if (found) {
        addToCart(found);
        setBarcodeInput("");
      } else {
        setError("Product not found for this IMEI/Barcode");
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  const focusBarcodeInput = () => {
    barcodeInputRef.current?.focus();
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
    const advanceAmount = (total * advancePercent) / 100;
    setPaidAmount(advanceAmount);
    setIsCheckoutOpen(true);
  };

  const handleCheckout = async () => {
    setError(null);
    if (cart.length === 0) return setError("Cart is empty");
    
    for (const item of cart) {
      if (item.imeis.length !== item.quantity) {
        return setError(`Please select ${item.quantity} IMEIs for ${item.name}`);
      }
    }

    setSubmitting(true);
    
    const payload = {
      customerId: selectedCustomer?.id || null,
      items: cart,
      totalAmount: total,
      paidAmount: paidAmount,
      dueAmount: Math.max(0, total - paidAmount),
      discount: discount,
      paymentMethod: paymentMethod,
      saleType: "ADVANCE_ORDER",
      advancePercent,
      deliveryDate: deliveryDate || null
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
    setDiscount(0);
    setSelectedCustomer(null);
    setPaidAmount(0);
    fetch("/api/products").then(res => res.json()).then(setProducts);
  };

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const total = subtotal - discount;
  const advanceAmount = (total * advancePercent) / 100;
  const remainingDue = total - advanceAmount;

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.brand.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="p-8 animate-pulse text-secondary font-bold">Loading Inventory...</div>;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {isIMEIOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-lg rounded-3xl p-8 card-shadow space-y-6 relative animate-in zoom-in-95 duration-200">
            <button onClick={() => { setIsIMEIOpen(false); setTempSelectedImeis([]); }} className="absolute top-6 right-6 text-secondary hover:text-foreground">
              <X className="w-6 h-6" />
            </button>
            
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto">
                <SmartphoneNfc className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold">Select IMEIs</h2>
              <p className="text-sm text-secondary">Select the specific units for {selectedProduct.name}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto p-2">
              {selectedProduct.items?.map((item: any) => {
                const isSelected = tempSelectedImeis.includes(item.imei);
                return (
                  <button
                    key={item.imei}
                    onClick={() => {
                      if (isSelected) setTempSelectedImeis(prev => prev.filter(i => i !== item.imei));
                      else setTempSelectedImeis(prev => [...prev, item.imei]);
                    }}
                    className={`p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
                  >
                    <div>
                      <p className="text-[10px] font-black text-secondary uppercase tracking-widest">IMEI / Serial</p>
                      <p className="text-sm font-bold">{item.imei}</p>
                    </div>
                    {isSelected && <Check className="w-5 h-5 text-primary" />}
                  </button>
                );
              })}
              {(!selectedProduct.items || selectedProduct.items.length === 0) && (
                <div className="col-span-2 py-10 text-center text-secondary italic border-2 border-dashed border-border rounded-2xl">
                  No available units found for this model.
                </div>
              )}
            </div>

            <div className="flex gap-4 pt-4">
              <button onClick={() => { setIsIMEIOpen(false); setTempSelectedImeis([]); }} className="flex-1 py-4 bg-background border border-border rounded-2xl font-bold text-secondary hover:bg-surface transition-all">
                Cancel
              </button>
              <button 
                disabled={tempSelectedImeis.length === 0}
                onClick={() => confirmIMEIs(selectedProduct, tempSelectedImeis)}
                className="flex-1 py-4 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
              >
                Add {tempSelectedImeis.length} Units
              </button>
            </div>
          </div>
        </div>
      )}

      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-2xl rounded-[2.5rem] p-10 card-shadow space-y-8 relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setIsCheckoutOpen(false)} className="absolute top-8 right-8 text-secondary hover:text-foreground transition-colors">
              <X className="w-8 h-8" />
            </button>
            
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-primary text-white rounded-[1.25rem] flex items-center justify-center shadow-lg shadow-primary/20">
                <Clock className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tight">Advance Order</h2>
                <p className="text-secondary font-medium">Book order with advance payment</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-10">
<div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-secondary uppercase tracking-widest px-1">Advance Percentage</label>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {[10, 20, 30, 50].map(p => (
                      <button
                        key={p}
                        onClick={() => setAdvancePercent(p)}
                        className={`py-3 rounded-xl font-bold text-sm transition-all ${advancePercent === p ? 'bg-primary text-white' : 'bg-background border border-border'}`}
                      >
                        {p}%
                      </button>
                    ))}
                  </div>
                  <input 
                    type="number" 
                    value={advancePercent} 
                    onChange={(e) => setAdvancePercent(Number(e.target.value))}
                    className="w-full py-3 bg-background rounded-xl border-2 border-border px-4 font-bold mt-2"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-secondary uppercase tracking-widest px-1">Expected Delivery Date</label>
                  <input 
                    type="date" 
                    value={deliveryDate} 
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full py-3 bg-background rounded-xl border-2 border-border px-4 font-bold mt-2"
                  />
                </div>
              </div>

              <div className="space-y-6 bg-background/50 p-8 rounded-[2rem] border-2 border-border">
                <div className="space-y-4">
                  <div className="flex justify-between text-secondary font-bold">
                    <span>Total Order Value</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                  
                  <div>
                    <label className="text-xs font-black text-secondary uppercase tracking-widest">Advance Amount</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-primary text-xl">৳</div>
                      <input 
                        type="number" 
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(Number(e.target.value))}
                        className="w-full pl-10 pr-4 py-6 bg-surface rounded-2xl border-2 border-primary/20 text-3xl font-black text-primary outline-none focus:border-primary transition-all"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t-2 border-border space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-secondary">Remaining Due</span>
                      <span className="text-xl font-black text-secondary">
                        {formatCurrency(remainingDue)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-secondary">Delivery Date</span>
                      <span className="text-sm font-bold text-primary">{deliveryDate || "Not set"}</span>
                    </div>
                  </div>
                </div>

                <button 
                  disabled={submitting}
                  onClick={handleCheckout}
                  className="w-full py-6 bg-gradient-to-r from-primary to-primary/80 text-white rounded-2xl font-black text-xl shadow-2xl shadow-primary/40 hover:shadow-primary/60 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {submitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Processing...
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                        <Check className="w-6 h-6" />
                      </div>
                      Confirm Advance Order
                    </>
                  )}
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

      <div className="bg-surface border-b border-border px-8 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-black text-foreground">Advance Orders</h1>
            <p className="text-xs text-secondary font-bold uppercase tracking-widest mt-1">
              {activeTab === "sale" ? "Create New Advance Order" : "Advance Orders Ledger"}
            </p>
          </div>
          <div className="flex bg-background p-1 rounded-2xl border border-border">
            <button 
              onClick={() => setActiveTab("sale")}
              className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'sale' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-secondary hover:text-foreground'}`}
            >
              New Order
            </button>
            <button 
              onClick={() => { setActiveTab("ledger"); fetchAdvances(); }}
              className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'ledger' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-secondary hover:text-foreground'}`}
            >
              Ledger
            </button>
          </div>
        </div>
      </div>

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
                    <div key={product.id} onClick={() => addToCart(product)} className={`bg-surface p-4 rounded-2xl border ${(product._count?.items ?? 0) > 0 ? 'border-green-300 opacity-60' : 'border-border hover:border-primary/30'} cursor-pointer group transition-all`}>
                      <div className="aspect-square bg-background rounded-xl mb-4 flex items-center justify-center relative overflow-hidden">
                        <Smartphone className={`w-12 h-12 ${(product._count?.items ?? 0) > 0 ? 'text-green-300' : 'text-primary/20 group-hover:scale-110'} transition-transform`} />
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
                        {(!product._count?.items || product._count.items <= 0) && (
                          <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all"><Plus className="w-4 h-4" /></div>
                        )}
                        {product._count?.items > 0 && (
                          <span className="text-xs font-bold text-green-600">Use POS Sale</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="w-[400px] bg-surface border-l border-border flex flex-col shadow-2xl">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-black mb-4">Customer Details</h3>
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
                      <p className="text-xs text-secondary mt-1">{selectedCustomer.phone}</p>
                    </div>
                    <button onClick={() => setSelectedCustomer(null)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <button onClick={() => setIsAddingCustomer(true)} className="w-full mt-4 py-3 border-2 border-dashed border-border rounded-xl text-sm font-bold text-secondary hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Add New Customer
                  </button>
                )}
                {isAddingCustomer && (
                  <div className="mt-4 p-4 bg-background rounded-2xl border border-border space-y-3">
                    <input placeholder="Customer Name" value={newCustomer.name} onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-border text-sm font-medium" />
                    <input placeholder="Phone Number" value={newCustomer.phone} onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-border text-sm font-medium" />
                    <div className="flex gap-2">
                      <button onClick={() => setIsAddingCustomer(false)} className="flex-1 py-2 bg-secondary/10 text-secondary rounded-lg text-sm font-bold">Cancel</button>
                      <button onClick={handleAddCustomer} disabled={!newCustomer.name || !newCustomer.phone} className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-bold disabled:opacity-50">Save</button>
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
              <button onClick={() => setIsCheckoutOpen(true)} disabled={cart.length === 0 || !selectedCustomer} className="w-full p-6 border-t border-border bg-gradient-to-r from-primary to-primary/80 text-white font-black text-lg shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div>Create Advance Order</div>
                  {!selectedCustomer && <div className="text-xs font-medium text-white/70">Select customer first</div>}
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="Search by customer or invoice..." 
                  value={duesSearch} 
                  onChange={(e) => setDuesSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-surface border border-border outline-none font-medium"
                />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-background text-secondary text-[10px] font-black uppercase tracking-widest border-b border-border">
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Invoice</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Financials</th>
                    <th className="px-6 py-4">Delivery</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {advancesLoading ? (
                    <tr><td colSpan={7} className="px-6 py-10 text-center text-secondary font-bold animate-pulse">Loading Ledger...</td></tr>
                  ) : advances.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-20 text-center flex flex-col items-center opacity-30"><ClipboardList className="w-12 h-12 mb-4" /><p className="font-bold">No advance orders found</p></td></tr>
                  ) : advances.map((advance) => (
                    <tr key={advance.id} className="hover:bg-background/50 transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-primary font-black text-xs">
                            {advance.customer?.name?.[0] || 'W'}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{advance.customer?.name || 'Walking Customer'}</p>
                            <p className="text-xs text-secondary flex items-center gap-1 mt-1">
                              <Phone className="w-3 h-3" /> {advance.customer?.phone || 'N/A'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm font-bold">#{advance.invoiceNumber}</p>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm text-secondary font-medium">{new Date(advance.createdAt).toLocaleDateString()}</p>
                      </td>
                      <td className="px-6 py-5">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] w-32">
                            <span className="text-secondary">Total:</span>
                            <span className="font-bold">{formatCurrency(advance.total)}</span>
                          </div>
                          <div className="flex justify-between text-[10px] w-32">
                            <span className="text-secondary">Paid:</span>
                            <span className="font-bold text-green-600">{formatCurrency(advance.paidAmount)}</span>
                          </div>
                          <div className="flex justify-between text-[10px] w-32 pt-1 border-t border-border/50">
                            <span className="text-secondary font-black">Due:</span>
                            <span className="font-black text-primary">{formatCurrency(advance.total - advance.paidAmount)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm font-medium">{advance.deliveryDate ? new Date(advance.deliveryDate).toLocaleDateString() : '-'}</p>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${advance.status === "PENDING" ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                          {advance.status}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        {advance.status === "PENDING" && (
                          <button className="bg-primary text-white text-[10px] font-black px-4 py-2 rounded-xl hover:bg-primary/90 transition-all flex items-center gap-2 ml-auto shadow-lg shadow-primary/10">
                            <Check className="w-3 h-3" />
                            COMPLETE
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

