"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import {
  Lock,
  User,
  Smartphone,
  ChevronRight,
  AlertCircle,
  Eye,
  EyeOff,
  Phone,
  Mail,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui";
import { safeFetch, ApiError } from "@/lib/api-client";

const BUSINESS_TYPES = [
  "Mobile Shop",
  "Electronics Store",
  "Accessories Shop",
  "Multi-Brand Store",
  "Other",
];

export default function SignUpPage() {
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await safeFetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          fullName,
          email,
          password,
          businessName,
          businessType,
          mobileNumber,
        }),
      });

      // Auto sign in after signup — proxy will redirect to /onboarding
      const signInResult = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });
      if (signInResult?.error) {
        router.push("/auth/signin?registered=true");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      if (err instanceof ApiError && err.body) {
        try { setError(JSON.parse(err.body).error || "Something went wrong. Please try again."); } catch { setError("Something went wrong. Please try again."); }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 animate-in fade-in zoom-in duration-300">
        {/* Logo + Brand */}
        <div className="text-center space-y-2 mb-2">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
            <Smartphone className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-foreground">RetailOS</h1>
          <p className="text-xs text-secondary font-bold uppercase tracking-widest">
            Unified POS Control Center
          </p>
        </div>

        {/* Signup Card */}
        <div className="bg-surface rounded-2xl border border-border card-shadow p-8 space-y-6">
          <div>
            <h2 className="text-xl font-black text-foreground">
              Create Store
            </h2>
            <p className="text-sm text-secondary mt-1">
              Register a new store to get started.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full bg-background border border-border rounded-xl py-3 pl-10 pr-4 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-secondary/50 text-sm font-medium"
                  required
                  minLength={2}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="Choose a username"
                  className="w-full bg-background border border-border rounded-xl py-3 pl-10 pr-4 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-secondary/50 text-sm font-medium"
                  required
                  minLength={3}
                  maxLength={20}
                  pattern="[a-z0-9_]+"
                />
              </div>
              <p className="text-[10px] text-secondary ml-1">Letters, numbers, and underscores only</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full bg-background border border-border rounded-xl py-3 pl-10 pr-4 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-secondary/50 text-sm font-medium"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Choose a password"
                  className="w-full bg-background border border-border rounded-xl py-3 pl-10 pr-10 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-secondary/50 text-sm font-medium"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-secondary hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">
                Business Name
              </label>
              <div className="relative">
                <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Enter business name"
                  className="w-full bg-background border border-border rounded-xl py-3 pl-10 pr-4 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-secondary/50 text-sm font-medium"
                  required
                  minLength={2}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">
                Business Type
              </label>
              <div className="relative">
                <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl py-3 pl-10 pr-4 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-secondary/50 text-sm font-medium appearance-none"
                  required
                >
                  <option value="" disabled>
                    Select business type
                  </option>
                  {BUSINESS_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">
                Mobile Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                <input
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="Enter mobile number"
                  className="w-full bg-background border border-border rounded-xl py-3 pl-10 pr-4 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-secondary/50 text-sm font-medium"
                  required
                  minLength={11}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 p-3.5 rounded-xl flex items-center gap-3 text-red-700 text-xs font-bold">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Create Store
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Sign In Link */}
        <p className="text-xs text-secondary text-center">
          Already have an account?{" "}
          <Link
            href="/auth/signin"
            className="font-bold text-primary hover:underline"
          >
            Sign In
          </Link>
        </p>

        {/* Footer */}
        <p className="text-[10px] font-bold text-secondary/50 uppercase tracking-widest text-center">
          &copy; 2026 RetailOS v1.0
        </p>
      </div>
    </div>
  );
}
