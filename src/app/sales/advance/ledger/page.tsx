"use client";

import { useState, useEffect } from "react";
import { 
  Search,
  AlertTriangle
} from "lucide-react";
import { Button, Card, Input, Modal } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";

export default function AdvanceLedgerPage() {
  const [advances, setAdvances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedAdvance, setSelectedAdvance] = useState<any>(null);
  const [payAmount, setPayAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [completing, setCompleting] = useState(false);
  const [message, setMessage] = useState<{type: "success"|"error", text: string} | null>(null);
  const [stockInfo, setStockInfo] = useState<any[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);

  const fetchAdvances = async () => {
    try {
      const res = await fetch("/api/advances");
      const data = await res.json();
      setAdvances(data);
    } catch (err) {
      console.error("Failed to fetch advances", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvances();
  }, []);

  const filteredAdvances = advances.filter(a => 
    (a.customerName?.toLowerCase() || "").includes(search.toLowerCase()) ||
    (a.customerPhone || "").includes(search)
  );

  const totalOrders = advances.length;
  const totalAdvance = advances.reduce((sum, a) => sum + (Number(a.paidAmount) || 0), 0);
  const totalDue = advances.reduce((sum, a) => sum + (Number(a.dueAmount) || 0), 0);

  const fetchStockInfo = async (advance: any) => {
    setLoadingStock(true);
    setStockInfo([]);
    try {
      const productIds = advance.items?.map((item: any) => item.productId) || [];
      if (productIds.length === 0) {
        setLoadingStock(false);
        return;
      }

      const stockData: any[] = [];
      for (const item of advance.items) {
        try {
          const res = await fetch(`/api/products/${item.productId}`);
          if (res.ok) {
            const product = await res.json();
            stockData.push({
              name: item.name || product.name,
              currentStock: product.stock,
              required: item.quantity,
              sufficient: product.stock >= item.quantity,
            });
          }
        } catch {
          stockData.push({
            name: item.name,
            currentStock: null,
            required: item.quantity,
            sufficient: false,
          });
        }
      }
      setStockInfo(stockData);
    } catch (err) {
      console.error("Failed to fetch stock info", err);
    } finally {
      setLoadingStock(false);
    }
  };

  const handleOpenComplete = (advance: any) => {
    setSelectedAdvance(advance);
    setPayAmount(advance.dueAmount.toString());
    setMessage(null);
    fetchStockInfo(advance);
  };

  const handleComplete = async () => {
    if (!selectedAdvance || !payAmount) return;
    setCompleting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/advances/${selectedAdvance.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          paidAmount: parseFloat(payAmount),
          method: paymentMethod
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Order completed successfully!" });
        setSelectedAdvance(null);
        setPayAmount("");
        fetchAdvances();
      } else {
        const errorMsg = data.details 
          ? `${data.error}\n${data.details.join("\n")}`
          : data.error || "Failed to complete";
        setMessage({ type: "error", text: errorMsg });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Connection error" });
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return <div className="p-8 animate-pulse text-secondary font-bold">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background p-6">
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-black text-foreground">Advance Orders Ledger</h1>
        <p className="text-sm text-secondary">Track and complete advance orders</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-shrink-0">
        <Card className="p-6 border-l-4 border-l-blue-500">
          <p className="text-sm font-medium text-secondary">Total Orders</p>
          <p className="text-3xl font-black mt-1">{totalOrders}</p>
          <p className="text-xs text-blue-500 mt-2">Pending completions</p>
        </Card>
        <Card className="p-6 border-l-4 border-l-green-500">
          <p className="text-sm font-medium text-secondary">Total Advance</p>
          <p className="text-3xl font-black mt-1">{formatCurrency(totalAdvance)}</p>
          <p className="text-xs text-green-500 mt-2">Received</p>
        </Card>
        <Card className="p-6 border-l-4 border-l-orange-500">
          <p className="text-sm font-medium text-secondary">Remaining Due</p>
          <p className="text-3xl font-black mt-1">{formatCurrency(totalDue)}</p>
          <p className="text-xs text-orange-500 mt-2">To be collected</p>
        </Card>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search by customer name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-border outline-none focus:border-primary font-medium"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/50">
          {filteredAdvances.length === 0 ? (
            <p className="p-8 text-center text-secondary italic">No advance orders found.</p>
          ) : (
            filteredAdvances.map((advance) => (
              <div key={advance.id} className="p-6 hover:bg-background/50">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-black text-lg">{advance.customerName || "Walking Customer"}</p>
                      <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded font-bold">
                        #{advance.invoiceId}
                      </span>
                    </div>
                    <p className="text-sm text-secondary">{advance.customerPhone || "No phone"}</p>
                    {advance.customerAddress && (
                      <p className="text-xs text-secondary mt-1">{advance.customerAddress}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-secondary">
                      {advance.createdAt ? new Date(advance.createdAt).toLocaleDateString("en-GB") : "-"}
                    </p>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold mt-1 ${
                      advance.status === "COMPLETED" ? "bg-green-100 text-green-700" : 
                      advance.status === "PARTIAL" ? "bg-orange-100 text-orange-700" :
                      advance.status === "PAID" ? "bg-blue-100 text-blue-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>
                      {advance.status === "PAID" && advance.dueAmount === 0 ? "PAID (Pending Delivery)" : advance.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="bg-background p-3 rounded-xl">
                    <p className="text-xs text-secondary font-bold">Total</p>
                    <p className="font-black">{formatCurrency(advance.totalAmount)}</p>
                  </div>
                  <div className="bg-background p-3 rounded-xl">
                    <p className="text-xs text-secondary font-bold">Paid</p>
                    <p className="font-black text-green-600">{formatCurrency(advance.paidAmount)}</p>
                  </div>
                  <div className="bg-background p-3 rounded-xl">
                    <p className="text-xs text-secondary font-bold">Due</p>
                    <p className="font-black text-orange-600">{formatCurrency(advance.dueAmount)}</p>
                  </div>
                  <div className="bg-background p-3 rounded-xl">
                    <p className="text-xs text-secondary font-bold">Discount</p>
                    <p className="font-black">{formatCurrency(advance.discount || 0)}</p>
                  </div>
                </div>

                {advance.deliveryDate && (
                  <div className="mb-3 px-3 py-2 bg-blue-50 rounded-lg inline-block">
                    <p className="text-xs text-blue-600 font-bold">
                      📅 Expected Delivery: {new Date(advance.deliveryDate).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                )}

                <div className="space-y-2 mb-4">
                  {advance.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm bg-background/50 p-2 rounded-lg">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-secondary">
                        {item.brand} {item.model} × {item.quantity} = {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm text-secondary flex items-center gap-2">
                    <span className="px-2 py-1 bg-surface rounded text-xs font-bold">
                      {advance.paymentMethod || "CASH"}
                    </span>
                  </p>
                  {advance.status !== "COMPLETED" && (
                    <Button 
                      onClick={() => handleOpenComplete(advance)}
                      size="sm"
                    >
                      {advance.status === "COMPLETED" ? "Completed" : "Complete Order"}
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Modal 
        isOpen={!!selectedAdvance} 
        onClose={() => { setSelectedAdvance(null); setPayAmount(""); setMessage(null); setStockInfo([]); }} 
        title="Complete Advance Order"
      >
        <div className="space-y-4">
          {selectedAdvance && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-background p-4 rounded-xl">
                  <p className="text-xs font-bold text-secondary">Total</p>
                  <p className="font-black">{formatCurrency(selectedAdvance.totalAmount)}</p>
                </div>
                <div className="bg-background p-4 rounded-xl">
                  <p className="text-xs font-bold text-secondary">Already Paid</p>
                  <p className="font-black text-green-600">{formatCurrency(selectedAdvance.paidAmount)}</p>
                </div>
              </div>

              {loadingStock ? (
                <div className="p-4 text-center text-secondary animate-pulse">Checking stock...</div>
              ) : stockInfo.length > 0 && (
                <div className="bg-background p-4 rounded-xl">
                  <p className="text-xs font-bold text-secondary mb-2">Stock Status</p>
                  <div className="space-y-2">
                    {stockInfo.map((stock, idx) => (
                      <div key={idx} className={`flex justify-between items-center p-2 rounded-lg ${
                        stock.sufficient ? "bg-green-50" : "bg-red-50"
                      }`}>
                        <div>
                          <p className={`text-sm font-bold ${
                            stock.sufficient ? "text-green-700" : "text-red-700"
                          }`}>
                            {stock.name}
                          </p>
                          <p className="text-xs text-secondary">
                            Required: {stock.required} unit{stock.required > 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          {stock.currentStock !== null ? (
                            <>
                              <p className={`text-sm font-black ${
                                stock.sufficient ? "text-green-600" : "text-red-600"
                              }`}>
                                {stock.currentStock} in stock
                              </p>
                              {!stock.sufficient && (
                                <p className="text-xs text-red-500 font-bold">
                                  Short by {stock.required - stock.currentStock}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-xs text-secondary">Unknown</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {stockInfo.some(s => !s.sufficient) && (
                    <div className="mt-3 p-3 bg-red-50 rounded-lg flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700 font-bold">
                        Insufficient stock! Complete this order after restocking.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <Input
                label="Payment Amount"
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Enter amount"
              />

              <div className="flex gap-2 flex-wrap">
                {["CASH", "BKASH", "BANK", "NAGAD", "CARD"].map((m) => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                      paymentMethod === m ? "bg-primary text-white" : "bg-background text-secondary"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {message && (
                <div className={`p-3 rounded-xl text-sm font-bold whitespace-pre-line ${
                  message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                }`}>
                  {message.text}
                </div>
              )}

              <Button 
                onClick={handleComplete}
                disabled={completing || !payAmount}
                className="w-full"
              >
                {completing ? "Processing..." : "Complete Order"}
              </Button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}