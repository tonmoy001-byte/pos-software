"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  Lock, 
  User, 
  Smartphone, 
  ChevronRight, 
  AlertCircle,
  Eye,
  EyeOff,
  Store
} from "lucide-react";

export default function SignInPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0a0a0f]">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center scale-105 blur-sm opacity-40"
        style={{ backgroundImage: `url('/pos_login_background_1777101465562.png')` }}
      />
      <div className="absolute inset-0 z-10 bg-gradient-to-br from-[#0a0a0f] via-transparent to-[#0a0a0f]/80" />

      {/* Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px]" />

      <div className="relative z-20 w-full max-w-[1000px] flex bg-white/5 backdrop-blur-2xl rounded-[40px] border border-white/10 overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-700">
        
        {/* Left Side: Branding & Info */}
        <div className="hidden lg:flex flex-1 flex-col justify-between p-12 bg-gradient-to-br from-primary/20 to-transparent border-r border-white/5">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30">
                <Smartphone className="text-white w-7 h-7" />
              </div>
              <span className="text-2xl font-black tracking-tighter text-white">RetailOS</span>
            </div>
            <h1 className="text-5xl font-black text-white leading-tight mb-6">
              Unified <br />
              <span className="text-primary italic">Mobile POS</span> <br />
              Control Center
            </h1>
            <p className="text-white/60 text-lg max-w-[320px] leading-relaxed">
              Professional management for multi-branch retail operations. Secure, real-time, and lightning fast.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-4 group cursor-help">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-primary/50 transition-colors">
                <Store className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">Multi-Branch Support</p>
                <p className="text-white/40 text-xs">Seamlessly manage Dinex 1 & Dinex 2</p>
              </div>
            </div>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-md">
              <p className="text-white/50 text-xs italic font-medium leading-relaxed">
                "Real-time visibility for Admins, branch-locked focus for Cashiers. Perfect for scaling your retail empire."
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="w-full lg:w-[450px] p-8 lg:p-16 flex flex-col justify-center">
          <div className="mb-10">
            <h2 className="text-3xl font-black text-white mb-2">Welcome Back</h2>
            <p className="text-white/40 text-sm">Please enter your credentials to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Username</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-primary transition-colors" />
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-white/20"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Password</label>
                <button type="button" onClick={() => alert("Contact admin to reset password")} className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Forgot?</button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-primary transition-colors" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-white/20"
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-bold animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2 group active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In to Branch
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-white/5 text-center">
            <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.2em]">
              Powered by RetailOS Infrastructure
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
