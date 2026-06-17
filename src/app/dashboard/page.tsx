"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp, Wallet, CreditCard, ArrowDownRight, AlertTriangle,
  Package, Calculator, Clock, ShoppingCart, BarChart3,
  Users, ChevronRight, DollarSign, CircleAlert,
  Zap, ArrowUp, ArrowDown, CircleCheck
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Line, Legend
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { safeFetch, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui";

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

function formatDay(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function TrendBadge({ value }: { value: number }) {
  if (value === 0) return <span className="text-xs text-secondary font-bold">&mdash;</span>;
  const isUp = value > 0;
  return (
    <span className={"text-xs font-bold flex items-center gap-0.5 " + (isUp ? "text-green-600" : "text-red-600")}>
      {isUp ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {Math.abs(value)}%
    </span>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: number;
  color: string;
  onClick?: () => void;
}

function StatCard({ title, value, icon, trend, color, onClick }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={"bg-surface p-5 rounded-2xl border border-border card-shadow transition-all hover:shadow-lg " + (onClick ? "cursor-pointer" : "")}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={"w-10 h-10 rounded-xl flex items-center justify-center " + color}>
          {icon}
        </div>
        {trend !== undefined && <TrendBadge value={trend} />}
      </div>
      <p className="text-xs text-secondary font-bold uppercase tracking-widest">{title}</p>
      <p className="text-2xl font-black text-foreground mt-1">{value}</p>
    </div>
  );
}

export default function ExecutiveDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartStart, setChartStart] = useState("");
  const [chartEnd, setChartEnd] = useState("");
  const [formattedDate, setFormattedDate] = useState("");

  function localDateStr(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // Initialize chart dates to last 7 days
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    setChartStart(localDateStr(start));
    setChartEnd(localDateStr(end));
    setFormattedDate(end.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }));
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const json = await safeFetch<any>("/api/dashboard/stats");
      setData(json);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch chart data when dates change
  useEffect(() => {
    if (!chartStart || !chartEnd) return;
    async function fetchChartData() {
      setChartLoading(true);
      try {
        const json = await safeFetch<any>(`/api/dashboard/stats?start=${chartStart}&end=${chartEnd}`);
        const formatted = (json.dailyChartData || []).map((d: any) => ({
          ...d,
          day: formatDay(d.date),
          revenue: Number(d.revenue || 0),
          profit: Number(d.profit || 0),
          expenses: Number(d.expenses || 0),
        }));
        setChartData(formatted);
      } catch (err) {
        console.error("Chart fetch error:", err);
        setChartData([]);
      } finally {
        setChartLoading(false);
      }
    }
    fetchChartData();
  }, [chartStart, chartEnd]);

  // Calculate trends
  const todaySales = Number(data?.summary?.totalSales || 0);
  const yesterdaySales = Number(data?.yesterdaySummary?.totalSales || 0);
  const salesTrend = yesterdaySales > 0 ? Math.round(((todaySales - yesterdaySales) / yesterdaySales) * 100) : 0;

  const todayProfit = Number(data?.summary?.profit || 0);
  const yesterdayProfit = Number(data?.yesterdaySummary?.profit || 0);
  const profitTrend = yesterdayProfit > 0 ? Math.round(((todayProfit - yesterdayProfit) / yesterdayProfit) * 100) : 0;

  const todayExpenses = Number(data?.summary?.expenses || 0);
  const yesterdayExpenses = Number(data?.yesterdaySummary?.expenses || 0);
  const expensesTrend = yesterdayExpenses > 0 ? Math.round(((todayExpenses - yesterdayExpenses) / yesterdayExpenses) * 100) : 0;

  const customerDue = Number(data?.customerDue || 0);
  const yesterdayDue = Number(data?.yesterdaySummary?.collections || 0);
  const dueTrend = yesterdayDue > 0 ? -Math.round(((customerDue - yesterdayDue) / yesterdayDue) * 100) : 0;

  const lowStock = data?.lowStockProducts || [];
  const activities = data?.transactions || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-lg font-bold text-secondary">Loading Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-foreground">Dashboard</h1>
          <p className="text-xs text-secondary font-bold uppercase tracking-widest mt-1">
            {formattedDate}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-surface border border-border rounded-xl text-sm font-bold text-secondary hover:text-foreground transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Sales"
          value={formatCurrency(todaySales)}
          icon={<DollarSign className="w-5 h-5 text-white" />}
          trend={salesTrend}
          color="bg-emerald-500"
        />
        <StatCard
          title="Today's Profit"
          value={formatCurrency(todayProfit)}
          icon={<TrendingUp className="w-5 h-5 text-white" />}
          trend={profitTrend}
          color="bg-blue-500"
        />
        <StatCard
          title="Cash on Hand"
          value={formatCurrency(Number(data?.capital?.netCash || 0))}
          icon={<Wallet className="w-5 h-5 text-white" />}
          color="bg-violet-500"
        />
        <StatCard
          title="Outstanding Dues"
          value={formatCurrency(customerDue)}
          icon={<CreditCard className="w-5 h-5 text-white" />}
          trend={dueTrend}
          color="bg-orange-500"
          onClick={() => router.push("/customers")}
        />
      </div>

      {/* Chart + Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-surface rounded-2xl border border-border card-shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-black text-lg">Revenue Overview</h3>
              <p className="text-xs text-secondary font-bold uppercase tracking-widest mt-0.5">
                {chartStart && chartEnd ? `${formatDay(chartStart)} — ${formatDay(chartEnd)}` : "Select date range"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={chartStart}
                onChange={(e) => setChartStart(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-border text-xs font-bold bg-background outline-none focus:border-primary"
              />
              <span className="text-xs text-secondary font-bold">to</span>
              <input
                type="date"
                value={chartEnd}
                onChange={(e) => setChartEnd(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-border text-xs font-bold bg-background outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="h-64">
            {chartLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-pulse text-sm font-bold text-secondary">Loading chart data...</div>
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-border">
                <p className="text-sm text-secondary font-medium">No chart data available</p>
              </div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v).replace(/\s/g, "")} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                  labelStyle={{ fontWeight: 700 }}
                  formatter={(value: any) => [formatCurrency(value), ""]}
                />
                <Legend />
                <Bar dataKey="revenue" fill="#10b981" name="Revenue" radius={[4, 4, 0, 0]} barSize={24} />
                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} barSize={24} />
                <Line dataKey="profit" stroke="#3b82f6" name="Profit" strokeWidth={2} dot={{ r: 3, fill: "#3b82f6" }} />
              </ComposedChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-surface rounded-2xl border border-border card-shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-black text-lg">Low Stock Alerts</h3>
              <p className="text-xs text-secondary font-bold uppercase tracking-widest mt-0.5">{lowStock.length} products</p>
            </div>
            <CircleAlert className="w-5 h-5 text-amber-500" />
          </div>
          <div className="space-y-3">
            {lowStock.length === 0 ? (
              <div className="py-8 text-center">
                <CircleCheck className="w-10 h-10 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-secondary font-medium">All stocked up!</p>
              </div>
            ) : (
              lowStock.slice(0, 6).map((p: any) => {
                const critical = p.stock === 0;
                const warning = p.stock <= p.minStock;
                return (
                  <div
                    key={p.id}
                    className={"flex items-center justify-between p-3 rounded-xl border " + (critical ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200")}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">{p.name}</p>
                      <p className="text-xs text-secondary">{p.model}</p>
                    </div>
                    <div className="text-right ml-3">
                      <p className={"text-lg font-black " + (critical ? "text-red-600" : "text-amber-600")}>{p.stock}</p>
                      <p className="text-[10px] text-secondary font-bold">min {p.minStock}</p>
                    </div>
                  </div>
                );
              })
            )}
            {lowStock.length > 6 && (
              <button onClick={() => router.push("/inventory")} className="w-full py-2 text-xs font-bold text-primary hover:text-primary/80 transition-colors">
                View all {lowStock.length} products &rarr;
              </button>
            )}
          </div>
          <button
            onClick={() => router.push("/inventory")}
            className="w-full mt-4 py-3 border border-dashed border-border rounded-xl text-sm font-bold text-secondary hover:text-primary hover:border-primary transition-all"
          >
            Manage Inventory
          </button>
        </div>
      </div>

      {/* Today's Activity */}
      <div className="bg-surface rounded-2xl border border-border card-shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-secondary" />
            <div>
              <h3 className="font-black text-lg">Today's Activity</h3>
            </div>
          </div>
          <span className="text-xs font-bold text-secondary bg-background px-3 py-1 rounded-full">
            {activities.length} events
          </span>
        </div>
        <div className="divide-y divide-border/50 max-h-[320px] overflow-y-auto">
          {activities.length === 0 ? (
            <p className="py-8 text-center text-secondary italic">No activity today.</p>
          ) : (
            activities.map((tx: any) => {
              const isSale = tx.type === "SALE";
              const isExpense = tx.type === "EXPENSE";
              const isDue = tx.type === "DUE_PAYMENT";
              const isAdvance = tx.type === "ADVANCE_PAYMENT";

              let icon;
              let bg;
              let sign;
              if (isSale) { icon = <ShoppingCart className="w-4 h-4 text-green-600" />; bg = "bg-green-100"; sign = "+"; }
              else if (isExpense) { icon = <ArrowDownRight className="w-4 h-4 text-red-600" />; bg = "bg-red-100"; sign = "-"; }
              else if (isDue) { icon = <CreditCard className="w-4 h-4 text-blue-600" />; bg = "bg-blue-100"; sign = "+"; }
              else if (isAdvance) { icon = <Zap className="w-4 h-4 text-purple-600" />; bg = "bg-purple-100"; sign = "+"; }
              else { icon = <Wallet className="w-4 h-4" />; bg = "bg-gray-100"; sign = ""; }

              return (
                <div key={tx.id} className="py-3 flex items-center justify-between group">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={"w-9 h-9 rounded-xl flex items-center justify-center shrink-0 " + bg}>
                      {icon}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{tx.description || tx.type}</p>
                      <p className="text-xs text-secondary">
                        {tx.customer || tx.supplier || ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <p className={"font-bold " + (isExpense ? "text-red-600" : "text-green-600")}>
                      {sign}{formatCurrency(tx.amount)}
                    </p>
                    <p className="text-[10px] text-secondary font-medium">{timeAgo(tx.createdAt)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-surface rounded-2xl border border-border card-shadow p-6">
        <h3 className="font-black text-lg mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button onClick={() => router.push("/pos")} size="lg" className="flex items-center justify-between">
            <span className="font-bold">New Sale</span>
            <ShoppingCart className="w-5 h-5" />
          </Button>
          <Button variant="secondary" onClick={() => router.push("/sales/due")} size="lg" className="flex items-center justify-between">
            <span className="font-bold">Collect Due</span>
            <CreditCard className="w-5 h-5" />
          </Button>
          <Button variant="secondary" onClick={() => router.push("/inventory")} size="lg" className="flex items-center justify-between">
            <span className="font-bold">Stock In</span>
            <Package className="w-5 h-5" />
          </Button>
          <Button variant="secondary" onClick={() => router.push("/reports")} size="lg" className="flex items-center justify-between">
            <span className="font-bold">Reports</span>
            <BarChart3 className="w-5 h-5" />
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <Button variant="ghost" onClick={() => router.push("/loans")} className="justify-start">
            <span className="font-bold">Hawlat</span>
          </Button>
          <Button variant="ghost" onClick={() => router.push("/suppliers")} className="justify-start">
            <span className="font-bold">Suppliers</span>
          </Button>
          <Button variant="ghost" onClick={() => router.push("/second-hand")} className="justify-start">
            <span className="font-bold">Second-Hand</span>
          </Button>
          <Button variant="ghost" onClick={() => router.push("/inventory")} className="justify-start">
            <span className="font-bold">Products</span>
          </Button>
        </div>
      </div>

    </div>
  );
}
