"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Trash2, RotateCcw, X, Check, Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ReceiptModal } from "@/components/invoice";
import { safeFetch } from "@/lib/api-client";
import { useTrialRestricted } from "@/components/trial/useTrialRestricted";

export default function ReturnRefundPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refundMethod, setRefundMethod] = useState("CASH");
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [invoiceSettings, setInvoiceSettings] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [returnReason, setReturnReason] = useState("");
  const { checkAction, RestrictedModal } = useTrialRestricted();

  useEffect(() => {
    async function fetchData() {
      try {
        const [salesData, invoiceData] = await Promise.all([
          safeFetch<any[]>("/api/sales"),
          safeFetch("/api/invoice-settings")
        ]);
        setInvoices(Array.isArray(salesData) ? salesData : []);
        setInvoiceSettings(invoiceData);
      } catch (err) {
        console.error("Failed to fetch data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (customerSearch.length > 1) {
      safeFetch<any>(`/api/customers?query=${customerSearch}`)
        .then(data => setCustomerResults(data))
        .catch(() => setCustomerResults([]));
    }
  }, [customerSearch]);

  const selectSale = (sale: any) => {
    setSelectedSale(sale);
    setReturnItems((sale.items || []).map((item: any) => ({ ...item, returnQty: item.quantity, return: true })));
  };

  const updateReturnItem = (idx: number, field: string, value: any) => {
    const updated = [...returnItems];
    updated[idx] = { ...updated[idx], [field]: value };
    setReturnItems(updated);
  };

  const handleSubmit = async () => {
    if (!checkAction("process return")) return;
    if (!selectedSale) return setError("Select a sale to return");
    const returnTotal = returnItems.filter(i => i.return).reduce((sum, i) => sum + (i.price * i.returnQty), 0);
    if (returnTotal === 0) return setError("No items selected for return");
    setSubmitting(true);
    try {
      const payload = { 
        saleId: selectedSale.id, 
        items: returnItems.filter(i => i.return), 
        refundAmount: returnTotal, 
        refundMethod,
        returnReason: returnReason || undefined
      };
      const data = await safeFetch("/api/sales/return", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setLastSale(data);
      setShowReceipt(true);
    } catch {
      setError("Failed to process return");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseReceipt = () => {
    setShowReceipt(false);
    setLastSale(null);
    setSuccess("Return processed!");
    setReturnItems([]);
    setSelectedSale(null);
    setReturnReason("");
    safeFetch<any[]>("/api/sales").then(d => setInvoices(Array.isArray(d) ? d : [])).catch(() => {});
  };

  const returnTotal = returnItems.filter(i => i.return).reduce((sum, i) => sum + (i.price * i.returnQty), 0);
  const filtered = invoices.filter(i => i.invoiceId?.toLowerCase().includes(searchQuery.toLowerCase()) || i.customerName?.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading) return <div className="p-8 animate-pulse">Loading...</div>;

  return (
    <div className="flex h-screen">
      <div className="flex-1 p-6 overflow-y-auto">
        <h2 className="text-2xl font-black mb-6 flex items-center gap-3"><RotateCcw className="w-8 h-8" /> Return & Refund</h2>
        
        <div className="relative mb-4"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary w-5" /><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by invoice or customer..." className="w-full pl-12 pr-4 py-4 rounded-2xl bg-surface border border-border" /></div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.slice(0, 20).map(sale => (
            <div key={sale.id} onClick={() => selectSale(sale)} className={`p-4 rounded-2xl border cursor-pointer transition-all ${selectedSale?.id === sale.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
              <div className="flex justify-between mb-2">
                <span className="font-bold">{sale.invoiceId}</span>
                <span className="text-xs text-secondary">{sale.date ? new Date(sale.date).toLocaleDateString() : ""}</span>
              </div>
              <p className="text-sm text-secondary">{sale.customerName || "Walking Customer"}</p>
              <p className="font-bold text-primary mt-2">{formatCurrency(sale.totalAmount)}</p>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-secondary col-span-2 text-center py-8">No sales found</p>}
        </div>
      </div>

      <div className="w-[400px] bg-surface border-l border-border p-6 overflow-y-auto">
        <h3 className="font-black text-lg mb-4">Return Items</h3>
        
        {selectedSale && (
          <div className="mb-4 p-3 bg-background rounded-xl">
            <p className="text-xs text-secondary">Invoice</p>
            <p className="font-bold">{selectedSale.invoiceId}</p>
            <p className="text-sm">{selectedSale.customerName || "Walking"} - {formatCurrency(selectedSale.totalAmount)}</p>
          </div>
        )}

        {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm mb-4">{error}</div>}
        {success && <div className="p-3 bg-green-50 text-green-600 rounded-lg text-sm mb-4">{success}</div>}

        <div className="space-y-3 mb-6">
          {returnItems.map((item: any, idx: number) => (
            <div key={item.id || idx} className="p-3 bg-background rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={item.return || false} onChange={e => updateReturnItem(idx, "return", e.target.checked)} className="w-4 h-4" />
                  <span className="font-bold text-sm">{item.name}</span>
                </label>
                <span className="text-sm">{formatCurrency(item.price * item.quantity)}</span>
              </div>
              {item.return && (
                <div className="flex items-center gap-2">
                  <span className="text-xs">Qty:</span>
                  <input 
                    type="number" 
                    min={1} 
                    max={item.quantity} 
                    value={item.returnQty || 0} 
                    onChange={(e) => {
                      const val = Math.min(item.quantity, Math.max(1, Number(e.target.value)));
                      updateReturnItem(idx, "returnQty", val);
                    }} 
                    className="w-16 p-1 border rounded text-sm" 
                  />
                  <span className="text-xs text-secondary">/ {item.quantity}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {selectedSale && (
          <>
            <div className="space-y-3 mb-4">
              <label className="text-sm font-bold">Refund Method</label>
              <div className="grid grid-cols-2 gap-2">
                {["CASH", "BKASH", "NAGAD", "WALLET"].map(m => (
                  <button key={m} onClick={() => setRefundMethod(m)} className={`py-2 rounded-lg text-sm ${refundMethod === m ? 'bg-primary text-white' : 'bg-background border border-border'}`}>{m}</button>
                ))}
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <label className="text-sm font-bold">Return Reason</label>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Enter reason for return (optional)"
                className="w-full p-3 border rounded-lg text-sm resize-none"
                rows={3}
              />
            </div>

            <div className="border-t border-border pt-4 mb-4">
              <div className="flex justify-between text-xl font-black"><span>Refund Total</span><span className="text-red-500">{formatCurrency(returnTotal)}</span></div>
            </div>

            <button onClick={handleSubmit} disabled={submitting || returnTotal === 0} className="w-full py-4 bg-primary text-white rounded-xl font-bold disabled:opacity-50">
              {submitting ? "Processing..." : "Process Refund"}
            </button>
          </>
        )}
      </div>
      <ReceiptModal 
        isOpen={showReceipt}
        onClose={handleCloseReceipt}
        data={lastSale}
        settings={invoiceSettings}
      />

      <RestrictedModal />
    </div>
  );
}