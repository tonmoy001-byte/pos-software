"use client";

import { AlertTriangle, Clock, X, ArrowUpRight } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useTrialGuard } from "./TrialGuardProvider";

export function TrialBanner() {
  const { status, isExpired, daysRemaining, graceDaysRemaining, trialEndsAt, isLoading } = useTrialGuard();
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
  const isGracePeriod = status === "grace_period";

  // Cancelled or suspended → red, dismissible
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
            href="/settings/subscription"
            className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-red-700 hover:text-red-800"
          >
            View Plans
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <button
          onClick={() => { setDismissed(true); sessionStorage.setItem("trial-banner-dismissed", "true"); }}
          className="text-red-400 hover:text-red-600 flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Grace period → amber, NOT dismissible
  if (isGracePeriod) {
    return (
      <div className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-amber-800">Read-only mode</h3>
          <p className="text-sm text-amber-600 mt-0.5">
            {graceDaysRemaining != null && graceDaysRemaining > 0
              ? `${graceDaysRemaining} day${graceDaysRemaining === 1 ? "" : "s"} remaining in grace period.`
              : "Grace period ended."}
            {" "}Upgrade to continue creating records.
          </p>
          <Link
            href="/settings/subscription"
            className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-amber-700 hover:text-amber-800"
          >
            Upgrade Now
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // Expired (not grace) → red, NOT dismissible
  if (isExpired) {
    return (
      <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-red-800">Subscription expired</h3>
          <p className="text-sm text-red-600 mt-0.5">
            Please upgrade to continue.
          </p>
          <Link
            href="/settings/subscription"
            className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-red-700 hover:text-red-800"
          >
            Upgrade Now
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // Trial active, 1 day left → red urgent, dismissible
  if (isTrial && daysRemaining !== null && daysRemaining <= 1) {
    return (
      <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-red-800">Trial expires tomorrow</h3>
          <p className="text-sm text-red-600 mt-0.5">
            Upgrade now to avoid interruption.
          </p>
          <Link
            href="/settings/subscription"
            className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-red-700 hover:text-red-800"
          >
            Upgrade Now
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <button
          onClick={() => { setDismissed(true); sessionStorage.setItem("trial-banner-dismissed", "true"); }}
          className="text-red-400 hover:text-red-600 flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Trial active, 3 or fewer days left → amber, dismissible
  if (isTrial && daysRemaining !== null && daysRemaining <= 3) {
    return (
      <div className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Clock className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-amber-800">
            Trial expires in {daysRemaining} {daysRemaining === 1 ? "day" : "days"}
          </h3>
          <p className="text-sm text-amber-600 mt-0.5">
            Upgrade now to avoid interruption.
          </p>
          <Link
            href="/settings/subscription"
            className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-amber-700 hover:text-amber-800"
          >
            Upgrade Now
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <button
          onClick={() => { setDismissed(true); sessionStorage.setItem("trial-banner-dismissed", "true"); }}
          className="text-amber-400 hover:text-amber-600 flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Trial active, more than 3 days → blue info, dismissible
  if (isTrial && daysRemaining !== null) {
    return (
      <div className="mx-6 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Clock className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-blue-800">
            Your trial expires in {daysRemaining} {daysRemaining === 1 ? "day" : "days"}
          </h3>
        </div>
        <button
          onClick={() => { setDismissed(true); sessionStorage.setItem("trial-banner-dismissed", "true"); }}
          className="text-blue-400 hover:text-blue-600 flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return null;
}
