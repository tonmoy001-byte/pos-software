"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { EmiReceiptModal } from "./EmiReceiptModal";

export function EmiSaleTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [discount, setDiscount] = useState(0);
  const [emiMonths, setEmiMonths] = useState(6);
  const [interestRate, setInterestRate] = useState(0);
  const [downPayment, setDownPayment] = useState(0);
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [receiptSale, setReceiptSale] = useState(null);

  // Fetch products
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products?status=ACTIVE");
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
  };

  const searchCustomers = async (query: string) => {
    if (query.length < 2) {
      setCustomers([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/customers?search=${encodeURIComponent(query)}`
      );
      const data = await res.json();
      setCustomers(data.customers || []);
    } catch (err) {
      console.error("Failed to search customers:", err);
    }
  };

  const addToCart = (product: any) => {
    const existing = cart.find((item) => item.productId === product.id);
    if (existing) {
      setCart(
        cart.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          productId: product.id,
          name: product.name,
          price: Number(product.price),
          cost: Number(product.cost),
          quantity: 1,
          stock: product.stock,
        },
      ]);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.productId !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(
      cart
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  // Calculations
  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const net = subtotal - discount;
  const interest = net * (interestRate / 100);
  const total = net + interest;
  const effectiveDownPayment =
    downPayment > 0 ? downPayment : total / emiMonths;
  const remaining = total - effectiveDownPayment;
  const monthlyAmount = remaining / (emiMonths - 1);

  const handleCheckout = async () => {
    if (!selectedCustomer) {
      setError("Please select a customer");
      return;
    }
    if (cart.length === 0) {
      setError("Cart is empty");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          })),
          totalAmount: total,
          paidAmount: effectiveDownPayment,
          dueAmount: remaining,
          discount,
          paymentMethod: "EMI",
          saleType: "EMI",
          emiMonths,
          interestRate,
          downPayment: effectiveDownPayment,
          monthlyAmount,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setReceiptSale(data.sale);
      setShowCheckout(false);
      setCart([]);
      setDiscount(0);
      setInterestRate(0);
      setDownPayment(0);
      setSelectedCustomer(null);
      setCustomerSearch("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Product Grid */}
      <div className="lg:col-span-2 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>

        {/* Products */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {products
            .filter(
              (p) =>
                !searchQuery ||
                p.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((product) => (
              <div
                key={product.id}
                className="bg-surface rounded-xl border border-border p-3 hover:border-primary/50 cursor-pointer transition-all"
                onClick={() => addToCart(product)}
              >
                <div className="font-bold text-sm mb-1">{product.name}</div>
                <div className="text-lg font-black text-primary">
                  {Number(product.price).toFixed(2)}
                </div>
                <div className="text-xs text-secondary">
                  Stock: {product.stock}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Cart + Customer */}
      <div className="space-y-4">
        {/* Customer Search */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <label className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2 block">
            Customer (Required)
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
            <input
              type="text"
              placeholder="Search customer..."
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                searchCustomers(e.target.value);
              }}
              className="w-full bg-background border border-border rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:border-primary"
            />
          </div>
          {customers.length > 0 && (
            <div className="mt-2 max-h-32 overflow-y-auto border border-border rounded-xl">
              {customers.map((c) => (
                <div
                  key={c.id}
                  className="p-2 hover:bg-primary/5 cursor-pointer text-sm border-b border-border last:border-0"
                  onClick={() => {
                    setSelectedCustomer(c);
                    setCustomerSearch(c.name);
                    setCustomers([]);
                  }}
                >
                  {c.name} — {c.phone}
                </div>
              ))}
            </div>
          )}
          {selectedCustomer && (
            <div className="mt-2 p-2 bg-primary/5 rounded-xl text-sm font-bold">
              {selectedCustomer.name} — {selectedCustomer.phone}
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <h3 className="font-black text-sm mb-3">
            Cart ({cart.length} items)
          </h3>
          {cart.length === 0 ? (
            <p className="text-xs text-secondary text-center py-4">
              Click products to add
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {cart.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center justify-between p-2 bg-background rounded-lg"
                >
                  <div className="flex-1">
                    <div className="text-sm font-bold">{item.name}</div>
                    <div className="text-xs text-secondary">
                      {item.price.toFixed(2)} each
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.productId, -1)}
                      className="p-1 rounded hover:bg-red-100"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.productId, 1)}
                      className="p-1 rounded hover:bg-green-100"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="p-1 rounded hover:bg-red-100 text-red-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* EMI Config */}
        <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
          <div>
            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1 block">
              Discount
            </label>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1 block">
              Interest Rate (%)
            </label>
            <input
              type="number"
              value={interestRate}
              onChange={(e) => setInterestRate(Number(e.target.value))}
              className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1 block">
              Down Payment
            </label>
            <input
              type="number"
              value={downPayment}
              onChange={(e) => setDownPayment(Number(e.target.value))}
              className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2 block">
              EMI Duration
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[3, 6, 9, 12].map((m) => (
                <button
                  key={m}
                  onClick={() => setEmiMonths(m)}
                  className={`py-2 rounded-xl text-sm font-bold border transition-all ${
                    emiMonths === m
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-background text-secondary hover:border-primary"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="border-t border-border pt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-secondary">Subtotal</span>
              <span>{subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount</span>
                <span>-{discount.toFixed(2)}</span>
              </div>
            )}
            {interestRate > 0 && (
              <div className="flex justify-between text-secondary">
                <span>Interest ({interestRate}%)</span>
                <span>+{interest.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-lg">
              <span>Total</span>
              <span>{total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Down Payment</span>
              <span>{effectiveDownPayment.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Monthly EMI</span>
              <span>{monthlyAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-center gap-2 text-red-700 text-xs font-bold">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <Button
          onClick={() => setShowCheckout(true)}
          disabled={cart.length === 0 || !selectedCustomer}
          className="w-full"
        >
          <CreditCard className="w-4 h-4 mr-2" />
          Create EMI Sale
        </Button>
      </div>

      {/* Checkout Confirmation Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl border border-border p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black">Confirm EMI Sale</h3>
              <button onClick={() => setShowCheckout(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-background rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary">Customer</span>
                <span className="font-bold">{selectedCustomer?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Duration</span>
                <span className="font-bold">{emiMonths} months</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Total</span>
                <span className="font-bold">{total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Down Payment</span>
                <span className="font-bold">
                  {effectiveDownPayment.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Monthly</span>
                <span className="font-bold">{monthlyAmount.toFixed(2)}</span>
              </div>
            </div>

            <Button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirm & Create
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Receipt */}
      {receiptSale && (
        <EmiReceiptModal
          open={!!receiptSale}
          onClose={() => setReceiptSale(null)}
          sale={receiptSale}
        />
      )}
    </div>
  );
}
