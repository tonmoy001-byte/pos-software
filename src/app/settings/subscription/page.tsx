"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Loader2,
  Shield,
  Cloud,
  Headphones,
  RefreshCw,
  Lock,
  Sparkles,
  Crown,
  Rocket,
} from "lucide-react";
import { safeFetch } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";

interface PlanOption {
  id: string;
  name: string;
  displayName: string;
  description: string;
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
  } | null;
  plan: {
    id: string;
    name: string;
    displayName: string;
  } | null;
  plans: PlanOption[];
  daysRemaining: number | null;
  isExpired: boolean;
}

const featureLabels: Record<string, string> = {
  pos: "POS Sales",
  inventory: "Inventory Management",
  customers: "Customer Management",
  emi_tracking: "EMI Tracking",
  basic_reports: "Basic Reports",
  advanced_reports: "Advanced Reports",
  single_branch: "1 Branch",
  multi_branch: "Multiple Branches",
  backup_restore: "Backup & Restore",
  email_support: "Email Support",
  priority_support: "Priority Support",
  purchase_management: "Purchase Management",
  expense_management: "Expense Management",
};

const planIcons: Record<string, typeof Crown> = {
  basic: Crown,
  pro: Rocket,
};

const trustBadges = [
  { icon: Shield, label: "Secure & Reliable", desc: "Your data is safe with us", color: "bg-green-100 text-green-600" },
  { icon: Cloud, label: "Cloud Backup", desc: "Automatic backup everyday", color: "bg-blue-100 text-blue-600" },
  { icon: Headphones, label: "24/7 Support", desc: "We're here to help you", color: "bg-purple-100 text-purple-600" },
  { icon: RefreshCw, label: "Always Updated", desc: "Get new features regularly", color: "bg-amber-100 text-amber-600" },
  { icon: Lock, label: "Cancel Anytime", desc: "No long term commitment", color: "bg-red-100 text-red-600" },
];

export default function SubscriptionPage() {
  const router = useRouter();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await safeFetch<SubscriptionData>("/api/subscription");
      if (res) setData(res);
    } catch (err) {
      console.error("Failed to fetch subscription", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleChoosePlan = async (plan: PlanOption) => {
    setPurchasing(plan.id);
    try {
      const res = await safeFetch<{
        success: boolean;
        paymentId: string;
        bkashURL: string | null;
        message: string;
      }>("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          billingCycle: "MONTHLY",
          paymentMethod: "bKash",
        }),
      });

      if (res?.bkashURL) {
        // Phase 3: redirect to bKash
        window.location.href = res.bkashURL;
      } else if (res?.paymentId) {
        // Placeholder: redirect to success page
        router.push(`/payment/success?paymentId=${res.paymentId}`);
      }
    } catch (err: any) {
      console.error("Payment failed", err);
    }
    setPurchasing(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const trialDaysLeft = data?.daysRemaining;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-6 pt-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Subscription Plans</h1>
              <p className="text-sm text-gray-500">Choose the best plan for your business</p>
            </div>
          </div>
          {trialDaysLeft != null && trialDaysLeft > 0 && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <Crown className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800">{trialDaysLeft} Days Free Trial</p>
                <p className="text-xs text-amber-600">Enjoy all features for {trialDaysLeft} days</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 pb-16">
        {/* Heading */}
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
            <Sparkles className="w-7 h-7 text-primary" />
            Simple Plans, Powerful Business
          </h2>
          <p className="text-gray-500 mt-2">
            Select a plan that fits your shop and grow without limits.
          </p>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {data?.plans.map((plan) => {
            const Icon = planIcons[plan.name] || Crown;
            const isPopular = plan.name === "pro";
            return (
              <div
                key={plan.id}
                className={`bg-white rounded-3xl border-2 p-8 flex flex-col relative transition-all hover:shadow-lg ${
                  isPopular
                    ? "border-primary shadow-md"
                    : "border-gray-200"
                }`}
              >
                {isPopular && (
                  <span className="absolute -top-3 right-6 px-3 py-1 bg-primary text-white text-xs font-semibold rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Most Popular
                  </span>
                )}

                {/* Plan Header */}
                <div className="flex items-start gap-4 mb-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                    isPopular ? "bg-primary/10" : "bg-gray-100"
                  }`}>
                    <Icon className={`w-7 h-7 ${isPopular ? "text-primary" : "text-gray-600"}`} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{plan.displayName} Plan</h3>
                    <p className="text-sm text-gray-500">{plan.description}</p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-medium text-gray-500">BDT</span>
                    <span className="text-4xl font-bold text-gray-900">{plan.priceMonthly.toLocaleString()}</span>
                    <span className="text-gray-500">/month</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">Billed monthly. Cancel anytime.</p>
                </div>

                {/* Features */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                        isPopular ? "bg-primary/10" : "bg-gray-100"
                      }`}>
                        <Check className={`w-3 h-3 ${isPopular ? "text-primary" : "text-gray-600"}`} />
                      </div>
                      <span className="text-sm text-gray-700">{featureLabels[f] || f}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handleChoosePlan(plan)}
                  disabled={purchasing === plan.id}
                  className={`w-full py-4 rounded-2xl font-semibold text-base transition-all flex items-center justify-center gap-2 ${
                    isPopular
                      ? "bg-primary text-white hover:bg-primary/90 shadow-md"
                      : "bg-gray-900 text-white hover:bg-gray-800"
                  } disabled:opacity-50`}
                >
                  {purchasing === plan.id ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    `Choose ${plan.displayName} Plan`
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Trust Badges */}
        <div className="bg-white rounded-3xl border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
            {trustBadges.map((badge) => (
              <div key={badge.label} className="flex flex-col items-center text-center">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2 ${badge.color}`}>
                  <badge.icon className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-gray-900">{badge.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{badge.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          Need help?{" "}
          <a href="mailto:support@antigravity.com.bd" className="text-primary hover:underline">
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
      </div>
    </div>
  );
}
