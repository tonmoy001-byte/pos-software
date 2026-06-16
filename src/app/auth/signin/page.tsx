"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Lock,
  User,
  Smartphone,
  ChevronRight,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui";

function SignInContent() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid username or password. Please try again.");
      } else {
        window.location.href = "/dashboard";
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
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
          <p className="text-xs text-secondary font-bold uppercase tracking-widest">Unified POS Control Center</p>
        </div>

        {/* Login Card */}
        <div className="bg-surface rounded-2xl border border-border card-shadow p-8 space-y-6">
          <div>
            <h2 className="text-xl font-black text-foreground">Welcome Back</h2>
            <p className="text-sm text-secondary mt-1">Sign in to your account to continue.</p>
          </div>

          {registered && (
            <div className="bg-green-50 border border-green-200 p-3.5 rounded-xl flex items-center gap-3 text-green-700 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              Account created successfully! Sign in with your username or email.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Username or Email</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username or email"
                  autoComplete="off"
                  className="w-full bg-background border border-border rounded-xl py-3 pl-10 pr-4 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-secondary/50 text-sm font-medium"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Password</label>
                <button type="button" onClick={() => alert("Contact admin to reset password")} className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">Forgot?</button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="new-password"
                  className="w-full bg-background border border-border rounded-xl py-3 pl-10 pr-10 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-secondary/50 text-sm font-medium"
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-secondary hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
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
                  Sign In
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Signup Link */}
        <p className="text-xs text-secondary text-center">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/signup"
            className="font-bold text-primary hover:underline"
          >
            Create Store
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

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
