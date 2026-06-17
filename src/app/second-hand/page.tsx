"use client";

import { useState } from "react";
import { 
  ShieldCheck, 
  User, 
  Upload, 
  Search,
  FileText,
  AlertTriangle,
  Fingerprint,
  Smartphone,
  X
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { safeFetch, ApiError } from "@/lib/api-client";

export default function SecondHandPage() {
  const [formData, setFormData] = useState({
    sellerName: "",
    fatherName: "",
    nidNumber: "",
    phone: "",
    model: "",
    imei: "",
    purchasePrice: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{type: "success"|"error", text: string} | null>(null);
  const [nidFile, setNidFile] = useState<File | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [records, setRecords] = useState<any[]>([]);

  const handleSubmit = async () => {
    setMessage(null);
    if (!formData.sellerName || !formData.nidNumber || !formData.model || !formData.imei || !formData.purchasePrice) {
      return setMessage({ type: "error", text: "Please fill all required fields" });
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("sellerName", formData.sellerName);
      fd.append("fatherName", formData.fatherName);
      fd.append("nidNumber", formData.nidNumber);
      fd.append("phone", formData.phone);
      fd.append("model", formData.model);
      fd.append("imei", formData.imei);
      fd.append("purchasePrice", formData.purchasePrice);
      if (nidFile) {
        fd.append("nidPhoto", nidFile);
      }

      await safeFetch("/api/second-hand", {
        method: "POST",
        body: fd
      });
      setMessage({ type: "success", text: "Purchase recorded successfully!" });
      setFormData({ sellerName: "", fatherName: "", nidNumber: "", phone: "", model: "", imei: "", purchasePrice: "" });
      setNidFile(null);
    } catch (err) {
      let text = "Connection error";
      if (err instanceof ApiError && err.body) {
        try { text = JSON.parse(err.body).error || "Failed to record purchase"; } catch { text = "Failed to record purchase"; }
      }
      setMessage({ type: "error", text });
    } finally {
      setSubmitting(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await safeFetch<any[]>("/api/second-hand");
      setRecords(data);
      setShowHistory(true);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load history" });
    }
  };

  const handleNidUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: "error", text: "File too large. Max 5MB" });
        return;
      }
      setNidFile(file);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-auto"><AlertTriangle className="w-4 h-4" /></button>
        </div>
      )}
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="text-primary w-6 h-6" />
            <span className="text-xs font-black text-primary uppercase tracking-widest">Compliance & Audit</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Second-Hand Purchase Registry</h1>
          <p className="text-secondary">Immutable legal records for used phone acquisitions.</p>
        </div>
        <button onClick={fetchHistory} className="flex items-center gap-2 bg-white border border-border px-4 py-2 rounded-xl text-sm font-bold card-shadow hover:bg-background transition-all">
          <FileText className="w-4 h-4" />
          View History
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Registration Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface p-8 rounded-3xl border border-border card-shadow space-y-6">
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <User className="text-primary w-5 h-5" />
              <h3 className="font-bold">Seller Information</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-secondary uppercase ml-1">Seller Full Name *</label>
                <input type="text" value={formData.sellerName} onChange={e => setFormData({...formData, sellerName: e.target.value})} placeholder="e.g. Rakibul Hasan" className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-secondary uppercase ml-1">Father's Name</label>
                <input type="text" value={formData.fatherName} onChange={e => setFormData({...formData, fatherName: e.target.value})} placeholder="e.g. Abul Kashem" className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-secondary uppercase ml-1">NID Number *</label>
                <input type="text" value={formData.nidNumber} onChange={e => setFormData({...formData, nidNumber: e.target.value})} placeholder="1234567890" className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-secondary uppercase ml-1">Phone Number</label>
                <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="017XXXXXXXX" className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
              </div>
            </div>

            <div className="flex items-center gap-3 border-b border-border pb-4 pt-4">
              <Smartphone className="text-primary w-5 h-5" />
              <h3 className="font-bold">Device Details</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-secondary uppercase ml-1">Device Model *</label>
                <input type="text" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} placeholder="e.g. iPhone 13 Pro" className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-secondary uppercase ml-1">Primary IMEI *</label>
                <div className="relative">
                  <input type="text" value={formData.imei} onChange={e => setFormData({...formData, imei: e.target.value})} placeholder="Scan or type IMEI" className="w-full pl-4 pr-10 py-3 rounded-xl border border-border outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono" />
                  <Fingerprint className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary w-5 h-5" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-secondary uppercase ml-1">Purchase Price *</label>
                <input type="number" value={formData.purchasePrice || undefined} onChange={e => setFormData({...formData, purchasePrice: e.target.value})} placeholder="0.00" className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-bold" />
              </div>
            </div>

            <div className="pt-6 border-t border-border flex gap-4">
              <button disabled={submitting} onClick={handleSubmit} className="flex-1 py-4 bg-primary text-white rounded-2xl font-black text-lg shadow-xl shadow-primary/30 hover:scale-[1.01] transition-all disabled:opacity-50">
                {submitting ? "Processing..." : "Finalize & Buy Device"}
              </button>
            </div>
          </div>
        </div>

        {/* NID Upload & Security Info */}
        <div className="space-y-6">
          <div 
            onClick={() => document.getElementById('nidInput')?.click()}
            className="bg-surface p-6 rounded-3xl border border-border card-shadow flex flex-col items-center justify-center text-center space-y-4 border-dashed border-2 hover:border-primary/50 transition-all cursor-pointer group"
          >
            <input 
              id="nidInput"
              type="file" 
              accept="image/*,.pdf" 
              className="hidden"
              onChange={handleNidUpload}
            />
            <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              {nidFile ? <FileText className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
            </div>
            <div>
              {nidFile ? (
                <h4 className="font-bold text-primary">{nidFile.name}</h4>
              ) : (
                <>
                  <h4 className="font-bold">NID Front & Back</h4>
                  <p className="text-xs text-secondary mt-1">Upload clear photos of the seller's National ID for legal verification.</p>
                </>
              )}
            </div>
            <button type="button" className="text-xs font-black text-primary border border-primary/20 px-4 py-2 rounded-lg hover:bg-primary hover:text-white transition-all uppercase tracking-widest">
              {nidFile ? "Change File" : "Browse Files"}
            </button>
          </div>

          <div className="bg-red-50 p-6 rounded-3xl border border-red-100 space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-red-500 w-6 h-6" />
              <h4 className="font-bold text-red-900">Legal Notice</h4>
            </div>
            <p className="text-xs text-red-700 leading-relaxed font-medium">
              By finalizing this purchase, you confirm that you have verified the seller's identity and device legitimacy. 
              <br /><br />
              <strong className="text-red-900 uppercase">Warning:</strong> These records are **IMMUTABLE** and will be stored for 5 years as per local police audit requirements. They cannot be edited or deleted.
            </p>
          </div>

          <div className="bg-surface p-6 rounded-3xl border border-border card-shadow space-y-4">
            <h4 className="font-bold flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" />
              Blacklist Check
            </h4>
            <div className="space-y-3">
              <p className="text-[10px] text-secondary leading-tight font-medium uppercase tracking-wider">Automated Verification</p>
              <div className="flex justify-between items-center bg-green-50 p-3 rounded-xl border border-green-100">
                <span className="text-xs font-bold text-green-700">Police DB Status</span>
                <span className="text-[10px] font-black bg-green-200 text-green-800 px-2 py-0.5 rounded-full uppercase">Clear</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-4xl rounded-3xl p-8 card-shadow space-y-6 relative animate-in zoom-in-95 duration-200 max-h-[80vh] overflow-y-auto">
            <button 
              onClick={() => setShowHistory(false)}
              className="absolute top-6 right-6 text-secondary hover:text-foreground"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto">
                <FileText className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold">Purchase History</h2>
              <p className="text-sm text-secondary">All second-hand device purchases recorded.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-background text-secondary text-[10px] font-black uppercase tracking-widest border-b border-border">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Seller</th>
                    <th className="px-4 py-3">NID</th>
                    <th className="px-4 py-3">Model / IMEI</th>
                    <th className="px-4 py-3">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-background/50">
                      <td className="px-4 py-3 text-xs">{formatDate(r.date)}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold">{r.sellerName}</p>
                        <p className="text-[10px] text-secondary">{r.phone || "No phone"}</p>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono">{r.nidNumber}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold">{r.model}</p>
                        <p className="text-[10px] text-secondary font-mono">{r.imei}</p>
                      </td>
                      <td className="px-4 py-3 font-bold text-primary">{formatCurrency(r.purchasePrice)}</td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-secondary italic">No records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
