"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, DollarSign, TrendingUp, ArrowDownRight, CreditCard,
  Wallet, Clock, Search, X, Check, AlertTriangle, Loader2,
  Download, Printer, FileSpreadsheet, Lock, Ban, Zap
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui";

type EntryType = "SALE" | "PURCHASE" | "EXPENSE" | "HAWLAT" | "ADVANCE" | "DUE" | null;

function timeAgo(date: string | Date) {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.floor(hrs / 24) + "d ago";
}

interface DailySheetProps {
  date: string;
  onDateChange: (date: string) => void;
}

export default function DailySheet({ date, onDateChange }: DailySheetProps) {
  const [sheet, setSheet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeForm, setActiveForm] = useState<EntryType>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [dueSales, setDueSales] = useState<any[]>([]);

  // Form state
  const [saleForm, setSaleForm] = useState({ productSearch: "", productId: "", quantity: 1, price: 0, paidAmount: 0, paymentMethod: "CASH" });
  const [purchaseForm, setPurchaseForm] = useState({ supplierId: "", amount: 0, mode: "CASH", description: "" });
  const [expenseForm, setExpenseForm] = useState({ amount: 0, category: "Other", description: "", mode: "CASH" });
  const [hawlatForm, setHawlatForm] = useState({ personName: "", type: "GIVE" as "GIVE" | "TAKE", amount: 0, mode: "CASH", description: "" });
  const [advanceForm, setAdvanceForm] = useState({ customerId: "", amount: 0, deliveryDate: "", paymentMethod: "CASH" });
  const [dueForm, setDueForm] = useState({ saleId: "", amount: 0, method: "CASH" });
  const [closingCash, setClosingCash] = useState("");
  const [closingNotes, setClosingNotes] = useState("");

  const fetchSheet = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/daily-activity?date=${date}`);
      const json = await res.json();
      if (!res.ok) {
        console.error("Failed to fetch daily sheet", json.error);
        return;
      }
      setSheet(json);
      if (json.cashPosition?.closingCash === null && json.cashPosition?.expectedCash != null) {
        setClosingCash(json.cashPosition.expectedCash.toString());
      }
    } catch (err) {
      console.error("Failed to fetch daily sheet", err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  const fetchLookups = useCallback(async () => {
    try {
      const [pRes, sRes, cRes, dRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/suppliers"),
        fetch("/api/customers"),
        fetch("/api/dues?limit=50"),
      ]);
      setProducts(await pRes.json());
      setSuppliers(await sRes.json());
      setCustomers(await cRes.json());
      const duesJson = await dRes.json();
      setDueSales(duesJson.data || duesJson || []);
    } catch (err) {
      console.error("Failed to fetch lookups", err);
    }
  }, []);

  useEffect(() => { fetchSheet(); fetchLookups(); }, [fetchSheet, fetchLookups]);

  const submitTransaction = async (type: string, data: any) => {
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/daily-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data, date }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: `${type} recorded successfully` });
        resetForm(type as any);
        fetchSheet();
        fetchLookups();
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || `${type} failed` });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Connection error" });
    } finally {
      setSubmitting(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleSaveClosing = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/daily-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "CLOSING", date, data: { closingCash: parseFloat(closingCash), notes: closingNotes } }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Day closed successfully" });
        fetchSheet();
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Failed to close day" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Connection error" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = (type: string) => {
    setActiveForm(null);
    if (type === "SALE") setSaleForm({ productSearch: "", productId: "", quantity: 1, price: 0, paidAmount: 0, paymentMethod: "CASH" });
    if (type === "PURCHASE") setPurchaseForm({ supplierId: "", amount: 0, mode: "CASH", description: "" });
    if (type === "EXPENSE") setExpenseForm({ amount: 0, category: "Other", description: "", mode: "CASH" });
    if (type === "HAWLAT") setHawlatForm({ personName: "", type: "GIVE", amount: 0, mode: "CASH", description: "" });
    if (type === "ADVANCE") setAdvanceForm({ customerId: "", amount: 0, deliveryDate: "", paymentMethod: "CASH" });
    if (type === "DUE") setDueForm({ saleId: "", amount: 0, method: "CASH" });
  };

  const handleDownloadExcel = async () => {
    try {
      const res = await fetch(`/api/daily-activity/export?date=${date}&format=xlsx`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `daily-sheet-${date}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const handlePrintPdf = () => {
    window.open(`/api/daily-activity/export?date=${date}&format=pdf`, "_blank");
  };

  const handleDownloadDetailedExcel = async () => {
    try {
      const res = await fetch(`/api/daily-activity/export?date=${date}&format=detailed-xlsx`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `daily-sheet-${date}-detailed.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-secondary" /><span className="ml-3 text-sm font-bold text-secondary">Loading daily sheet...</span></div>;
  }

  if (!sheet) {
    return <div className="py-20 text-center text-secondary font-bold">Failed to load data</div>;
  }

  const { cashPosition = {}, summary = {}, transactions = [], isLocked = false } = sheet;

  // Filter products for sale form
  const filteredProducts = saleForm.productSearch
    ? products.filter((p: any) =>
        p.name?.toLowerCase().includes(saleForm.productSearch.toLowerCase()) ||
        p.model?.toLowerCase().includes(saleForm.productSearch.toLowerCase())
      ).slice(0, 5)
    : [];

  // Filter customers for advance form
  const filteredCustomers = advanceForm.customerId.length > 1
    ? customers.filter((c: any) =>
        c.name?.toLowerCase().includes(advanceForm.customerId.toLowerCase())
      ).slice(0, 5)
    : [];

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold ${
          message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message.type === "success" ? <Check className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Cash Position Card */}
      <div className="bg-surface rounded-2xl border border-border card-shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-lg">Cash Position</h3>
          {isLocked && (
            <span className="flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
              <Lock className="w-3 h-3" /> LOCKED
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-background p-4 rounded-xl">
            <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Opening Cash</p>
            <p className="text-xl font-black mt-1">{formatCurrency(cashPosition.openingCash)}</p>
          </div>
          <div className="bg-background p-4 rounded-xl">
            <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Expected Cash</p>
            <p className="text-xl font-black mt-1">{formatCurrency(cashPosition.expectedCash)}</p>
          </div>
          <div className="bg-background p-4 rounded-xl border-l-4 border-l-primary">
            <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Actual Closing</p>
            <input
              type="number"
              value={closingCash}
              onChange={(e) => setClosingCash(e.target.value)}
              placeholder="Enter closing cash"
              disabled={isLocked}
              className="w-full bg-transparent text-xl font-black outline-none mt-1 [appearance:textfield]"
            />
          </div>
          <div className="bg-background p-4 rounded-xl">
            <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Difference</p>
            <p className={`text-xl font-black mt-1 ${cashPosition.difference !== null && cashPosition.difference !== 0 ? "text-red-600" : "text-green-600"}`}>
              {cashPosition.difference !== null ? formatCurrency(cashPosition.difference) : "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={closingNotes}
            onChange={(e) => setClosingNotes(e.target.value)}
            placeholder="Add notes..."
            disabled={isLocked}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium bg-background outline-none focus:border-primary"
          />
          <Button
            onClick={handleSaveClosing}
            disabled={submitting || isLocked || !closingCash}
            size="sm"
          >
            {isLocked ? <><Lock className="w-4 h-4" /> Closed</> : <><Check className="w-4 h-4" /> Save & Lock</>}
          </Button>
        </div>
      </div>

      {/* Quick Entry Bar */}
      <div className="flex flex-wrap gap-2">
        {[
          { type: "SALE" as EntryType, label: "Sale", icon: <TrendingUp className="w-4 h-4" />, color: "bg-emerald-500" },
          { type: "PURCHASE" as EntryType, label: "Purchase", icon: <PackageIcon className="w-4 h-4" />, color: "bg-blue-500" },
          { type: "EXPENSE" as EntryType, label: "Expense", icon: <ArrowDownRight className="w-4 h-4" />, color: "bg-red-500" },
          { type: "HAWLAT" as EntryType, label: "Hawlat", icon: <Wallet className="w-4 h-4" />, color: "bg-purple-500" },
          { type: "ADVANCE" as EntryType, label: "Advance", icon: <Zap className="w-4 h-4" />, color: "bg-amber-500" },
          { type: "DUE" as EntryType, label: "Due Coll.", icon: <CreditCard className="w-4 h-4" />, color: "bg-cyan-500" },
        ].map((btn) => (
          <button
            key={btn.type}
            onClick={() => setActiveForm(activeForm === btn.type ? null : btn.type)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeForm === btn.type
                ? `${btn.color} text-white shadow-lg`
                : "bg-surface border border-border text-secondary hover:text-foreground hover:border-primary"
            }`}
          >
            {btn.icon}
            {btn.label}
            <Plus className={`w-3.5 h-3.5 transition-transform ${activeForm === btn.type ? "rotate-45" : ""}`} />
          </button>
        ))}
      </div>

      {/* Active Form */}
      {activeForm && (
        <div className="bg-surface rounded-2xl border border-border card-shadow p-6 animate-in slide-in-from-top-2 duration-200">
          {/* Sale Form */}
          {activeForm === "SALE" && (
            <div className="space-y-4">
              <h4 className="font-bold text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" /> New Sale</h4>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
                <input type="text" placeholder="Search product..." value={saleForm.productSearch}
                  onChange={(e) => setSaleForm({ ...saleForm, productSearch: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm font-medium" />
                {filteredProducts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-surface border border-border rounded-xl mt-1 shadow-xl z-10 max-h-48 overflow-y-auto">
                    {filteredProducts.map((p: any) => (
                      <button key={p.id}
                        onClick={() => setSaleForm({ ...saleForm, productId: p.id, productSearch: `${p.name} (${p.model})`, price: Number(p.price) || 0, paidAmount: Number(p.price) || 0 })}
                        className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-background border-b border-border/50 last:border-0">
                        {p.name} — {formatCurrency(p.price)} (Stock: {p.stock})
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Qty</label>
                  <input type="number" value={saleForm.quantity} min={1}
                    onChange={(e) => setSaleForm({ ...saleForm, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm font-bold mt-1" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Price</label>
                  <input type="number" value={saleForm.price}
                    onChange={(e) => { const p = parseFloat(e.target.value) || 0; setSaleForm({ ...saleForm, price: p, paidAmount: p }); }}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm font-bold mt-1" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Paid</label>
                  <input type="number" value={saleForm.paidAmount}
                    onChange={(e) => setSaleForm({ ...saleForm, paidAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm font-bold mt-1" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Payment</label>
                  <select value={saleForm.paymentMethod}
                    onChange={(e) => setSaleForm({ ...saleForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm font-bold mt-1">
                    {["CASH", "BANK", "BKASH", "NAGAD", "CARD"].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-lg font-black">Total: {formatCurrency(saleForm.price * saleForm.quantity)}</span>
                <div className="flex gap-2">
                  <button onClick={() => setActiveForm(null)} className="px-4 py-2 text-sm font-bold text-secondary hover:text-foreground">Cancel</button>
                  <Button disabled={submitting || !saleForm.productId || !saleForm.price}
                    onClick={() => submitTransaction("SALE", {
                      productId: saleForm.productId, quantity: saleForm.quantity,
                      price: saleForm.price, totalAmount: saleForm.price * saleForm.quantity,
                      paidAmount: saleForm.paidAmount, paymentMethod: saleForm.paymentMethod,
                    })} size="sm">
                    {submitting ? "Saving..." : "Save Sale"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Purchase Form */}
          {activeForm === "PURCHASE" && (
            <div className="space-y-4">
              <h4 className="font-bold text-sm flex items-center gap-2"><PackageIcon className="w-4 h-4 text-blue-500" /> New Purchase</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Supplier</label>
                  <select value={purchaseForm.supplierId}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, supplierId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm font-bold mt-1">
                    <option value="">Select supplier</option>
                    {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Amount</label>
                  <input type="number" value={purchaseForm.amount}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm font-bold mt-1" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Mode</label>
                  <select value={purchaseForm.mode}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, mode: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm font-bold mt-1">
                    {["CASH", "BANK", "BKASH", "NAGAD", "CARD", "DUE"].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Description</label>
                  <input type="text" value={purchaseForm.description}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm font-bold mt-1" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setActiveForm(null)} className="px-4 py-2 text-sm font-bold text-secondary hover:text-foreground">Cancel</button>
                <Button disabled={submitting || !purchaseForm.supplierId || !purchaseForm.amount}
                  onClick={() => submitTransaction("PURCHASE", purchaseForm)} size="sm">
                  {submitting ? "Saving..." : "Save Purchase"}
                </Button>
              </div>
            </div>
          )}

          {/* Expense Form */}
          {activeForm === "EXPENSE" && (
            <div className="space-y-4">
              <h4 className="font-bold text-sm flex items-center gap-2"><ArrowDownRight className="w-4 h-4 text-red-500" /> New Expense</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Amount</label>
                  <input type="number" value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm font-bold mt-1" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Category</label>
                  <select value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm font-bold mt-1">
                    {["Rent", "Utilities", "Salary", "Office", "Transport", "Marketing", "Maintenance", "Other"].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Mode</label>
                  <select value={expenseForm.mode}
                    onChange={(e) => setExpenseForm({ ...expenseForm, mode: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm font-bold mt-1">
                    {["CASH", "BANK", "BKASH", "NAGAD", "CARD"].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Description</label>
                  <input type="text" value={expenseForm.description}
                    onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm font-bold mt-1" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setActiveForm(null)} className="px-4 py-2 text-sm font-bold text-secondary hover:text-foreground">Cancel</button>
                <Button disabled={submitting || !expenseForm.amount}
                  onClick={() => submitTransaction("EXPENSE", expenseForm)} size="sm">
                  {submitting ? "Saving..." : "Save Expense"}
                </Button>
              </div>
            </div>
          )}

          {/* Hawlat Form */}
          {activeForm === "HAWLAT" && (
            <div className="space-y-4">
              <h4 className="font-bold text-sm flex items-center gap-2"><Wallet className="w-4 h-4 text-purple-500" /> New Hawlat (Loan)</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Borrower</label>
                  <input type="text" value={hawlatForm.personName}
                    onChange={(e) => setHawlatForm({ ...hawlatForm, personName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm font-bold mt-1" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Type</label>
                  <select value={hawlatForm.type}
                    onChange={(e) => setHawlatForm({ ...hawlatForm, type: e.target.value as "GIVE" | "TAKE" })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm font-bold mt-1">
                    <option value="GIVE">Give (Lend)</option>
                    <option value="TAKE">Take (Borrow)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Amount</label>
                  <input type="number" value={hawlatForm.amount}
                    onChange={(e) => setHawlatForm({ ...hawlatForm, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm font-bold mt-1" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Mode</label>
                  <select value={hawlatForm.mode}
                    onChange={(e) => setHawlatForm({ ...hawlatForm, mode: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm font-bold mt-1">
                    {["CASH", "BANK", "BKASH", "NAGAD", "CARD"].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setActiveForm(null)} className="px-4 py-2 text-sm font-bold text-secondary hover:text-foreground">Cancel</button>
                <Button disabled={submitting || !hawlatForm.personName || !hawlatForm.amount}
                  onClick={() => submitTransaction("HAWLAT", hawlatForm)} size="sm">
                  {submitting ? "Saving..." : "Save Hawlat"}
                </Button>
              </div>
            </div>
          )}

          {/* Advance Form */}
          {activeForm === "ADVANCE" && (
            <div className="space-y-4">
              <h4 className="font-bold text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> New Advance Order</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Customer</label>
                  <select value={advanceForm.customerId}
                    onChange={(e) => setAdvanceForm({ ...advanceForm, customerId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm font-bold mt-1">
                    <option value="">Select customer</option>
                    {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Amount</label>
                  <input type="number" value={advanceForm.amount}
                    onChange={(e) => setAdvanceForm({ ...advanceForm, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm font-bold mt-1" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Delivery Date</label>
                  <input type="date" value={advanceForm.deliveryDate}
                    onChange={(e) => setAdvanceForm({ ...advanceForm, deliveryDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm font-bold mt-1" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setActiveForm(null)} className="px-4 py-2 text-sm font-bold text-secondary hover:text-foreground">Cancel</button>
                <Button disabled={submitting || !advanceForm.customerId || !advanceForm.amount}
                  onClick={() => submitTransaction("ADVANCE", advanceForm)} size="sm">
                  {submitting ? "Saving..." : "Save Advance"}
                </Button>
              </div>
            </div>
          )}

          {/* Due Collection Form */}
          {activeForm === "DUE" && (
            <div className="space-y-4">
              <h4 className="font-bold text-sm flex items-center gap-2"><CreditCard className="w-4 h-4 text-cyan-500" /> Collect Due</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Sale</label>
                  <select value={dueForm.saleId}
                    onChange={(e) => {
                      const sale = dueSales.find((d: any) => d.id === e.target.value);
                      setDueForm({ ...dueForm, saleId: e.target.value, amount: sale ? Number(sale.dueAmount) : 0 });
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm font-bold mt-1">
                    <option value="">Select due sale</option>
                    {dueSales.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.invoiceId} — {d.customer?.name || "Walk-in"} ({formatCurrency(d.dueAmount)} due)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Amount</label>
                  <input type="number" value={dueForm.amount}
                    onChange={(e) => setDueForm({ ...dueForm, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm font-bold mt-1" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Method</label>
                  <select value={dueForm.method}
                    onChange={(e) => setDueForm({ ...dueForm, method: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm font-bold mt-1">
                    {["CASH", "BANK", "BKASH", "NAGAD", "CARD"].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setActiveForm(null)} className="px-4 py-2 text-sm font-bold text-secondary hover:text-foreground">Cancel</button>
                <Button disabled={submitting || !dueForm.saleId || !dueForm.amount}
                  onClick={() => submitTransaction("DUE", dueForm)} size="sm">
                  {submitting ? "Collecting..." : "Collect Payment"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Daily Summary */}
      <div className="bg-surface rounded-2xl border border-border card-shadow p-6">
        <h3 className="font-black text-lg mb-4">Daily Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-background p-4 rounded-xl border-t-4 border-t-emerald-500">
            <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Total Sales</p>
            <p className="text-xl font-black text-emerald-600 mt-1">{formatCurrency(summary.totalSales)}</p>
            <div className="flex gap-2 mt-2 text-[10px] text-secondary">
              <span>Cash: {formatCurrency(summary.cashSales)}</span>
              <span>Card: {formatCurrency(summary.cardSales)}</span>
            </div>
          </div>
          <div className="bg-background p-4 rounded-xl border-t-4 border-t-blue-500">
            <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Purchases</p>
            <p className="text-xl font-black text-blue-600 mt-1">{formatCurrency(summary.totalPurchases)}</p>
          </div>
          <div className="bg-background p-4 rounded-xl border-t-4 border-t-red-500">
            <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Expenses</p>
            <p className="text-xl font-black text-red-600 mt-1">{formatCurrency(summary.totalExpenses)}</p>
          </div>
          <div className="bg-background p-4 rounded-xl border-t-4 border-t-cyan-500">
            <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Due Collected</p>
            <p className="text-xl font-black text-cyan-600 mt-1">{formatCurrency(summary.totalDuePaid)}</p>
          </div>
          <div className="bg-background p-4 rounded-xl border-t-4 border-t-purple-500">
            <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Hawlat Given</p>
            <p className="text-xl font-black text-purple-600 mt-1">{formatCurrency(summary.totalHawlatGiven)}</p>
          </div>
          <div className="bg-background p-4 rounded-xl border-t-4 border-t-teal-500">
            <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Hawlat Received</p>
            <p className="text-xl font-black text-teal-600 mt-1">{formatCurrency(summary.totalHawlatReceived)}</p>
          </div>
          <div className="bg-background p-4 rounded-xl border-t-4 border-t-amber-500">
            <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Total Profit</p>
            <p className="text-xl font-black text-amber-600 mt-1">{formatCurrency(summary.totalProfit)}</p>
          </div>
          <div className="bg-background p-4 rounded-xl border-t-4 border-t-green-500">
            <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Net Cash</p>
            <p className="text-xl font-black text-green-600 mt-1">{formatCurrency(cashPosition.expectedCash)}</p>
          </div>
        </div>
      </div>

      {/* Transaction Log */}
      <div className="bg-surface rounded-2xl border border-border card-shadow overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-secondary" />
            <h3 className="font-black text-lg">Transaction Log</h3>
          </div>
          <span className="text-xs font-bold text-secondary bg-background px-3 py-1 rounded-full">
            {transactions.length} entries
          </span>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {transactions.length === 0 ? (
            <div className="py-12 text-center text-secondary italic font-medium">No transactions today.</div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-background text-[10px] font-black uppercase tracking-widest text-secondary border-b border-border">
                  <th className="px-6 py-3">Time</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {transactions.map((tx: any) => {
                  const isOutflow = ["PURCHASE", "EXPENSE", "HAWLAT_GIVEN"].includes(tx.type);
                  const isInflow = ["DUE_PAYMENT", "HAWLAT_RECEIVED"].includes(tx.type);
                  return (
                    <tr key={tx.id} className="hover:bg-background/50 text-sm">
                      <td className="px-6 py-3 text-secondary">{timeAgo(tx.createdAt)}</td>
                      <td className="px-6 py-3">
                        <span className={`text-[10px] font-black px-2 py-1 rounded-full ${
                          tx.type === "SALE" ? "bg-green-100 text-green-700" :
                          tx.type === "PURCHASE" ? "bg-blue-100 text-blue-700" :
                          tx.type === "EXPENSE" ? "bg-red-100 text-red-700" :
                          tx.type === "DUE_PAYMENT" ? "bg-cyan-100 text-cyan-700" :
                          tx.type === "HAWLAT_GIVEN" ? "bg-purple-100 text-purple-700" :
                          tx.type === "HAWLAT_RECEIVED" ? "bg-teal-100 text-teal-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>{tx.type}</span>
                      </td>
                      <td className="px-6 py-3 text-secondary font-medium">{tx.description || "—"}</td>
                      <td className={`px-6 py-3 text-right font-bold ${
                        isOutflow ? "text-red-600" : isInflow ? "text-blue-600" : "text-green-600"
                      }`}>
                        {isOutflow ? "-" : "+"}{formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Export */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleDownloadExcel} variant="secondary" className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          Download Excel
        </Button>
        <Button onClick={handleDownloadDetailedExcel} variant="secondary" className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          Download Detailed Excel
        </Button>
        <Button onClick={handlePrintPdf} variant="secondary" className="flex items-center gap-2">
          <Printer className="w-4 h-4" />
          Save PDF
        </Button>
      </div>
    </div>
  );
}

function PackageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.5 9.4 7.55 4.24" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.29 7 12 12 20.71 7" /><line x1="12" y1="22" x2="12" y2="12" />
    </svg>
  );
}
