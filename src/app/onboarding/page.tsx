"use client";

import { Suspense, useState, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Smartphone,
  Check,
  ChevronRight,
  ChevronLeft,
  Building2,
  Store,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui";

export const dynamic = "force-dynamic";

type Step = "business" | "store" | "complete";

interface BusinessForm {
  logo: string;
  address: string;
  currency: string;
  language: string;
}

const initialBusiness: BusinessForm = {
  logo: "",
  address: "",
  currency: "BDT",
  language: "English",
};

interface StoreForm {
  branchName: string;
  storeAddress: string;
}

const initialStore: StoreForm = {
  branchName: "Main Branch",
  storeAddress: "",
};

const STEPS: { key: Step; label: string; icon: typeof Store }[] = [
  { key: "business", label: "Business", icon: Building2 },
  { key: "store", label: "Store", icon: Store },
  { key: "complete", label: "Finish", icon: Check },
];

export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("business");
  const [business, setBusiness] = useState<BusinessForm>(initialBusiness);
  const [store, setStore] = useState<StoreForm>(initialStore);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [skipped, setSkipped] = useState(false);
  const [isCheckingStore, setIsCheckingStore] = useState(true);

  // Verify whether onboarding is still needed
  useEffect(() => {
    if (skipped) return;
    setIsCheckingStore(true);
    fetch("/api/onboarding/status")
      .then((r) => r.json())
      .then((data) => {
        setIsCheckingStore(false);
        if (!data.needsOnboarding) {
          router.replace("/auth/signin");
        }
      })
      .catch(() => {
        setIsCheckingStore(false);
      });
  }, [router, skipped]);

  // Step navigation
  const goNext = () => {
    const order: Step[] = ["business", "store", "complete"];
    setStep(order[order.indexOf(step) + 1]);
  };
  const goBack = () => {
    const order: Step[] = ["business", "store", "complete"];
    setStep(order[order.indexOf(step) - 1]);
  };

  // Form submission
  const submitForm = async () => {
    setSubmitError("");
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step1: {
            logo: business.logo || undefined,
            address: business.address.trim() || undefined,
            currency: business.currency,
            language: business.language,
          },
          step2: {
            branchName: store.branchName.trim() || "Main Branch",
            storeAddress: store.storeAddress.trim() || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSubmitError(data.error ?? "Something went wrong.");
        return;
      }
      router.replace("/dashboard");
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Skip / demo mode
  const handleSkip = () => {
    setSkipped(true);
    router.replace("/dashboard");
  };

  // Render guards
  if (isCheckingStore) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const steps: Step[] = ["business", "store", "complete"];
  const stepIdx = steps.indexOf(step);

  const updateBusiness = (patch: Partial<BusinessForm>) =>
    setBusiness((s) => ({ ...s, ...patch }));
  const updateStore = (patch: Partial<StoreForm>) =>
    setStore((s) => ({ ...s, ...patch }));

  // Logo upload handler
  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      updateBusiness({ logo: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-6">

        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
            <Smartphone className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-foreground">Welcome to RetailOS</h1>
          <p className="text-sm text-secondary">Quick setup — takes about a minute.</p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`w-2.5 h-2.5 rounded-full ${s < stepIdx + 1 ? "bg-green-500" : s === stepIdx + 1 ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>

        {/* Card */}
        <div className="bg-surface rounded-2xl border border-border card-shadow p-7 space-y-5">

          {/* STEP 1 – Business Information */}
          {step === "business" && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h2 className="text-xl font-black text-foreground">Business Information</h2>
                <p className="text-sm text-secondary mt-0.5">
                  Tell us about your business.
                </p>
              </div>

              <div className="space-y-4">
                {/* Logo upload */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Logo (optional)</label>
                  <div className="flex items-center gap-4">
                    {business.logo ? (
                      <div className="w-16 h-16 rounded-xl border border-border overflow-hidden">
                        <img src={business.logo} alt="Logo preview" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl border border-border bg-background flex items-center justify-center">
                        <Store className="w-6 h-6 text-secondary" />
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                        id="logo-upload"
                      />
                      <label
                        htmlFor="logo-upload"
                        className="cursor-pointer text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                      >
                        Choose image
                      </label>
                      <p className="text-xs text-secondary mt-0.5">PNG, JPG up to 2MB</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Address</label>
                  <input
                    type="text"
                    value={business.address}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => updateBusiness({ address: e.target.value })}
                    placeholder="Business address"
                    className="w-full bg-background border border-border rounded-xl py-3 px-4 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-secondary/50 text-sm font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Currency</label>
                    <select
                      value={business.currency}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => updateBusiness({ currency: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl py-3 px-4 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all text-sm font-medium"
                    >
                      <option value="BDT">BDT (৳)</option>
                      <option value="USD">USD ($)</option>
                      <option value="INR">INR (₹)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Language</label>
                    <select
                      value={business.language}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => updateBusiness({ language: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl py-3 px-4 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all text-sm font-medium"
                    >
                      <option value="English">English</option>
                      <option value="বাংলা">বাংলা</option>
                    </select>
                  </div>
                </div>
              </div>

              <Button
                className="w-full flex items-center justify-center gap-2 py-3.5"
                onClick={goNext}
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* STEP 2 – Store Details */}
          {step === "store" && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h2 className="text-xl font-black text-foreground">Store Details</h2>
                <p className="text-sm text-secondary mt-0.5">
                  Set up your store branch.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Branch Name</label>
                  <div className="relative">
                    <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                    <input
                      type="text"
                      value={store.branchName}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => updateStore({ branchName: e.target.value })}
                      placeholder="e.g. Main Branch"
                      className="w-full bg-background border border-border rounded-xl py-3 pl-10 pr-4 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-secondary/50 text-sm font-medium"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Store Address</label>
                  <input
                    type="text"
                    value={store.storeAddress}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => updateStore({ storeAddress: e.target.value })}
                    placeholder="Store street address"
                    className="w-full bg-background border border-border rounded-xl py-3 px-4 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-secondary/50 text-sm font-medium"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1 py-3" onClick={goBack}>
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button
                  className="flex-1 flex items-center justify-center gap-2 py-3.5"
                  onClick={goNext}
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3 – Complete */}
          {step === "complete" && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h2 className="text-xl font-black text-foreground">Complete Setup</h2>
                <p className="text-sm text-secondary mt-0.5">
                  Review your information before finishing.
                </p>
              </div>

              <div className="space-y-3">
                {/* Summary card */}
                <div className="bg-background rounded-xl border border-border p-4 space-y-1">
                  <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Business</p>
                  <p className="text-sm font-black text-foreground">{business.address || "No address provided"}</p>
                  <div className="flex gap-3 mt-1 text-xs text-secondary">
                    <span>{business.currency}</span>
                    <span>{business.language}</span>
                  </div>
                </div>

                <div className="bg-background rounded-xl border border-border p-4 space-y-1">
                  <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Store</p>
                  <p className="text-sm font-black text-foreground">{store.branchName}</p>
                  {store.storeAddress && <p className="text-xs text-secondary">{store.storeAddress}</p>}
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1 py-3" onClick={goBack}>
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button
                  className="flex-1 flex items-center justify-center gap-2 py-3.5"
                  disabled={loading}
                  onClick={submitForm}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Complete Setup
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Error banner */}
          {submitError && (
            <div className="bg-red-50 border border-red-200 p-3.5 rounded-xl flex items-start gap-3 text-red-700 text-xs font-bold animate-in fade-in">
              <AlertCircle className="w-4 h-4 mt-px flex-shrink-0" />
              <div>{submitError}</div>
            </div>
          )}
        </div>

        {/* Skip link */}
        <div className="text-center">
          <button
            onClick={handleSkip}
            className="text-xs text-secondary/60 hover:text-secondary font-medium transition-colors"
          >
            Skip for now — continue to dashboard
          </button>
        </div>

        {/* Footer */}
        <p className="text-[10px] font-bold text-secondary/40 uppercase tracking-widest text-center">
          &copy; 2026 RetailOS v1.0 &bull; Load-shedding friendly &bull; BDT ready
        </p>

        {/* Decorative background blobs */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
        </div>
      </div>
    </div>
  );
}