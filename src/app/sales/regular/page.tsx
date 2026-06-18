"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Eye, RefreshCw, ShoppingCart, Clock, CreditCard, Calculator, Truck, Package, RotateCcw } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { ReceiptModal } from "@/components/invoice";
import { Pagination } from "@/components/products/Pagination";

interface Sale {
  id: string;
  invoiceId: string;
  saleType: string;
  customerName: string;
  customerPhone: string;
  items: any[];
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  discount: number;
  paymentMethod: string;
  createdAt: string;
}

const saleTypeConfig: Record<string, { label: string; icon: any; color: string; bgColor: string; textColor: string; hrefPrefix: string }> = {
  REGULAR: { label: "Regular", icon: ShoppingCart, color: "bg-primary", bgColor: "bg-primary/10", textColor: "text-primary", hrefPrefix: "/sales/pos" },
  DUE: { label: "Due", icon: CreditCard, color: "bg-red-500", bgColor: "bg-red-100", textColor: "text-red-600", hrefPrefix: "/sales/due" },
  EMI: { label: "EMI", icon: Calculator, color: "bg-purple-500", bgColor: "bg-purple-100", textColor: "text-purple-600", hrefPrefix: "/sales/emi" },
  ADVANCE_ORDER: { label: "Advance", icon: Clock, color: "bg-orange-500", bgColor: "bg-orange-100", textColor: "text-orange-600", hrefPrefix: "/sales/advance" },
  EXCHANGE: { label: "Exchange", icon: RefreshCw, color: "bg-green-500", bgColor: "bg-green-100", textColor: "text-green-600", hrefPrefix: "/sales/exchange" },
  ONLINE: { label: "Online", icon: Truck, color: "bg-cyan-500", bgColor: "bg-cyan-100", textColor: "text-cyan-600", hrefPrefix: "/sales/online" },
  WHOLESALE: { label: "Wholesale", icon: Package, color: "bg-indigo-500", bgColor: "bg-indigo-100", textColor: "text-indigo-600", hrefPrefix: "/sales/wholesale" },
  RETURN: { label: "Return", icon: RotateCcw, color: "bg-pink-500", bgColor: "bg-pink-100", textColor: "text-pink-600", hrefPrefix: "/sales/return" },
  REPAIR: { label: "Repair", icon: Calculator, color: "bg-yellow-500", bgColor: "bg-yellow-100", textColor: "text-yellow-600", hrefPrefix: "/sales/repair" },
};

export default function AllSalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [saleTypeFilter, setSaleTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "partial" | "due" | "refunded">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [showReceipt, setShowReceipt] = useState(false);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [invoiceSettings, setInvoiceSettings] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      const res = await fetch(`/api/sales?${params}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (Array.isArray(data?.sales) ? data.sales : []);
      setSales(list);
      if (data?.pagination) {
        setTotal(data.pagination.total || 0);
        setTotalPages(data.pagination.totalPages || 0);
      }
    } catch (err) {
      console.error("Failed to fetch sales", err);
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    fetchSales();
    fetchInvoiceSettings();
  }, [fetchSales]);

  const fetchInvoiceSettings = async () => {
    try {
      const res = await fetch("/api/invoice-settings");
      if (res.ok) setInvoiceSettings(await res.json());
    } catch (err) {
      console.error("Failed to fetch settings", err);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [searchQuery, saleTypeFilter, statusFilter, dateFilter, limit]);

  const getStatus = (sale: Sale) => {
    if (sale.discount > 0 && sale.totalAmount <= 0) return "refunded";
    if (sale.dueAmount <= 0) return "paid";
    if (sale.paidAmount <= 0) return "due";
    return "partial";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid": return { bg: "bg-green-100", text: "text-green-700", label: "Paid" };
      case "due": return { bg: "bg-red-100", text: "text-red-700", label: "Due" };
      case "partial": return { bg: "bg-yellow-100", text: "text-yellow-700", label: "Partial" };
      case "refunded": return { bg: "bg-pink-100", text: "text-pink-700", label: "Refunded" };
      default: return { bg: "bg-gray-100", text: "text-gray-700", label: "Unknown" };
    }
  };

  const getSaleTypeInfo = (saleType: string) => {
    return saleTypeConfig[saleType] || saleTypeConfig["REGULAR"];
  };

  const getViewHref = (sale: Sale) => {
    const typeInfo = getSaleTypeInfo(sale.saleType);
    return `${typeInfo.hrefPrefix}?invoice=${sale.invoiceId}`;
  };

  const filterSales = () => {
    return sales.filter(sale => {
      const searchMatch = !searchQuery || 
        sale.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sale.invoiceId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sale.customerPhone?.includes(searchQuery);
      
      const status = getStatus(sale);
      const statusMatch = statusFilter === "all" || status === statusFilter;
      
      const saleTypeMatch = saleTypeFilter === "all" || sale.saleType === saleTypeFilter;
      
      let dateMatch = true;
      if (dateFilter !== "all") {
        const saleDate = new Date(sale.createdAt);
        const now = new Date();
        if (dateFilter === "today") {
          dateMatch = saleDate.toDateString() === now.toDateString();
        } else if (dateFilter === "week") {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateMatch = saleDate >= weekAgo;
        } else if (dateFilter === "month") {
          dateMatch = saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
        }
      }
      
      return searchMatch && statusMatch && saleTypeMatch && dateMatch;
    });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  const filteredSales = filterSales();
  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalPaid = filteredSales.reduce((sum, s) => sum + s.paidAmount, 0);
  const totalDue = filteredSales.reduce((sum, s) => sum + s.dueAmount, 0);

  const saleTypeOptions = Object.keys(saleTypeConfig);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-pulse text-secondary font-medium">Loading All Sales...</div>
      </div>
    );
  }

  return (
    <div className="p-6 h-screen overflow-hidden flex flex-col">
      <div className="bg-surface rounded-2xl border border-border shadow-sm flex-1 flex flex-col overflow-hidden">
        <div className="p-5 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-foreground">All Sales</h1>
              <p className="text-sm text-secondary">Master sales transaction ledger</p>
            </div>
            <button onClick={fetchSales} className="p-2 hover:bg-background rounded-lg transition-colors" title="Refresh">
              <RefreshCw className="w-4 h-4 text-secondary" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
              <p className="text-xs text-secondary mb-1">Total Revenue</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-xl border border-green-200">
              <p className="text-xs text-secondary mb-1">Total Received</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-xl border border-red-200">
              <p className="text-xs text-secondary mb-1">Total Due</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(totalDue)}</p>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
              <input
                type="text"
                placeholder="Search customer, invoice, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary/50"
              />
            </div>

            <select
              value={saleTypeFilter}
              onChange={(e) => setSaleTypeFilter(e.target.value)}
              className="px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none"
            >
              <option value="all">All Types</option>
              {saleTypeOptions.map(type => (
                <option key={type} value={type}>{saleTypeConfig[type].label}</option>
              ))}
            </select>

            <div className="flex gap-1 p-1 bg-background rounded-xl border border-border">
              {(["all", "paid", "partial", "due", "refunded"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    statusFilter === f ? "bg-primary text-white" : "text-secondary hover:text-foreground"
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex gap-1 p-1 bg-background rounded-xl border border-border">
              {(["all", "today", "week", "month"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setDateFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    dateFilter === f ? "bg-primary text-white" : "text-secondary hover:text-foreground"
                  }`}
                >
                  {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredSales.length === 0 ? (
            <div className="p-12 text-center text-secondary">
              <p className="text-sm">No sales found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-background sticky top-0 z-10">
                <tr className="text-left text-xs text-secondary font-medium">
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Products</th>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Due</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSales.map((sale) => {
                  const status = getStatus(sale);
                  const statusBadge = getStatusBadge(status);
                  const typeInfo = getSaleTypeInfo(sale.saleType);
                  const productNames = sale.items?.map((item: any) => item.name).join(", ") || "No products";
                  
                  return (
                    <tr key={sale.id} className="hover:bg-background/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
                            {sale.customerName?.[0] || "W"}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {sale.customerName || "Walking Customer"}
                            </p>
                            <p className="text-xs text-secondary">{sale.customerPhone || "-"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-foreground truncate max-w-[150px]">{productNames}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-secondary">{sale.invoiceId}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${typeInfo.bgColor} ${typeInfo.textColor}`}>
                          <typeInfo.icon className="w-3 h-3" />
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-foreground">{formatDate(sale.createdAt)}</p>
                        <p className="text-xs text-secondary">{formatTime(sale.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-foreground">{formatCurrency(sale.totalAmount)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-green-600">{formatCurrency(sale.paidAmount)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {sale.dueAmount > 0 ? (
                          <span className="text-sm font-semibold text-red-600">{formatCurrency(sale.dueAmount)}</span>
                        ) : (
                          <span className="text-sm text-secondary">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedSale(sale);
                              setShowReceipt(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-4 border-t border-border bg-background">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={setLimit}
          />
        </div>
      </div>
      <ReceiptModal 
        isOpen={showReceipt}
        onClose={() => {
          setShowReceipt(false);
          setSelectedSale(null);
        }}
        data={selectedSale}
        settings={invoiceSettings}
      />
    </div>
  );
}