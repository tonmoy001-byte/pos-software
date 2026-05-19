"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Search, 
  Plus, 
  Filter, 
  Wallet,
  CheckCircle2,
  X
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function LoansPage() {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "GIVE" | "TAKE">("ALL");

  // Form states
  const [form, setForm] = useState({ personName: "", amount: "", type: "GIVE", description: "" });
  const [payAmount, setPayAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/loans");
      const json = await res.json();
      setLoans(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  const handleAddLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/loans", {
        method: "POST",
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setIsAddOpen(false);
        setForm({ personName: "", amount: "", type: "GIVE", description: "" });
        fetchLoans();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const paymentAmount = Number(payAmount);
    const remaining = Number(selectedLoan?.remaining || 0);
    
    if (!paymentAmount || paymentAmount <= 0) {
      return alert("Please enter a valid payment amount");
    }
    
    if (paymentAmount > remaining) {
      return alert(`Payment amount (${formatCurrency(paymentAmount)}) exceeds remaining balance (${formatCurrency(remaining)})`);
    }
    
    setSubmitting(true);
    try {
      const res = await fetch(`/api/loans/${selectedLoan.id}/payment`, {
        method: "POST",
        body: JSON.stringify({ amount: payAmount })
      });
      if (res.ok) {
        setIsPayOpen(false);
        setPayAmount("");
        fetchLoans();
      } else {
        const data = await res.json();
        alert(data.error || "Payment failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const totalGiven = loans.filter(l => l.type === "GIVE").reduce((acc, l) => acc + Number(l.remaining), 0);
  const totalTaken = loans.filter(l => l.type === "TAKE").reduce((acc, l) => acc + Number(l.remaining), 0);

  const filteredLoans = useMemo(() => {
    let result = loans;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l => l.borrower?.toLowerCase().includes(q));
    }
    if (filterType !== "ALL") {
      result = result.filter(l => l.type === filterType);
    }
    return result;
  }, [loans, searchQuery, filterType]);

  if (loading) return <div className="p-8 animate-pulse text-secondary font-bold">Loading Hawlat Registry...</div>;

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Hawlat (Loans & Transfers)</h1>
          <p className="text-secondary">Track internal loans and cash transfers between parties.</p>
        </div>
        <button 
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all"
        >
          <Plus className="w-5 h-5" />
          Add New Record
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-surface p-6 rounded-2xl border border-border card-shadow border-t-4 border-t-blue-500">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-secondary text-sm font-medium">Total Given (Receivable)</h3>
            <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-foreground">{formatCurrency(totalGiven)}</p>
          <p className="text-xs text-secondary mt-2">Money lent to others</p>
        </div>
        <div className="bg-surface p-6 rounded-2xl border border-border card-shadow border-t-4 border-t-red-500">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-secondary text-sm font-medium">Total Taken (Payable)</h3>
            <div className="bg-red-100 text-red-600 p-2 rounded-lg">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-foreground">{formatCurrency(totalTaken)}</p>
          <p className="text-xs text-secondary mt-2">Money borrowed from others</p>
        </div>
        <div className="bg-surface p-6 rounded-2xl border border-border card-shadow border-t-4 border-t-green-500">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-secondary text-sm font-medium">Net Position</h3>
            <div className="bg-green-100 text-green-600 p-2 rounded-lg">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-foreground">{formatCurrency(totalGiven - totalTaken)}</p>
          <p className="text-xs text-secondary mt-2">Overall loan balance</p>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border card-shadow overflow-hidden">
        <div className="p-6 border-b border-border bg-background/50 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search by person name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-border outline-none focus:border-primary transition-all bg-white"
            />
          </div>
          <button className="flex items-center gap-2 bg-white border border-border px-4 py-2 rounded-lg text-xs font-bold shadow-sm hover:bg-background transition-all">
            <Filter className="w-4 h-4" />
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="bg-transparent outline-none font-bold"
            >
              <option value="ALL">All</option>
              <option value="GIVE">Given</option>
              <option value="TAKE">Taken</option>
            </select>
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-background text-secondary text-[10px] font-black uppercase tracking-widest border-b border-border">
                <th className="px-6 py-4">Person / Entity</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Remaining</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredLoans.map((loan) => (
                <tr key={loan.id} className="hover:bg-background/50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${loan.type === "GIVE" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>
                        {loan.borrower?.[0] || '?'}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{loan.borrower}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-tighter ${loan.type === "GIVE" ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"}`}>
                      {loan.type === "GIVE" ? "Lent (Give)" : "Borrowed (Take)"}
                    </span>
                  </td>
                  <td className="px-6 py-5 font-bold text-sm">
                    {formatCurrency(loan.amount)}
                  </td>
                  <td className="px-6 py-5 font-black text-sm text-primary">
                    {formatCurrency(loan.remaining)}
                  </td>
                  <td className="px-6 py-5 text-xs text-secondary">
                    {formatDate(loan.date)}
                  </td>
                  <td className="px-6 py-5 text-right">
                    {loan.remaining > 0 ? (
                      <button 
                        onClick={() => { setSelectedLoan(loan); setIsPayOpen(true); }}
                        className="bg-primary/10 text-primary hover:bg-primary hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-all border border-primary/20 shadow-sm"
                      >
                        Adjust / Pay
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-green-600 flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Settled
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredLoans.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-secondary italic">
                    {searchQuery || filterType !== "ALL" ? "No loans match your filters." : "No loan records found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Loan Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddLoan} className="bg-surface w-full max-w-md rounded-3xl p-8 card-shadow space-y-6 relative animate-in zoom-in-95 duration-200">
            <button type="button" onClick={() => setIsAddOpen(false)} className="absolute top-6 right-6 text-secondary hover:text-foreground"><X className="w-6 h-6" /></button>
            <h2 className="text-2xl font-bold">New Hawlat Record</h2>
            <div className="space-y-4">
              <div className="flex p-1 bg-background rounded-xl border border-border">
                <button 
                  type="button"
                  onClick={() => setForm({ ...form, type: "GIVE" })}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${form.type === "GIVE" ? "bg-white text-primary shadow-sm" : "text-secondary"}`}
                >Give Loan</button>
                <button 
                  type="button"
                  onClick={() => setForm({ ...form, type: "TAKE" })}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${form.type === "TAKE" ? "bg-white text-primary shadow-sm" : "text-secondary"}`}
                >Take Loan</button>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-secondary uppercase ml-1">Person Name</label>
                <input required value={form.personName} onChange={e => setForm({ ...form, personName: e.target.value })} type="text" className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-secondary uppercase ml-1">Amount (BDT)</label>
                <input required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} type="number" className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-secondary uppercase ml-1">Description (Optional)</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary text-sm h-24" />
              </div>
            </div>
            <button disabled={submitting} type="submit" className="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all">
              {submitting ? "Saving..." : "Create Record"}
            </button>
          </form>
        </div>
      )}

      {/* Pay/Adjust Modal */}
      {isPayOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handlePayLoan} className="bg-surface w-full max-w-sm rounded-3xl p-8 card-shadow space-y-6 relative animate-in zoom-in-95 duration-200">
            <button type="button" onClick={() => setIsPayOpen(false)} className="absolute top-6 right-6 text-secondary hover:text-foreground"><X className="w-6 h-6" /></button>
            <h2 className="text-xl font-bold">Adjust Balance</h2>
            <div className="bg-background p-4 rounded-2xl space-y-2">
              <div className="flex justify-between text-xs text-secondary">
                <span>Person:</span>
                <span className="font-bold text-foreground">{selectedLoan?.borrower}</span>
              </div>
              <div className="flex justify-between text-xs text-secondary">
                <span>Remaining Due:</span>
                <span className="font-bold text-primary">{formatCurrency(selectedLoan?.remaining)}</span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-secondary uppercase ml-1">Amount to Adjust</label>
              <input required value={payAmount} onChange={e => setPayAmount(e.target.value)} type="number" className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary font-bold" />
            </div>
            <button disabled={submitting} type="submit" className="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all">
              {submitting ? "Updating..." : "Confirm Adjustment"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
