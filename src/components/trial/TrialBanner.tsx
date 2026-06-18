"use client";

import { AlertTriangle, Clock, X, ArrowUpRight } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useTrialGuard } from "./TrialGuardProvider";

export function TrialBanner() {
  const { status, isExpired, daysRemaining, trialEndsAt, isLoading } = useTrialGuard();
  const [dismissed, setDismissed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const seen = sessionStorage.getItem("trial-banner-dismissed");
    if (seen) setDismissed(true);
  }, []);

  if (!hydrated || isLoading || dismissed) return null;

  const isCancelled = status === "cancelled";
  const isSuspended = status === "suspended";
  const isTrial = status === "trial";

  if (!isTrial && !isCancelled && !isSuspended) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("trial-banner-dismissed", "true");
  };

  // Cancelled or suspended → red warning banner
  if (isCancelled || isSuspended) {
    return (
      <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-red-800">
            Subscription {status === "cancelled" ? "Cancelled" : "Suspended"}
          </h3>
          <p className="text-sm text-red-600 mt-0.5">
            {status === "cancelled"
              ? "Your subscription has been cancelled. Contact support to reactivate."
              : "Your subscription has been suspended. Contact support for assistance."}
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-red-700 hover:text-red-800"
          >
            View Plans
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <button
          onClick={handleDismiss}
          className="text-red-400 hover:text-red-600 flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Trial expired → red banner, NOT dismissible
  if (isExpired) {
    return (
      <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-red-800">Trial Expired</h3>
          <p className="text-sm text-red-600 mt-0.5">
            Your 14-day trial has ended. Upgrade your plan to continue creating sales, products, and customers.
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-red-700 hover:text-red-800"
          >
            Upgrade Now
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // Trial, 3 or fewer days left → amber urgent banner
  if (daysRemaining !== null && daysRemaining <= 3) {
    return (
      <div className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Clock className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-amber-800">
            Trial Ending Soon — {daysRemaining} {daysRemaining === 1 ? "day" : "days"} left
          </h3>
          <p className="text-sm text-amber-600 mt-0.5">
            Your trial expires on {new Date(trialEndsAt!).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. Upgrade to keep full access.
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-amber-700 hover:text-amber-800"
          >
            Upgrade Now
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <button
          onClick={handleDismiss}
          className="text-amber-400 hover:text-amber-600 flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Trial, more than 3 days → blue info banner
  return (
    <div className="mx-6 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
        <Clock className="w-5 h-5 text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-blue-800">
          Free Trial — {daysRemaining} {daysRemaining === 1 ? "day" : "days"} remaining
        </h3>
        <p className="text-sm text-blue-600 mt-0.5">
          You have full access until {new Date(trialEndsAt!).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
        </p>
      </div>
      <button
        onClick={handleDismiss}
        className="text-blue-400 hover:text-blue-600 flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
