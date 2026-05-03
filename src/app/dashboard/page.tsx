"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  TrendingUp, 
  Wallet, 
  CreditCard,
  ArrowDownRight,
  Plus,
  History,
  Package,
  Calculator,
  X,
  Check,
  AlertCircle,
  Search,
  Send,
  Clock
} from "lucide-react";
import { Button, Input, Card, CardTitle, Modal } from "@/components/ui";
import { formatCurrency, formatTime } from "@/lib/utils";
import type { DailySummary, CapitalSummary, TransactionType } from "@/types";

export default function ActivityDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dailySummary, setDailySummary] = useState<any>(null);
  const [capital, setCapital] = useState<any>(null);
  const [customerDue, setCustomerDue] = useState<number>(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  const [activeForm, setActiveForm] = useState<TransactionType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [formData, setFormData] = useState({
    amount: "",
    paid: "",
    description: "",
    mode: "CASH",
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{type: "success"|"error", text: string} | null>(null);
  const [showExpenses, setShowExpenses] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, productsRes, customersRes] = await Promise.all([
        fetch("/api/dashboard/stats"),
        fetch("/api/products"),
        fetch("/api/customers")
      ]);
      
      const statsData = await statsRes.json();
      
      if (statsRes.ok) {
        setDailySummary(statsData.summary);
        setCapital(statsData.capital);
        setCustomerDue(statsData.customerDue || 0);
        setTransactions(statsData.transactions || []);
      } else {
        console.error("Dashboard API error:", statsData);
      }
      
      setProducts(await productsRes.json());
      setCustomers(await customersRes.json());
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveForm(null);
        setSearchQuery("");
      }
      if (e.key === "F2") setActiveForm("SALE");
      if (e.key === "F3") setActiveForm("EXPENSE");
      if (e.key === "F4") router.push("/sales/due");
      if (e.key === "F5") router.push("/inventory");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  const handleQuickSale = async () => {
    if (!selectedProduct && !formData.amount) return;
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ 
            productId: selectedProduct?.id, 
            quantity: 1,
            price: parseFloat(formData.amount) || selectedProduct?.price 
          }],
          totalAmount: parseFloat(formData.amount),
          paidAmount: parseFloat(formData.paid) || parseFloat(formData.amount),
          dueAmount: Math.max(0, parseFloat(formData.amount) - (parseFloat(formData.paid) || 0)),
          customerId: selectedCustomer?.id,
          paymentMethod: formData.mode
        })
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Sale completed!" });
        resetForm();
        fetchData();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Connection error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickExpense = async () => {
    if (!formData.amount) return;
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "EXPENSE",
          amount: formData.amount,
          mode: formData.mode,
          description: formData.description,
        })
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Expense recorded!" });
        resetForm();
        fetchData();
      } else {
        setMessage({ type: "error", text: "Failed" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Connection error" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setActiveForm(null);
    setSearchQuery("");
    setSelectedProduct(null);
    setSelectedCustomer(null);
    setFormData({ amount: "", paid: "", description: "", mode: "CASH" });
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case "SALE": return <TrendingUp className="w-4 h-4 text-green-600" />;
      case "EXPENSE": return <ArrowDownRight className="w-4 h-4 text-red-600" />;
      case "DUE_PAYMENT": return <CreditCard className="w-4 h-4 text-blue-600" />;
      default: return <Wallet className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg font-bold text-secondary">Loading Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6">
      {/* Quick Stats Bar - First Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-green-600">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-5 h-5 text-green-600" />
            <span className="text-sm font-bold text-secondary uppercase">Cash</span>
          </div>
          <p className="text-3xl font-black">{formatCurrency(dailySummary?.netCash || 0)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-blue-600">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-bold text-secondary uppercase">Sales</span>
          </div>
          <p className="text-3xl font-black">{formatCurrency(dailySummary?.totalSales || 0)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-emerald-600">
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-bold text-secondary uppercase">Profit</span>
          </div>
          <p className="text-3xl font-black text-emerald-600">{formatCurrency(dailySummary?.profit || 0)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-orange-600 cursor-pointer hover:border-orange-300" onClick={() => router.push("/customers")}>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <span className="text-sm font-bold text-secondary uppercase">Dues</span>
          </div>
          <p className="text-3xl font-black text-orange-600">{formatCurrency(customerDue)}</p>
        </Card>
      </div>

      {/* Quick Stats Bar - Second Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-purple-600">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-bold text-secondary uppercase">Collections</span>
          </div>
          <p className="text-3xl font-black">{formatCurrency(dailySummary?.collections || 0)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-red-600 cursor-pointer hover:border-red-300" onClick={() => setShowExpenses(true)}>
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownRight className="w-5 h-5 text-red-600" />
            <span className="text-sm font-bold text-secondary uppercase">Expenses</span>
          </div>
          <p className="text-3xl font-black">{formatCurrency(dailySummary?.expenses || 0)}</p>
        </Card>
      </div>


      {/* Main Action Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button onClick={() => router.push("/pos")} size="lg" className="flex justify-between">
          <div>
            <p className="font-bold">New Sale</p>
            <p className="text-xs text-white/70">F2</p>
          </div>
          <Plus className="w-6 h-6" />
        </Button>
        <Button variant="secondary" onClick={() => setActiveForm("EXPENSE")} size="lg" className="flex justify-between">
          <div>
            <p className="font-bold">Expense</p>
            <p className="text-xs text-secondary">F3</p>
          </div>
          <Calculator className="w-6 h-6" />
        </Button>
        <Button variant="secondary" onClick={() => router.push("/sales/due")} size="lg" className="flex justify-between">
          <div>
            <p className="font-bold">Collect Due</p>
            <p className="text-xs text-secondary">F4</p>
          </div>
          <CreditCard className="w-6 h-6" />
        </Button>
        <Button variant="secondary" onClick={() => router.push("/inventory")} size="lg" className="flex justify-between">
          <div>
            <p className="font-bold">Stock In</p>
            <p className="text-xs text-secondary">F5</p>
          </div>
          <Package className="w-6 h-6" />
        </Button>
        <Button variant="secondary" onClick={() => router.push("/sales/advance/ledger")} size="lg" className="flex justify-between">
          <div>
            <p className="font-bold">Advance Ledger</p>
            <p className="text-xs text-secondary">F6</p>
          </div>
          <Clock className="w-6 h-6" />
        </Button>
      </div>

      {/* Transaction Form Modal */}
      <Modal isOpen={!!activeForm} onClose={resetForm} title={activeForm === "SALE" ? "Quick Sale" : "Add Expense"}>
        <div className="space-y-4">
          {activeForm === "SALE" && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Search product..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-border outline-none focus:border-primary font-bold"
                  autoFocus
                />
              </div>
              {searchQuery && (
                <div className="max-h-40 overflow-y-auto border border-border rounded-xl">
                  {products.filter(p => 
                    p.name?.toLowerCase().includes(searchQuery.toLowerCase())
                  ).slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelectedProduct(item);
                        setFormData({ ...formData, amount: item.price?.toString() || "" });
                        setSearchQuery("");
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-background border-b border-border/50"
                    >
                      <p className="font-bold">{item.name}</p>
                    </button>
                  ))}
                </div>
              )}
              {selectedProduct && (
                <div className="flex items-center justify-between bg-green-50 p-3 rounded-xl">
                  <div>
                    <p className="font-bold text-green-800">{selectedProduct.name}</p>
                    <p className="text-xs text-green-600">Stock: {selectedProduct._count?.items || 0}</p>
                  </div>
                  <button onClick={() => setSelectedProduct(null)} className="p-1"><X className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount"
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0"
            />
            {activeForm === "SALE" && (
              <Input
                label="Paid"
                type="number"
                value={formData.paid}
                onChange={(e) => setFormData({ ...formData, paid: e.target.value })}
                placeholder="Full"
              />
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            {["CASH", "BKASH", "BANK", "NAGAD", "CARD"].map((m) => (
              <button
                key={m}
                onClick={() => setFormData({ ...formData, mode: m })}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  formData.mode === m ? "bg-primary text-white" : "bg-background text-secondary"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {activeForm === "EXPENSE" && (
            <Input
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Expense description"
            />
          )}

          {message && (
            <div className={`p-3 rounded-xl text-sm font-bold ${
              message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}>
              {message.text}
            </div>
          )}

          <Button
            onClick={activeForm === "SALE" ? handleQuickSale : handleQuickExpense}
            disabled={submitting || !formData.amount}
            className="w-full"
            size="lg"
          >
            {submitting ? "Processing..." : <><Send className="w-5 h-5" /> Complete</>}
          </Button>
        </div>
      </Modal>

      {/* Expenses List Modal */}
      <Modal isOpen={showExpenses} onClose={() => setShowExpenses(false)} title="Today's Expenses">
        <div className="space-y-3">
          {transactions.filter(tx => tx.type === "EXPENSE").length === 0 ? (
            <p className="py-8 text-center text-secondary italic">No expenses today.</p>
          ) : (
            transactions.filter(tx => tx.type === "EXPENSE").map((expense) => (
              <div key={expense.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
                <div>
                  <p className="font-bold text-sm">{expense.description || "Expense"}</p>
                  <p className="text-xs text-secondary">{formatTime(expense.createdAt)}</p>
                </div>
                <p className="font-bold text-red-600">-{formatCurrency(expense.amount)}</p>
              </div>
            ))
          )}
          {transactions.filter(tx => tx.type === "EXPENSE").length > 0 && (
            <div className="pt-3 border-t border-border">
              <div className="flex justify-between items-center">
                <span className="font-bold text-secondary">Total Expenses</span>
                <span className="text-2xl font-black text-red-600">{formatCurrency(dailySummary?.expenses || 0)}</span>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Today's Activity Feed */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <CardTitle className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Today's Activity
          </CardTitle>
          <span className="text-xs text-secondary">{transactions.length} transactions</span>
        </div>
        <div className="divide-y divide-border/50 max-h-64 overflow-y-auto">
          {transactions.length === 0 ? (
            <p className="py-8 text-center text-secondary italic">No transactions today.</p>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-background p-2 rounded-lg">
                    {getIconForType(tx.type)}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{tx.type}</p>
                    <p className="text-xs text-secondary">{tx.customer?.name || tx.supplier?.name || tx.description}</p>
                  </div>
                </div>
                <p className={`font-bold ${tx.type === "EXPENSE" ? "text-red-600" : "text-green-600"}`}>
                  {tx.type === "EXPENSE" ? "-" : "+"}{formatCurrency(tx.amount)}
                </p>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button variant="ghost" onClick={() => router.push("/loans")} className="justify-start">
          <p className="font-bold">Hawlat</p>
        </Button>
        <Button variant="ghost" onClick={() => router.push("/suppliers")} className="justify-start">
          <p className="font-bold">Suppliers</p>
        </Button>
        <Button variant="ghost" onClick={() => router.push("/second-hand")} className="justify-start">
          <p className="font-bold">Second-Hand</p>
        </Button>
        <Button variant="ghost" onClick={() => router.push("/reports")} className="justify-start">
          <p className="font-bold">Reports</p>
        </Button>
      </div>
    </div>
  );
}