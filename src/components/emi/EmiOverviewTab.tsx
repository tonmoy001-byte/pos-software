"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Search,
  Eye,
} from "lucide-react";

interface EmiOverviewTabProps {
  onViewSale: (sale: any) => void;
}

export function EmiOverviewTab({ onViewSale }: EmiOverviewTabProps) {
  const [summary, setSummary] = useState({
    totalActive: 0,
    totalOutstanding: 0,
    overdueCount: 0,
    collectedThisMonth: 0,
  });
  const [sales, setSales] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [summaryRes, salesRes] = await Promise.all([
        fetch("/api/emi/summary"),
        fetch("/api/emi-sales"),
      ]);
      const summaryData = await summaryRes.json();
      const salesData = await salesRes.json();
      setSummary(summaryData);
      setSales(salesData.sales || []);
    } catch (error) {
      console.error("Failed to fetch EMI data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSales = sales.filter((sale) => {
    if (!filter) return true;
    const search = filter.toLowerCase();
    return (
      sale.invoiceNumber?.toLowerCase().includes(search) ||
      sale.customer?.name?.toLowerCase().includes(search) ||
      sale.customer?.phone?.includes(search)
    );
  });

  const statusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-700";
      case "OVERDUE":
        return "bg-red-100 text-red-700";
      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-bold text-secondary uppercase">
              Active EMIs
            </span>
          </div>
          <div className="text-2xl font-black">{summary.totalActive}</div>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-yellow-500" />
            <span className="text-xs font-bold text-secondary uppercase">
              Outstanding
            </span>
          </div>
          <div className="text-2xl font-black">
            {(Number(summary.totalOutstanding) || 0).toFixed(2)}
          </div>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-xs font-bold text-secondary uppercase">
              Overdue
            </span>
          </div>
          <div className="text-2xl font-black text-red-600">
            {summary.overdueCount}
          </div>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-green-500" />
            <span className="text-xs font-bold text-secondary uppercase">
              Collected (Month)
            </span>
          </div>
          <div className="text-2xl font-black">
            {(Number(summary.collectedThisMonth) || 0).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
        <input
          type="text"
          placeholder="Search by invoice, customer name, or phone..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary"
        />
      </div>

      {/* Sales Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left p-3 text-[10px] font-bold text-secondary uppercase">
                  Invoice
                </th>
                <th className="text-left p-3 text-[10px] font-bold text-secondary uppercase">
                  Customer
                </th>
                <th className="text-left p-3 text-[10px] font-bold text-secondary uppercase">
                  Date
                </th>
                <th className="text-right p-3 text-[10px] font-bold text-secondary uppercase">
                  Total
                </th>
                <th className="text-right p-3 text-[10px] font-bold text-secondary uppercase">
                  Paid
                </th>
                <th className="text-right p-3 text-[10px] font-bold text-secondary uppercase">
                  Remaining
                </th>
                <th className="text-center p-3 text-[10px] font-bold text-secondary uppercase">
                  Status
                </th>
                <th className="text-left p-3 text-[10px] font-bold text-secondary uppercase">
                  Next Due
                </th>
                <th className="text-center p-3 text-[10px] font-bold text-secondary uppercase">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center py-8 text-secondary"
                  >
                    No EMI sales found
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="border-b border-border hover:bg-background/50"
                  >
                    <td className="p-3 font-bold">{sale.invoiceNumber}</td>
                    <td className="p-3">{sale.customer?.name}</td>
                    <td className="p-3 text-secondary">
                      {new Date(sale.date).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      {Number(sale.totalAmount).toFixed(2)}
                    </td>
                    <td className="p-3 text-right text-green-600">
                      {Number(sale.paidAmount).toFixed(2)}
                    </td>
                    <td className="p-3 text-right text-red-600">
                      {Number(sale.dueAmount).toFixed(2)}
                    </td>
                    <td className="p-3 text-center">
                      <Badge className={statusColor(sale.status)}>
                        {sale.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-secondary">
                      {sale.nextDue
                        ? new Date(sale.nextDue).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => onViewSale(sale)}
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-primary"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
