"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  UserPlus, 
  Shield, 
  User as UserIcon, 
  Trash2, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  X,
  ShieldCheck
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [form, setForm] = useState({
    name: "",
    username: "",
    password: "",
    role: "STAFF"
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      const json = await res.json();
      if (res.ok) setUsers(json);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Staff added successfully!" });
        setForm({ name: "", username: "", password: "", role: "STAFF" });
        setTimeout(() => setIsAddOpen(false), 1500);
        fetchUsers();
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Are you sure you want to remove this staff member?")) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (res.ok) fetchUsers();
      else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (err) {
      alert("Failed to delete user");
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(u => 
      (u.name || "").toLowerCase().includes(q) ||
      (u.username || "").toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  if (loading) return <div className="p-8 animate-pulse text-secondary font-bold">Loading Staff Directory...</div>;

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-secondary">Control staff access and assign store roles.</p>
        </div>
        <button 
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all"
        >
          <UserPlus className="w-5 h-5" />
          Add Staff Member
        </button>
      </div>

      {/* Role Guide */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface p-6 rounded-2xl border border-border card-shadow flex gap-4 items-start">
          <div className="bg-primary/10 p-3 rounded-xl text-primary">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold">Administrator</h3>
            <p className="text-xs text-secondary mt-1">Full access to reports, profit margins, inventory, and user management.</p>
          </div>
        </div>
        <div className="bg-surface p-6 rounded-2xl border border-border card-shadow flex gap-4 items-start">
          <div className="bg-secondary/10 p-3 rounded-xl text-secondary">
            <UserIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold">Sales Staff</h3>
            <p className="text-xs text-secondary mt-1">Limited access. Can process sales and view inventory, but cannot see profit or sensitive reports.</p>
          </div>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-surface rounded-2xl border border-border card-shadow overflow-hidden">
        <div className="p-6 border-b border-border bg-background/50 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search staff by name or username..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-border outline-none focus:border-primary transition-all bg-white"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-background text-secondary text-[10px] font-black uppercase tracking-widest border-b border-border">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Joined Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-background/50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${user.role === "ADMIN" ? "bg-primary text-white" : "bg-background border border-border text-secondary"}`}>
                        {user.name[0]}
                      </div>
                      <p className="text-sm font-bold text-foreground">{user.name}</p>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm text-secondary font-mono">
                    @{user.username}
                  </td>
                  <td className="px-6 py-5">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-tighter flex items-center gap-1 w-fit ${user.role === "ADMIN" ? "bg-primary/10 text-primary border border-primary/20" : "bg-secondary/10 text-secondary border border-border"}`}>
                      {user.role === "ADMIN" ? <Shield className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-xs text-secondary">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button 
                      onClick={() => handleDeleteUser(user.id)}
                      className="text-secondary hover:text-red-500 p-2 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddUser} className="bg-surface w-full max-w-md rounded-3xl p-8 card-shadow space-y-6 relative animate-in zoom-in-95 duration-200">
            <button type="button" onClick={() => setIsAddOpen(false)} className="absolute top-6 right-6 text-secondary hover:text-foreground">
              <X className="w-6 h-6" />
            </button>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Add Staff Member</h2>
              <p className="text-sm text-secondary">Create a new account for your store employee.</p>
            </div>

            {message && (
              <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold animate-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                {message.text}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-secondary uppercase ml-1">Full Name</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} type="text" placeholder="e.g. Tanvir Ahmed" className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary bg-background/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-secondary uppercase ml-1">Username</label>
                  <input required value={form.username} onChange={e => setForm({ ...form, username: e.target.value.toLowerCase() })} type="text" placeholder="tanvir99" className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary bg-background/50" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-secondary uppercase ml-1">Password</label>
                  <input required minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} type="password" placeholder="Min 8 characters" className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary bg-background/50" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-secondary uppercase ml-1">Assigned Role</label>
                <div className="flex p-1 bg-background rounded-xl border border-border">
                  <button 
                    type="button"
                    onClick={() => setForm({ ...form, role: "CASHIER" })}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${form.role === "CASHIER" ? "bg-white text-primary shadow-sm" : "text-secondary"}`}
                  >
                    <UserIcon className="w-3 h-3" />
                    Cashier
                  </button>
                  <button 
                    type="button"
                    onClick={() => setForm({ ...form, role: "ADMIN" })}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${form.role === "ADMIN" ? "bg-white text-primary shadow-sm" : "text-secondary"}`}
                  >
                    <Shield className="w-3 h-3" />
                    Admin
                  </button>
                </div>
              </div>
            </div>

            <button disabled={submitting} type="submit" className="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
              {submitting ? "Processing..." : "Create Account"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
