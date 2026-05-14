"use client";

import { useEffect, useState } from "react";
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Package,
  Users,
  Calendar,
  Download,
  ChevronDown,
  FileSpreadsheet
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import DailySheet from "@/components/daily-activity/DailySheet";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "sheet">("overview");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [range, setRange] = useState("today");
  const [sheetDate, setSheetDate] = useState("");

  useEffect(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    setSheetDate(`${y}-${m}-${d}`);
  }, []);

  useEffect(() => {
    async function fetchReports() {
      setLoading(true);
      try {
        const res = await fetch(`/api/reports?range=${range}`);
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Failed to fetch reports", err);
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, [range]);

  if (activeTab === "sheet") {
    return (
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground">Business Reports</h1>
            <p className="text-xs text-secondary font-bold uppercase tracking-widest mt-1">Daily Activity Sheet</p>
          </div>
          <div className="flex bg-background p-1 rounded-2xl border border-border">
            <button 
              onClick={() => setActiveTab("overview")}
              className="px-6 py-2 rounded-xl text-sm font-black text-secondary hover:text-foreground transition-all"
            >
              Overview
            </button>
            <button 
              onClick={() => setActiveTab("sheet")}
              className="px-6 py-2 rounded-xl text-sm font-black bg-primary text-white shadow-lg shadow-primary/20 transition-all"
            >
              Daily Sheet
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-secondary" />
          <input
            type="date"
            value={sheetDate}
            onChange={(e) => setSheetDate(e.target.value)}
            className="px-4 py-2 rounded-xl border border-border bg-surface text-sm font-bold outline-none focus:border-primary"
          />
        </div>

        <DailySheet date={sheetDate} onDateChange={setSheetDate} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg font-bold text-secondary">Generating Reports...</div>
      </div>
    );
  }

  const summaryCards = [
    {
      label: "Total Sales",
      value: data?.summary?.totalSales || 0,
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-100"
    },
    {
      label: "Net Profit",
      value: data?.summary?.netProfit || 0,
      icon: TrendingUp,
      color: "text-primary",
      bg: "bg-primary/10"
    },
    {
      label: "Cash Collected",
      value: data?.summary?.cashCollected || 0,
      icon: DollarSign,
      color: "text-blue-600",
      bg: "bg-blue-100"
    },
    {
      label: "Net Cash (In Hand)",
      value: data?.summary?.netCash || 0,
      icon: DollarSign,
      color: "text-emerald-600",
      bg: "bg-emerald-100"
    },
    {
      label: "Total Dues",
      value: data?.summary?.totalDue || 0,
      icon: Users,
      color: "text-orange-600",
      bg: "bg-orange-100"
    },
    {
      label: "Total Outflows",
      value: data?.summary?.totalExpenses || 0,
      icon: TrendingDown,
      color: "text-red-600",
      bg: "bg-red-100"
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-foreground">Business Reports</h1>
          <p className="text-xs text-secondary font-bold uppercase tracking-widest mt-1">Financial overview and analytics.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-background p-1 rounded-2xl border border-border">
            <button 
              onClick={() => setActiveTab("overview")}
              className="px-6 py-2 rounded-xl text-sm font-black bg-primary text-white shadow-lg shadow-primary/20 transition-all"
            >
              Overview
            </button>
            <button 
              onClick={() => setActiveTab("sheet")}
              className="px-6 py-2 rounded-xl text-sm font-black text-secondary hover:text-foreground transition-all"
            >
              Daily Sheet
            </button>
          </div>

          <div className="relative">
            <select 
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="appearance-none bg-surface border border-border px-4 py-2 pr-10 rounded-xl font-bold text-sm cursor-pointer"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="bg-surface p-6 rounded-2xl border border-border card-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className={`${card.bg} ${card.color} p-3 rounded-xl`}>
                <card.icon className="w-6 h-6" />
              </div>
            </div>
            <h3 className="text-secondary text-sm font-medium">{card.label}</h3>
            <p className="text-2xl font-black text-foreground mt-1">{formatCurrency(card.value)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Summary */}
        <div className="bg-surface p-6 rounded-2xl border border-border card-shadow">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Inventory Summary
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-background rounded-xl">
              <span className="text-sm font-medium">Total Stock Value</span>
              <span className="font-black text-primary">{formatCurrency(data?.stock?.stockValue || 0)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-background rounded-xl">
              <span className="text-sm font-medium">Products</span>
              <span className="font-black">{data?.stock?.productCount || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-background rounded-xl">
              <span className="text-sm font-medium">Units in Stock</span>
              <span className="font-black">{data?.stock?.unitsInStock || 0}</span>
            </div>
          </div>
        </div>

        {/* Customer Summary */}
        <div className="bg-surface p-6 rounded-2xl border border-border card-shadow">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Customer Ledger
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-background rounded-xl">
              <span className="text-sm font-medium">Total Customers</span>
              <span className="font-black">{data?.customers?.total || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-background rounded-xl">
              <span className="text-sm font-medium">Customers with Dues</span>
              <span className="font-black text-orange-600">{data?.customers?.withDue || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-background rounded-xl">
              <span className="text-sm font-medium">Total Due Outstanding</span>
              <span className="font-black text-red-600">{formatCurrency(data?.customers?.totalDueOutstanding || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sales Transaction Summary */}
      <div className="bg-surface rounded-2xl border border-border card-shadow overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="font-bold">Recent Sales Transactions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-background text-secondary text-[10px] font-black uppercase tracking-widest border-b border-border">
                <th className="px-6 py-4">Invoice</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4">Paid</th>
                <th className="px-6 py-4">Due</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {data?.recentSales?.map((sale: any) => (
                <tr key={sale.id} className="hover:bg-background/50">
                  <td className="px-6 py-4 font-mono text-sm">{sale.invoiceId}</td>
                  <td className="px-6 py-4">{sale.customer?.name || "Walking"}</td>
                  <td className="px-6 py-4 font-bold">{formatCurrency(sale.totalAmount)}</td>
                  <td className="px-6 py-4 text-green-600">{formatCurrency(sale.paidAmount)}</td>
                  <td className="px-6 py-4 text-orange-600">{formatCurrency(sale.dueAmount)}</td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                      sale.status === "PAID" ? "bg-green-100 text-green-700" : 
                      sale.status === "PARTIAL" ? "bg-blue-100 text-blue-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {sale.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-secondary text-sm">{formatDate(sale.createdAt)}</td>
                </tr>
              ))}
              {(!data?.recentSales || data.recentSales.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-secondary italic">
                    No sales transactions in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export All Transactions */}
      <div className="bg-surface rounded-2xl border border-border card-shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">All-Time Transaction Export</h3>
            <p className="text-sm text-secondary mt-1">Download every sale, purchase, expense, loan, and payment in a single Excel sheet.</p>
          </div>
          <button
            onClick={async () => {
              try {
                const res = await fetch("/api/export/transactions");
                if (!res.ok) throw new Error("Export failed");
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "all-transactions.xlsx";
                a.click();
                URL.revokeObjectURL(url);
              } catch (err) {
                console.error("Export failed:", err);
              }
            }}
            className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-primary/90 transition-all shadow-lg"
          >
            <FileSpreadsheet className="w-5 h-5" />
            Export All Transactions
          </button>
        </div>
      </div>
    </div>
  );
}
