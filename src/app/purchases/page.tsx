"use client";

import { useEffect, useState } from "react";
import { Search, Plus, Eye, CheckCircle, XCircle, Clock, Package } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/form/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { safeFetch } from "@/lib/api-client";

type PurchaseStatus = "DRAFT" | "PENDING" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";

const statusConfig: Record<PurchaseStatus, { label: string; color: string; icon: any }> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: Clock },
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  PARTIALLY_RECEIVED: { label: "Partial", color: "bg-blue-100 text-blue-700", icon: Package },
  RECEIVED: { label: "Received", color: "bg-green-100 text-green-700", icon: CheckCircle },
  CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-700", icon: XCircle },
};

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchPurchases();
  }, [statusFilter]);

  async function fetchPurchases() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const json = await safeFetch<any>(`/api/purchases?${params.toString()}`);
      setPurchases(Array.isArray(json) ? json : []);
    } catch (err) {
      console.error("Failed to fetch purchases", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredPurchases = purchases.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.purchaseId?.toLowerCase().includes(q) ||
      p.supplier?.name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchases"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Purchases" },
        ]}
        actions={
          <Link
            href="/purchases/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Purchase
          </Link>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by ID or supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Status</option>
          {Object.entries(statusConfig).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading purchases...</div>
      ) : filteredPurchases.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No purchases found</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Purchase ID</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Supplier</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Items</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Paid</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Due</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((purchase) => {
                  const config = statusConfig[purchase.status as PurchaseStatus] || statusConfig.DRAFT;
                  const Icon = config.icon;
                  return (
                    <tr key={purchase.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{purchase.purchaseId || "—"}</td>
                      <td className="px-4 py-3">{purchase.supplier?.name || "—"}</td>
                      <td className="px-4 py-3">{purchase.items?.length || 0}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(purchase.totalAmount)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(purchase.paidAmount)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(purchase.dueAmount)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                          <Icon className="w-3 h-3" />
                          {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(purchase.createdAt)}</td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/purchases/${purchase.id}`}
                          className="inline-flex items-center gap-1 text-primary hover:text-primary/80 text-xs font-medium"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
