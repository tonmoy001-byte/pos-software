"use client";

import { useEffect, useState, use } from "react";
import { PageHeader } from "@/components/form/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { safeFetch } from "@/lib/api-client";
import { DollarSign, Package, RotateCcw, ShoppingCart, CreditCard } from "lucide-react";
import Link from "next/link";

export default function SupplierOverviewPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const [summary, setSummary] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [sumRes, ledRes] = await Promise.all([
          safeFetch<any>(`/api/suppliers/${params.id}/summary`),
          safeFetch<any>(`/api/suppliers/${params.id}/ledger?limit=50`),
        ]);
        setSummary(sumRes);
        setLedger(ledRes.entries || []);
      } catch (err) {
        console.error("Failed to fetch supplier data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [params.id]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  if (!summary) return <div className="text-center py-12 text-muted-foreground">Supplier not found</div>;

  const stats = summary.stats || {};

  return (
    <div className="space-y-6">
      <PageHeader
        title={summary.name}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Suppliers", href: "/suppliers" },
          { label: summary.name },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Outstanding Due</div>
              <div className="text-lg font-bold">{formatCurrency(summary.dueAmount)}</div>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Purchases</div>
              <div className="text-lg font-bold">{formatCurrency(stats.totalPurchases)}</div>
              <div className="text-xs text-muted-foreground">{stats.purchaseCount || 0} orders</div>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Paid</div>
              <div className="text-lg font-bold">{formatCurrency(stats.totalPayments)}</div>
              <div className="text-xs text-muted-foreground">{stats.paymentCount || 0} payments</div>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <RotateCcw className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Returns</div>
              <div className="text-lg font-bold">{formatCurrency(stats.totalReturns)}</div>
              <div className="text-xs text-muted-foreground">{stats.returnCount || 0} returns</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-bold mb-4">Transaction Ledger</h2>
        {ledger.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No transactions yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Description</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Debit</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Credit</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((entry, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-muted-foreground">{formatDate(entry.date)}</td>
                    <td className="px-3 py-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted">{entry.type}</span>
                    </td>
                    <td className="px-3 py-2">{entry.description}</td>
                    <td className="px-3 py-2 text-right font-medium text-green-600">
                      {entry.debit > 0 ? formatCurrency(entry.debit) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-red-600">
                      {entry.credit > 0 ? formatCurrency(entry.credit) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
