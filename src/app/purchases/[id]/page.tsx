"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/form/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { safeFetch } from "@/lib/api-client";
import { CheckCircle, XCircle, Package, Clock, Truck } from "lucide-react";

type PurchaseStatus = "DRAFT" | "PENDING" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";

const statusConfig: Record<PurchaseStatus, { label: string; color: string; icon: any }> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: Clock },
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  PARTIALLY_RECEIVED: { label: "Partial", color: "bg-blue-100 text-blue-700", icon: Package },
  RECEIVED: { label: "Received", color: "bg-green-100 text-green-700", icon: CheckCircle },
  CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-700", icon: XCircle },
};

export default function PurchaseDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const [purchase, setPurchase] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchPurchase();
  }, [params.id]);

  async function fetchPurchase() {
    try {
      const json = await safeFetch<any>(`/api/purchases/${params.id}`);
      setPurchase(json);
      const qtyMap: Record<string, number> = {};
      json.items?.forEach((item: any) => {
        const pending = item.quantity - (item.receivedQuantity || 0);
        qtyMap[item.id] = pending > 0 ? pending : 0;
      });
      setReceiveQuantities(qtyMap);
    } catch (err) {
      console.error("Failed to fetch purchase", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: "submit" | "cancel") {
    setActionLoading(true);
    setMessage(null);
    try {
      await safeFetch(`/api/purchases/${params.id}/${action}`, { method: "POST" });
      setMessage({ type: "success", text: `Purchase ${action === "submit" ? "submitted" : "cancelled"} successfully` });
      fetchPurchase();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || `Failed to ${action} purchase` });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReceive() {
    setActionLoading(true);
    setMessage(null);
    try {
      const items = Object.entries(receiveQuantities)
        .filter(([_, qty]) => qty > 0)
        .map(([itemId, quantity]) => ({
          itemId,
          quantity,
        }));

      if (items.length === 0) {
        setMessage({ type: "error", text: "No items to receive" });
        return;
      }

      await safeFetch(`/api/purchases/${params.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      setMessage({ type: "success", text: "Items received successfully" });
      fetchPurchase();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to receive items" });
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  if (!purchase) return <div className="text-center py-12 text-muted-foreground">Purchase not found</div>;

  const config = statusConfig[purchase.status as PurchaseStatus] || statusConfig.DRAFT;
  const Icon = config.icon;
  const canReceive = ["PENDING", "PARTIALLY_RECEIVED"].includes(purchase.status);
  const canSubmit = purchase.status === "DRAFT";
  const canCancel = ["DRAFT", "PENDING"].includes(purchase.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Purchase ${purchase.purchaseId || ""}`}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Purchases", href: "/purchases" },
          { label: purchase.purchaseId || "Detail" },
        ]}
      />

      {message && (
        <div className={`px-4 py-3 rounded-lg text-sm ${
          message.type === "success"
            ? "bg-green-50 border border-green-200 text-green-700"
            : "bg-destructive/10 border border-destructive/20 text-destructive"
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-bold mb-4">Purchase Details</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Status</div>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                  <Icon className="w-3 h-3" />
                  {config.label}
                </span>
              </div>
              <div>
                <div className="text-muted-foreground">Supplier</div>
                <div className="font-medium">{purchase.supplier?.name || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Created</div>
                <div>{formatDate(purchase.createdAt)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Expected Delivery</div>
                <div>{purchase.expectedDeliveryDate ? formatDate(purchase.expectedDeliveryDate) : "—"}</div>
              </div>
            </div>
            {purchase.notes && (
              <div className="mt-4 text-sm text-muted-foreground">
                <span className="font-medium">Notes:</span> {purchase.notes}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-bold mb-4">Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Product</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Qty</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Cost</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Subtotal</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Received</th>
                    {canReceive && (
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Receive Qty</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {purchase.items?.map((item: any) => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-medium">{item.productName}</td>
                      <td className="px-3 py-2 text-right">{item.quantity}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(item.buyCost)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(item.quantity * item.buyCost)}</td>
                      <td className="px-3 py-2 text-right">{item.receivedQuantity || 0}</td>
                      {canReceive && (
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            max={item.quantity - (item.receivedQuantity || 0)}
                            value={receiveQuantities[item.id] || 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              const max = item.quantity - (item.receivedQuantity || 0);
                              setReceiveQuantities({
                                ...receiveQuantities,
                                [item.id]: Math.min(val, max),
                              });
                            }}
                            className="w-20 px-2 py-1 text-right bg-background border border-input rounded text-sm"
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-bold mb-4">Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Amount</span>
                <span className="font-bold">{formatCurrency(purchase.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid Amount</span>
                <span>{formatCurrency(purchase.paidAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-3">
                <span className="text-muted-foreground font-medium">Due Amount</span>
                <span className="font-bold text-destructive">{formatCurrency(purchase.dueAmount)}</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 space-y-3">
            <h2 className="text-lg font-bold mb-2">Actions</h2>
            {canSubmit && (
              <button
                onClick={() => handleAction("submit")}
                disabled={actionLoading}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Submit for Receiving
              </button>
            )}
            {canReceive && (
              <button
                onClick={handleReceive}
                disabled={actionLoading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Receive Items
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => handleAction("cancel")}
                disabled={actionLoading}
                className="w-full px-4 py-2 border border-destructive text-destructive rounded-lg text-sm font-medium hover:bg-destructive/10 transition-colors disabled:opacity-50"
              >
                Cancel Purchase
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
