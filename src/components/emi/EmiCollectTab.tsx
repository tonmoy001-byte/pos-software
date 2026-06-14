"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui";
import { Search, CreditCard, AlertCircle } from "lucide-react";
import { InstallmentPaymentModal } from "./InstallmentPaymentModal";
import { EmiReceiptModal } from "./EmiReceiptModal";

export function EmiCollectTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sales, setSales] = useState<any[]>([]);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/emi-sales?search=${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();
      setSales(data.sales || []);
      if (data.sales?.length === 0) {
        setError("No EMI sales found for this search");
      }
    } catch (err) {
      setError("Failed to search EMI sales");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSale = (sale: any) => {
    setSelectedSale(sale);
    setShowPaymentModal(true);
  };

  const handlePaymentComplete = (result: any) => {
    setShowPaymentModal(false);
    setShowReceiptModal(true);
    // Refresh the sale data
    if (selectedSale) {
      fetch(`/api/emi-sales/${selectedSale.id}`)
        .then((res) => res.json())
        .then((data) => setSelectedSale(data.sale));
    }
  };

  const getNextInstallment = (sale: any) => {
    if (!sale.emiSchedules) return null;
    return sale.emiSchedules
      .filter((s: any) => s.status === "PENDING")
      .sort((a: any, b: any) => a.installmentNo - b.installmentNo)[0];
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
          <input
            type="text"
            placeholder="Search by customer name, phone, or invoice number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            "Search"
          )}
        </Button>
      </div>

      {error && (
        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-xl flex items-center gap-2 text-yellow-700 text-xs font-bold">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Results */}
      <div className="space-y-3">
        {sales.map((sale) => {
          const nextInst = getNextInstallment(sale);
          const isOverdue =
            nextInst && new Date(nextInst.dueDate) < new Date();

          return (
            <div
              key={sale.id}
              className="bg-surface rounded-xl border border-border p-4 hover:border-primary/50 transition-all cursor-pointer"
              onClick={() => handleSelectSale(sale)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-bold">{sale.invoiceNumber}</div>
                  <div className="text-sm text-secondary">
                    {sale.customer?.name} • {sale.customer?.phone}
                  </div>
                </div>
                <Badge
                  className={
                    sale.status === "OVERDUE"
                      ? "bg-red-100 text-red-700"
                      : "bg-blue-100 text-blue-700"
                  }
                >
                  {sale.status}
                </Badge>
              </div>

              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-[10px] text-secondary uppercase">
                    Total
                  </div>
                  <div className="font-bold">
                    {Number(sale.totalAmount).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-secondary uppercase">
                    Paid
                  </div>
                  <div className="font-bold text-green-600">
                    {Number(sale.paidAmount).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-secondary uppercase">
                    Remaining
                  </div>
                  <div className="font-bold text-red-600">
                    {Number(sale.dueAmount).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-secondary uppercase">
                    Next Due
                  </div>
                  <div
                    className={`font-bold ${isOverdue ? "text-red-600" : ""}`}
                  >
                    {nextInst
                      ? `#${nextInst.installmentNo} — ${new Date(
                          nextInst.dueDate
                        ).toLocaleDateString()}`
                      : "All paid"}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                <span className="text-xs text-primary font-bold">
                  Click to collect installment
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment Modal */}
      {selectedSale && (
        <InstallmentPaymentModal
          open={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          sale={selectedSale}
          nextInstallment={getNextInstallment(selectedSale)}
          onPaymentComplete={handlePaymentComplete}
        />
      )}

      {/* Receipt Modal */}
      {selectedSale && (
        <EmiReceiptModal
          open={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          sale={selectedSale}
        />
      )}
    </div>
  );
}
