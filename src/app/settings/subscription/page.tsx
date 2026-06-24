"use client";

import { useState, useEffect } from "react";
import {
  CreditCard,
  Check,
  Loader2,
  Send,
  History,
  Crown,
  Star,
  Building2,
  ArrowUpRight,
} from "lucide-react";
import { safeFetch } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";

interface PlanOption {
  id: string;
  name: string;
  displayName: string;
  maxProducts: number;
  maxUsers: number;
  maxBranches: number;
  features: string[];
  priceMonthly: number;
  priceYearly: number;
  isCustomPricing: boolean;
}

interface SubscriptionData {
  subscription: {
    id: string;
    status: string;
    trialEndsAt: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    billingCycle: string | null;
    subscriptionPrice: number | null;
    gracePeriodEnds: string | null;
  } | null;
  plan: {
    id: string;
    name: string;
    displayName: string;
    maxProducts: number;
    maxUsers: number;
    maxBranches: number;
    features: string[];
    priceMonthly: number;
    priceYearly: number;
    isCustomPricing: boolean;
  } | null;
  plans: PlanOption[];
  daysRemaining: number | null;
  isExpired: boolean;
}

interface RequestItem {
  id: string;
  status: string;
  billingCycle: string;
  paymentMethod: string;
  transactionId: string | null;
  amountPaid: number | null;
  notes: string | null;
  createdAt: string;
  currentPlan: { displayName: string };
  requestedPlan: {
    displayName: string;
    priceMonthly: number;
    priceYearly: number;
  };
}

const statusColor = (status: string) => {
  const colors: Record<string, string> = {
    TRIAL: "bg-blue-50 text-blue-700 border border-blue-200",
    ACTIVE: "bg-green-50 text-green-700 border border-green-200",
    EXPIRED: "bg-red-50 text-red-700 border border-red-200",
    GRACE_PERIOD: "bg-amber-50 text-amber-700 border border-amber-200",
    SUSPENDED: "bg-red-50 text-red-700 border border-red-200",
    CANCELLED: "bg-gray-50 text-gray-600 border border-gray-200",
    PENDING: "bg-blue-50 text-blue-700 border border-blue-200",
    APPROVED: "bg-green-50 text-green-700 border border-green-200",
    REJECTED: "bg-red-50 text-red-700 border border-red-200",
  };
  return colors[status] || "bg-gray-50 text-gray-600 border border-gray-200";
};

const planIcon = (name: string) => {
  if (name === "growth" || name === "pro") return Star;
  if (name === "enterprise" || name === "business") return Building2;
  return Crown;
};

export default function SubscriptionPage() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanOption | null>(null);
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "YEARLY">(
    "MONTHLY"
  );
  const [paymentMethod, setPaymentMethod] = useState("bKash");
  const [transactionId, setTransactionId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [subRes, reqRes] = await Promise.allSettled([
      safeFetch<SubscriptionData>("/api/subscription").catch((err) => {
        console.error("Failed to fetch subscription", err);
        return null;
      }),
      safeFetch<{ requests: RequestItem[] }>(
        "/api/subscription/request"
      ).catch((err) => {
        console.error("Failed to fetch requests", err);
        return null;
      }),
    ]);

    if (subRes.status === "fulfilled" && subRes.value) {
      setData(subRes.value);
    }
    if (reqRes.status === "fulfilled" && reqRes.value) {
      setRequests(reqRes.value.requests);
    }
    setLoading(false);
  };

  const openModal = (plan: PlanOption) => {
    setSelectedPlan(plan);
    setBillingCycle("MONTHLY");
    setPaymentMethod("bKash");
    setTransactionId("");
    setNotes("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedPlan(null);
  };

  const handleSubmit = async () => {
    if (!selectedPlan) return;
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/subscription/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlan.id,
          billingCycle,
          paymentMethod,
          transactionId: transactionId || undefined,
          notes: notes || undefined,
        }),
      });

      if (res.ok) {
        setMessage({
          type: "success",
          text: "Request submitted successfully! We'll review it shortly.",
        });
        closeModal();
        fetchData();
      } else {
        const err = await res.json().catch(() => null);
        setMessage({
          type: "error",
          text:
            typeof err?.error === "string"
              ? err.error
              : "Failed to submit request",
        });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to submit request" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const estimatedAmount =
    selectedPlan && billingCycle === "YEARLY"
      ? selectedPlan.priceYearly
      : selectedPlan?.priceMonthly ?? 0;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Subscription</h1>
        <p className="text-secondary mt-1">Manage your plan and billing</p>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-xl ${
            message.type === "success"
              ? "bg-green-50 text-green-600 border border-green-200"
              : "bg-red-50 text-red-600 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Current Plan Card */}
      {data?.subscription && data?.plan && (
        <div className="bg-surface rounded-2xl border border-border p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Current Plan
                </h2>
                <p className="text-sm text-secondary">
                  {data.plan.displayName}
                </p>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(data.subscription.status)}`}
            >
              {data.subscription.status}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {data.subscription.billingCycle && (
              <div>
                <p className="text-xs text-secondary">Billing Cycle</p>
                <p className="text-sm font-medium text-foreground">
                  {data.subscription.billingCycle}
                </p>
              </div>
            )}
            {data.subscription.subscriptionPrice != null && (
              <div>
                <p className="text-xs text-secondary">Price</p>
                <p className="text-sm font-medium text-foreground">
                  {formatCurrency(data.subscription.subscriptionPrice)}
                </p>
              </div>
            )}
            {data.daysRemaining != null && data.daysRemaining > 0 && (
              <div>
                <p className="text-xs text-secondary">Days Remaining</p>
                <p className="text-sm font-medium text-foreground">
                  {data.daysRemaining}
                </p>
              </div>
            )}
            {data.subscription.currentPeriodEnd && (
              <div>
                <p className="text-xs text-secondary">Current Period End</p>
                <p className="text-sm font-medium text-foreground">
                  {new Date(
                    data.subscription.currentPeriodEnd
                  ).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-background rounded-xl">
              <p className="text-xs text-secondary">Products</p>
              <p className="text-lg font-bold text-foreground">
                {data.plan.maxProducts}
              </p>
            </div>
            <div className="text-center p-3 bg-background rounded-xl">
              <p className="text-xs text-secondary">Users</p>
              <p className="text-lg font-bold text-foreground">
                {data.plan.maxUsers}
              </p>
            </div>
            <div className="text-center p-3 bg-background rounded-xl">
              <p className="text-xs text-secondary">Branches</p>
              <p className="text-lg font-bold text-foreground">
                {data.plan.maxBranches}
              </p>
            </div>
          </div>

          {data.plan.features.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.plan.features.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-primary/5 text-primary text-xs font-medium rounded-full"
                >
                  <Check className="w-3 h-3" />
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No Subscription */}
      {!data?.subscription && (
        <div className="bg-surface rounded-2xl border border-border p-8 mb-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">
            No Active Subscription
          </h2>
          <p className="text-secondary mb-6 max-w-md mx-auto">
            Choose a plan below to get started with premium features for your
            store.
          </p>
          {data?.plans && data.plans.length > 0 && (
            <a
              href="#plans"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
            >
              Browse Plans
              <ArrowUpRight className="w-4 h-4" />
            </a>
          )}
        </div>
      )}

      {/* Available Plans */}
      <div id="plans" className="mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Available Plans
        </h2>
        {(!data?.plans || data.plans.length === 0) ? (
          <div className="bg-surface rounded-2xl border border-border p-8 text-center">
            <p className="text-secondary">No plans available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.plans.map((plan) => {
              const Icon = planIcon(plan.name);
              const isCurrent = data.plan?.id === plan.id;
              return (
                <div
                  key={plan.id}
                  className={`bg-surface rounded-2xl border p-6 flex flex-col ${
                    isCurrent
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border"
                  }`}
                >
                  {isCurrent && (
                    <span className="self-start mb-2 px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full">
                      Current Plan
                    </span>
                  )}
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    {plan.displayName}
                  </h3>
                  <div className="mb-4">
                    {plan.isCustomPricing ? (
                      <p className="text-secondary text-sm">Custom pricing</p>
                    ) : (
                      <div>
                        <p className="text-2xl font-bold text-foreground">
                          {formatCurrency(plan.priceMonthly)}
                          <span className="text-sm font-normal text-secondary">
                            /mo
                          </span>
                        </p>
                        <p className="text-xs text-secondary">
                          {formatCurrency(plan.priceYearly)}/year
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                    <div className="p-2 bg-background rounded-lg">
                      <p className="text-xs text-secondary">Products</p>
                      <p className="text-sm font-semibold text-foreground">
                        {plan.maxProducts}
                      </p>
                    </div>
                    <div className="p-2 bg-background rounded-lg">
                      <p className="text-xs text-secondary">Users</p>
                      <p className="text-sm font-semibold text-foreground">
                        {plan.maxUsers}
                      </p>
                    </div>
                    <div className="p-2 bg-background rounded-lg">
                      <p className="text-xs text-secondary">Branches</p>
                      <p className="text-sm font-semibold text-foreground">
                        {plan.maxBranches}
                      </p>
                    </div>
                  </div>
                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-center gap-2 text-sm text-secondary"
                      >
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-3 bg-gray-100 text-gray-400 rounded-xl font-semibold cursor-not-allowed"
                    >
                      Current Plan
                    </button>
                  ) : plan.isCustomPricing ? (
                    <a
                      href="mailto:support@antigravity.com.bd?subject=Enterprise%20Plan%20Inquiry"
                      className="w-full py-3 bg-foreground text-background rounded-xl font-semibold text-center hover:opacity-90 transition-opacity inline-block"
                    >
                      Contact Sales
                    </a>
                  ) : (
                    <button
                      onClick={() => openModal(plan)}
                      className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
                    >
                      Select Plan
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Request History */}
      {requests.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-secondary" />
            <h2 className="text-lg font-semibold text-foreground">
              Request History
            </h2>
          </div>
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-medium text-secondary">
                      Date
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-secondary">
                      Plan
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-secondary">
                      Billing
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-secondary">
                      Amount
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-secondary">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-foreground">
                        {new Date(req.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-foreground font-medium">
                          {req.requestedPlan.displayName}
                        </p>
                        <p className="text-xs text-secondary">
                          from {req.currentPlan.displayName}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-secondary">
                        {req.billingCycle}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {req.amountPaid != null
                          ? formatCurrency(req.amountPaid)
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(req.status)}`}
                        >
                          {req.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Contact */}
      <div className="text-center text-sm text-secondary">
        Need help?{" "}
        <a
          href="mailto:support@antigravity.com.bd"
          className="text-primary hover:underline"
        >
          Email Support
        </a>{" "}
        or{" "}
        <a
          href="https://wa.me/8801700000000"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          WhatsApp
        </a>
      </div>

      {/* Request Form Modal */}
      {modalOpen && selectedPlan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-surface rounded-2xl border border-border shadow-xl w-full max-w-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-foreground mb-1">
              Request Plan Upgrade
            </h3>
            <p className="text-sm text-secondary mb-6">
              {selectedPlan.displayName}
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Billing Cycle
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setBillingCycle("MONTHLY")}
                    className={`flex-1 py-3 rounded-xl font-medium border transition-colors ${
                      billingCycle === "MONTHLY"
                        ? "bg-primary text-white border-primary"
                        : "bg-background text-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    <div>Monthly</div>
                    <div className="text-xs opacity-80">
                      {formatCurrency(selectedPlan.priceMonthly)}/mo
                    </div>
                  </button>
                  <button
                    onClick={() => setBillingCycle("YEARLY")}
                    className={`flex-1 py-3 rounded-xl font-medium border transition-colors ${
                      billingCycle === "YEARLY"
                        ? "bg-primary text-white border-primary"
                        : "bg-background text-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    <div>Yearly</div>
                    <div className="text-xs opacity-80">
                      {formatCurrency(selectedPlan.priceYearly)}/yr
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary/50"
                >
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Transaction ID
                </label>
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary/50"
                  placeholder="Enter transaction ID"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary/50 resize-none"
                  rows={3}
                  placeholder="Any additional notes..."
                />
              </div>

              <div className="bg-background rounded-xl p-4">
                <p className="text-xs text-secondary mb-1">Estimated Amount</p>
                <p className="text-xl font-bold text-foreground">
                  {formatCurrency(estimatedAmount)}
                </p>
                <p className="text-xs text-secondary mt-1">
                  For reference only. Server calculates the final amount.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 py-3 bg-background border border-border rounded-xl font-semibold text-foreground hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
