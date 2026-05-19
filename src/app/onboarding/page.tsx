"use client";

import { Suspense, useState, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Store,
  User,
  Lock,
  Check,
  ChevronRight,
  Smartphone,
  AlertCircle,
  Loader2,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui";

export const dynamic = "force-dynamic";

/** ── Step definition ───────────────────────────────────────────────────── */
type Step = "shop" | "admin" | "review";

interface ShopForm {
  shopName: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
}

const initialShop: ShopForm = {
  shopName: "",
  address: "",
  phone: "",
  email: "",
  taxId: "",
};

interface AdminForm {
  username: string;
  password: string;
  confirmPassword: string;
  name: string;
}

const initialAdmin: AdminForm = {
  username: "",
  password: "",
  confirmPassword: "",
  name: "",
};

const STEPS: { key: Step; label: string; icon: typeof Store }[] = [
  { key: "shop", label: "Shop", icon: Building2 },
  { key: "admin", label: "Admin", icon: User },
  { key: "review", label: "Finish", icon: Check },
];

/** ── Component ─────────────────────────────────────────────────────────── */
export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("shop");
  const [shop, setShop] = useState<ShopForm>(initialShop);
  const [admin, setAdmin] = useState<AdminForm>(initialAdmin);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [skipped, setSkipped] = useState(false);
  const [isCheckingStore, setIsCheckingStore] = useState(true);

  // ── Verify whether onboarding is still needed ───────────────────────────
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

  // ── Step navigation ─────────────────────────────────────────────────────
  const goNext = () => {
    const order: Step[] = ["shop", "admin", "review"];
    setStep(order[order.indexOf(step) + 1]);
  };
  const goBack = () => {
    const order: Step[] = ["shop", "admin", "review"];
    setStep(order[order.indexOf(step) - 1]);
  };

  // ── Validation ──────────────────────────────────────────────────────────
  function validateShop(): boolean {
    if (!shop.shopName.trim() || shop.shopName.trim().length < 2) return false;
    if (shop.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shop.email)) return false;
    return true;
  }

  function validateAdmin(): boolean {
    const u = admin.username.trim();
    const p = admin.password;
    const c = admin.confirmPassword;
    const n = admin.name.trim();
    return u.length >= 3 && n.length >= 2 && p.length >= 6 && p === c;
  }

  // ── Form submission ──────────────────────────────────────────────────────
  const submitForm = async () => {
    setSubmitError("");
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: shop.shopName.trim(),
          address: shop.address.trim(),
          phone: shop.phone.trim(),
          email: shop.email.trim(),
          taxId: shop.taxId.trim(),
          username: admin.username.trim(),
          password: admin.password,
          name: admin.name.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSubmitError(data.error ?? "Something went wrong.");
        return;
      }
      router.replace("/auth/signin?onboarded=1");
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Skip / demo mode ────────────────────────────────────────────────────
  const handleSkip = () => {
    setSkipped(true);
    router.replace("/auth/signin?demo=1");
  };

  // ── Render guards ───────────────────────────────────────────────────────
  if (isCheckingStore) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const steps: Step[] = ["shop", "admin", "review"];
  const stepIdx = steps.indexOf(step);

  const updateShop = (patch: Partial<ShopForm>) =>
    setShop((s) => ({ ...s, ...patch }));
  const updateAdmin = (patch: Partial<AdminForm>) =>
    setAdmin((s) => ({ ...s, ...patch }));

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-6">

        {/* ── Brand ─────────────────────────────────────────────────────── */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
            <Smartphone className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-foreground">Welcome to RetailOS</h1>
          <p className="text-sm text-secondary">Quick setup — takes about a minute.</p>
        </div>

        {/* ── Step pill bar ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((s, i) => {
            const done  = i < stepIdx;
            const active = i === stepIdx;
            const Icon = s.icon;
            return (
              <div key={s.key} className="flex items-center gap-2">
                {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-border" />}
                <div
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest
                    transition-colors
                    ${done   ? "bg-primary text-white"
                    : active ? "bg-primary/15 text-primary"
                    :         "bg-surface border border-border text-secondary"}
                  `}
                >
                  <Icon className="w-3 h-3" />
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Card ───────────────────────────────────────────────────────── */}
        <div className="bg-surface rounded-2xl border border-border card-shadow p-7 space-y-5">

          {/* ═══ STEP 1 – Shop ═══════════════════════════════════════════════ */}
          {step === "shop" && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h2 className="text-xl font-black text-foreground">Your Shop</h2>
                <p className="text-sm text-secondary mt-0.5">
                  Tell us about your mobile shop.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Shop Name *</label>
                  <div className="relative">
                    <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                    <input
                      type="text"
                      value={shop.shopName}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => updateShop({ shopName: e.target.value })}
                      placeholder="e.g. Rong Mobile Plaza"
                      className="w-full bg-background border border-border rounded-xl py-3 pl-10 pr-4 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-secondary/50 text-sm font-medium"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Address</label>
                  <input
                    type="text"
                    value={shop.address}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => updateShop({ address: e.target.value })}
                    placeholder="Shop street address"
                    className="w-full bg-background border border-border rounded-xl py-3 px-4 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-secondary/50 text-sm font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Phone</label>
                    <input
                      type="tel"
                      value={shop.phone}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => updateShop({ phone: e.target.value })}
                      placeholder="01XX-XXXXXXX"
                      className="w-full bg-background border border-border rounded-xl py-3 px-4 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-secondary/50 text-sm font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Email</label>
                    <input
                      type="email"
                      value={shop.email}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => updateShop({ email: e.target.value })}
                      placeholder="shop@example.com"
                      className="w-full bg-background border border-border rounded-xl py-3 px-4 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-secondary/50 text-sm font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Tax / TIN</label>
                  <input
                    type="text"
                    value={shop.taxId}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => updateShop({ taxId: e.target.value })}
                    placeholder="Optional"
                    className="w-full bg-background border border-border rounded-xl py-3 px-4 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-secondary/50 text-sm font-medium"
                  />
                </div>
              </div>

              <Button
                className="w-full flex items-center justify-center gap-2 py-3.5"
                onClick={() => validateShop() && goNext()}
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* ═══ STEP 2 – Admin user ═════════════════════════════════════════ */}
          {step === "admin" && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h2 className="text-xl font-black text-foreground">Admin Account</h2>
                <p className="text-sm text-secondary mt-0.5">
                  Create the first admin user to manage this shop.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                    <input
                      type="text"
                      value={admin.name}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => updateAdmin({ name: e.target.value })}
                      placeholder="e.g. Rahim Mia"
                      className="w-full bg-background border border-border rounded-xl py-3 pl-10 pr-4 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-secondary/50 text-sm font-medium"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Username *</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                    <input
                      type="text"
                      value={admin.username}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => updateAdmin({ username: e.target.value.toLowerCase() })}
                      placeholder="e.g. rahim"
                      className="w-full bg-background border border-border rounded-xl py-3 pl-10 pr-4 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-secondary/50 text-sm font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                    <input
                      type="password"
                      value={admin.password}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => updateAdmin({ password: e.target.value })}
                      placeholder="Minimum 6 characters"
                      className="w-full bg-background border border-border rounded-xl py-3 pl-10 pr-4 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-secondary/50 text-sm font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Confirm Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                    <input
                      type="password"
                      value={admin.confirmPassword}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => updateAdmin({ confirmPassword: e.target.value })}
                      placeholder="Re-type password"
                      className="w-full bg-background border border-border rounded-xl py-3 pl-10 pr-4 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-secondary/50 text-sm font-medium"
                    />
                  </div>
                  {admin.password && admin.confirmPassword && admin.password !== admin.confirmPassword && (
                    <p className="text-[10px] text-error font-bold mt-0.5 ml-1">Passwords do not match.</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1 py-3" onClick={goBack}>
                  Back
                </Button>
                <Button
                  className="flex-1 flex items-center justify-center gap-2 py-3.5"
                  onClick={() => validateAdmin() && goNext()}
                >
                  Review
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ═══ STEP 3 – Review & confirm ══════════════════════════════════ */}
          {step === "review" && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h2 className="text-xl font-black text-foreground">Review &amp; Confirm</h2>
                <p className="text-sm text-secondary mt-0.5">
                  Make sure the details are correct before finishing.
                </p>
              </div>

              <div className="space-y-3">
                {/* Shop summary */}
                <div className="bg-background rounded-xl border border-border p-4 space-y-1">
                  <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Shop</p>
                  <p className="text-sm font-black text-foreground">{shop.shopName}</p>
                  {shop.address && <p className="text-xs text-secondary">{shop.address}</p>}
                  <div className="flex gap-3 mt-1 text-xs text-secondary">
                    {shop.phone && <span>{shop.phone}</span>}
                    {shop.email && <span>{shop.email}</span>}
                    {shop.taxId && <span>TIN: {shop.taxId}</span>}
                  </div>
                </div>

                {/* Admin summary */}
                <div className="bg-background rounded-xl border border-border p-4 space-y-1">
                  <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Admin User</p>
                  <p className="text-sm font-black text-foreground">{admin.name}</p>
                  <div className="flex gap-3 mt-1 text-xs text-secondary">
                    <span>@{admin.username}</span>
                    <span>&#x1F511; Admin</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1 py-3" onClick={goBack}>
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

          {/* ── Error banner ──────────────────────────────────────────────── */}
          {submitError && (
            <div className="bg-red-50 border border-red-200 p-3.5 rounded-xl flex items-start gap-3 text-red-700 text-xs font-bold animate-in fade-in">
              <AlertCircle className="w-4 h-4 mt-px flex-shrink-0" />
              <div>
                {submitError}
                {submitError.includes("username") && (
                  <p className="text-red-600 font-normal mt-0.5">
                    Pick a different username and try again.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Skip / Demo link ────────────────────────────────────────────── */}
        <div className="text-center">
          <button
            onClick={handleSkip}
            className="text-xs text-secondary/60 hover:text-secondary font-medium transition-colors"
          >
            Skip for now — continue to demo
          </button>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <p className="text-[10px] font-bold text-secondary/40 uppercase tracking-widest text-center">
          &copy; 2026 RetailOS v1.0 &bull; Load-shedding friendly &bull; BDT ready
        </p>

        {/* ── Decorative background blobs ──────────────────────────────── */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
        </div>
      </div>
    </div>
  );
}
