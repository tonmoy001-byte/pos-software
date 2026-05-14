"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Plus, Search, Phone, MapPin, X, DollarSign,
  ShoppingCart, CreditCard, User, Edit2, Download,
  ChevronLeft, ChevronRight, Trash2, FileSpreadsheet
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dueFilter, setDueFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<any>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerDetails, setCustomerDetails] = useState<any>(null);
  const [detailsTab, setDetailsTab] = useState<"overview" | "sales" | "payments">("overview");
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{type: "success"|"error", text: string} | null>(null);

  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [editForm, setEditForm] = useState({ name: "", phone: "", address: "" });
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "CASH", note: "" });

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/customers?stats=true");
      if (res.ok) setStats(await res.json());
    } catch (err) { console.error(err); }
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "24");
      if (searchQuery) params.set("query", searchQuery);
      if (dueFilter !== "all") params.set("dueStatus", dueFilter);

      const res = await fetch(`/api/customers?${params}`);
      if (res.ok) {
        const json = await res.json();
        setCustomers(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 1);
      }
    } catch (err) {
      console.error("Failed to fetch customers", err);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, dueFilter]);

  useEffect(() => { fetchStats(); }, []);
  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const handleAddCustomer = async () => {
    if (!form.name || !form.phone) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Customer added!" });
        setIsAddOpen(false);
        setForm({ name: "", phone: "", address: "" });
        fetchCustomers();
        fetchStats();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to add" });
      }
    } catch { setMessage({ type: "error", text: "Error" }); }
    finally { setSubmitting(false); }
  };

  const handleEditCustomer = async () => {
    if (!editForm.name || !editForm.phone) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Customer updated!" });
        setIsEditOpen(false);
        openCustomerDetails(selectedCustomer.id);
        fetchCustomers();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to update" });
      }
    } catch { setMessage({ type: "error", text: "Error" }); }
    finally { setSubmitting(false); }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm("Delete this customer?")) return;
    try {
      await fetch(`/api/customers/${id}`, { method: "DELETE" });
      fetchCustomers();
      fetchStats();
    } catch (err) { console.error("Delete failed", err); }
  };

  const openCustomerDetails = async (id: string) => {
    setDetailsTab("overview");
    setIsPaymentOpen(false);
    try {
      const res = await fetch(`/api/customers/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedCustomer(data);
        setCustomerDetails(data);
      }
    } catch (err) { console.error("Failed to fetch details", err); }
  };

  const handleReceivePayment = async () => {
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}/payment`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(paymentForm.amount),
          method: paymentForm.method,
          note: paymentForm.note
        })
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Payment received!" });
        setIsPaymentOpen(false);
        setPaymentForm({ amount: "", method: "CASH", note: "" });
        openCustomerDetails(selectedCustomer.id);
        fetchCustomers();
        fetchStats();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Payment failed" });
      }
    } catch { setMessage({ type: "error", text: "Error" }); }
    finally { setSubmitting(false); }
  };

  const handleDownloadExport = async () => {
    const res = await fetch("/api/customers/export");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "customers-export.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && customers.length === 0) {
    return <div className="p-8 animate-pulse text-secondary font-bold">Loading Customers...</div>;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold ${
          message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-foreground">Customers</h1>
          <p className="text-xs text-secondary font-bold uppercase tracking-widest mt-1">Manage customer database and track dues</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleDownloadExport} variant="secondary" size="sm">
            <FileSpreadsheet className="w-4 h-4" /> Export
          </Button>
          <Button onClick={() => setIsAddOpen(true)} size="sm">
            <Plus className="w-5 h-5" /> Add Customer
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface p-5 rounded-2xl border border-border">
          <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Total Customers</p>
          <p className="text-2xl font-black mt-1">{stats?.totalCustomers || 0}</p>
        </div>
        <div className="bg-surface p-5 rounded-2xl border border-border">
          <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Total Due</p>
          <p className="text-2xl font-black text-red-600 mt-1">{formatCurrency(stats?.totalDue || 0)}</p>
        </div>
        <div className="bg-surface p-5 rounded-2xl border border-border">
          <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">With Dues</p>
          <p className="text-2xl font-black text-orange-600 mt-1">{stats?.customersWithDue || 0}</p>
        </div>
        <div className="bg-surface p-5 rounded-2xl border border-border">
          <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Without Dues</p>
          <p className="text-2xl font-black text-green-600 mt-1">{(stats?.totalCustomers || 0) - (stats?.customersWithDue || 0)}</p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-border outline-none focus:border-primary font-medium bg-surface"
          />
        </div>
        <div className="flex gap-2">
          {[
            { key: "all", label: "All" },
            { key: "due", label: "With Due", color: "text-orange-600" },
            { key: "nodue", label: "No Due", color: "text-green-600" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => { setDueFilter(f.key); setPage(1); }}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                dueFilter === f.key
                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                  : "bg-surface text-secondary border-border hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Table */}
      <div className="bg-surface rounded-2xl border border-border card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-background text-secondary text-[10px] font-black uppercase tracking-widest border-b border-border">
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Address</th>
                <th className="px-6 py-4">Due</th>
                <th className="px-6 py-4">Purchases</th>
                <th className="px-6 py-4">Since</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading && customers.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-secondary font-bold animate-pulse">Loading customers...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-secondary italic">No customers found.</td></tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-background/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold">{customer.name}</p>
                      <p className="text-xs text-secondary">{customer.phone}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-secondary">{customer.address || "-"}</td>
                    <td className="px-6 py-4">
                      <span className={`font-bold ${Number(customer.dueAmount) > 0 ? "text-red-500" : "text-green-600"}`}>
                        {formatCurrency(customer.dueAmount || 0)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">{customer._count?.sales || "—"}</td>
                    <td className="px-6 py-4 text-sm text-secondary">{customer.createdAt ? formatDate(customer.createdAt) : "—"}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openCustomerDetails(customer.id)}
                          className="bg-primary/10 text-primary hover:bg-primary hover:text-white p-2 rounded-lg transition-all"
                          title="View Details"
                        >
                          <User className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditForm({
                              name: customer.name || "",
                              phone: customer.phone || "",
                              address: customer.address || "",
                            });
                            setSelectedCustomer(customer);
                            setIsEditOpen(true);
                          }}
                          className="bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white p-2 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(customer.id)}
                          className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white p-2 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 rounded-xl border border-border disabled:opacity-30 bg-surface"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold text-secondary">
            Page {page} of {totalPages} ({total} customers)
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-xl border border-border disabled:opacity-30 bg-surface"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Add Customer Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-md rounded-3xl p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Add New Customer</h2>
              <button onClick={() => setIsAddOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-secondary uppercase">Name *</label>
                <input type="text" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary font-medium mt-1"
                  placeholder="Customer name" />
              </div>
              <div>
                <label className="text-xs font-bold text-secondary uppercase">Phone *</label>
                <input type="tel" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary font-medium mt-1"
                  placeholder="01XXXXXXXXX" />
              </div>
              <div>
                <label className="text-xs font-bold text-secondary uppercase">Address</label>
                <input type="text" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary font-medium mt-1"
                  placeholder="Address (optional)" />
              </div>
            </div>
            <Button className="w-full" onClick={handleAddCustomer} disabled={submitting || !form.name || !form.phone}>
              {submitting ? "Saving..." : "Add Customer"}
            </Button>
          </div>
        </div>
      )}

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface w-full max-w-2xl rounded-3xl p-8 space-y-6 relative">
            <button onClick={() => { setSelectedCustomer(null); setCustomerDetails(null); }}
              className="absolute top-6 right-6 text-secondary hover:text-foreground"><X className="w-5 h-5" /></button>

            {/* Customer Header */}
            <div className="flex items-center gap-4 pr-10">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
                <User className="w-7 h-7 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold truncate">{selectedCustomer.name || customerDetails?.name}</h2>
                <p className="text-sm text-secondary flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> {selectedCustomer.phone || customerDetails?.phone}
                </p>
                {(selectedCustomer.address || customerDetails?.address) && (
                  <p className="text-xs text-secondary flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" /> {selectedCustomer.address || customerDetails?.address}
                  </p>
                )}
              </div>
              <button onClick={() => {
                setEditForm({
                  name: customerDetails?.name || selectedCustomer.name || "",
                  phone: customerDetails?.phone || selectedCustomer.phone || "",
                  address: customerDetails?.address || selectedCustomer.address || "",
                });
                setIsEditOpen(true);
              }} className="p-2 text-secondary hover:text-primary rounded-lg hover:bg-primary/5">
                <Edit2 className="w-4 h-4" />
              </button>
            </div>

            {/* Due Summary + Payment */}
            <div className="grid grid-cols-2 gap-4">
              <div className={`p-5 rounded-2xl border ${Number(customerDetails?.dueAmount || 0) > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <p className="text-sm font-bold flex items-center gap-2">
                  <DollarSign className="w-4 h-4" /> Total Due
                </p>
                <p className={`text-2xl font-black mt-1 ${Number(customerDetails?.dueAmount || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(customerDetails?.dueAmount || 0)}
                </p>
              </div>
              <button
                onClick={() => setIsPaymentOpen(!isPaymentOpen)}
                className="p-5 bg-green-50 rounded-2xl border border-green-200 hover:bg-green-100 transition-colors text-left"
              >
                <p className="text-sm font-bold text-green-600 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" /> Receive Payment
                </p>
                <p className="text-lg font-black text-green-600 mt-1">Click to Pay</p>
              </button>
            </div>

            {/* Payment Form */}
            {isPaymentOpen && (
              <div className="p-6 bg-background rounded-2xl space-y-4 border border-border">
                <h3 className="font-bold">Receive Payment</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-secondary uppercase">Amount</label>
                    <input type="number" value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary font-bold mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-secondary uppercase">Method</label>
                    <select value={paymentForm.method}
                      onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary mt-1">
                      {["CASH","BKASH","NAGAD","CARD","BANK"].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-secondary uppercase">Note</label>
                  <input type="text" value={paymentForm.note}
                    onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary mt-1" />
                </div>
                <Button className="w-full" onClick={handleReceivePayment} disabled={submitting || !paymentForm.amount}>
                  {submitting ? "Processing..." : "Confirm Payment"}
                </Button>
              </div>
            )}

            {/* Tabs */}
            <div className="flex bg-background p-1 rounded-2xl border border-border">
              {[
                { key: "overview" as const, label: "Overview" },
                { key: "sales" as const, label: "Sales History" },
                { key: "payments" as const, label: "Payments" },
              ].map((t) => (
                <button key={t.key}
                  onClick={() => setDetailsTab(t.key)}
                  className={`flex-1 px-4 py-2 rounded-xl text-sm font-black transition-all ${
                    detailsTab === t.key ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-secondary hover:text-foreground"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {detailsTab === "overview" && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-4 bg-background rounded-xl">
                  <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Total Purchases</p>
                  <p className="text-xl font-black mt-1">{customerDetails?._count?.sales || 0}</p>
                </div>
                <div className="p-4 bg-background rounded-xl">
                  <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Member Since</p>
                  <p className="text-xl font-black mt-1">{customerDetails?.createdAt ? formatDate(customerDetails.createdAt) : "—"}</p>
                </div>
                {customerDetails?.sales && customerDetails.sales.length > 0 && (
                  <>
                    <div className="p-4 bg-background rounded-xl">
                      <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Total Spent</p>
                      <p className="text-xl font-black text-primary mt-1">
                        {formatCurrency(customerDetails.sales.reduce((s: number, sale: any) => s + Number(sale.totalAmount), 0))}
                      </p>
                    </div>
                    <div className="p-4 bg-background rounded-xl">
                      <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Last Purchase</p>
                      <p className="text-xl font-black mt-1">{formatDate(customerDetails.sales[0].createdAt)}</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {detailsTab === "sales" && (
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {customerDetails?.sales?.length > 0 ? (
                  customerDetails.sales.map((sale: any) => (
                    <div key={sale.id} className="p-4 bg-background rounded-xl border border-border/50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-sm">{sale.invoiceId}</p>
                          <p className="text-xs text-secondary">{formatDate(sale.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(sale.totalAmount)}</p>
                          <p className={`text-xs font-bold ${Number(sale.dueAmount) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {sale.status} {Number(sale.dueAmount) > 0 && `(${formatCurrency(sale.dueAmount)} due)`}
                          </p>
                        </div>
                      </div>
                      {sale.items?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {sale.items.map((item: any, i: number) => (
                            <span key={i} className="text-[10px] bg-surface px-2 py-0.5 rounded-full border border-border text-secondary">
                              {item.product?.name || "Unknown"}×{item.quantity}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-center text-secondary italic py-8">No purchases yet.</p>
                )}
              </div>
            )}

            {detailsTab === "payments" && (
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {customerDetails?.sales?.filter((s: any) => s.payments?.length > 0).length > 0 ? (
                  customerDetails.sales.flatMap((sale: any) =>
                    sale.payments?.map((pmt: any, i: number) => (
                      <div key={`${sale.id}-${i}`} className="p-4 bg-background rounded-xl flex justify-between items-center border border-border/50">
                        <div>
                          <p className="font-bold text-sm">{sale.invoiceId}</p>
                          <p className="text-xs text-secondary">{pmt.method} · {formatDate(pmt.date)}</p>
                        </div>
                        <p className="font-bold text-green-600">{formatCurrency(pmt.amount)}</p>
                      </div>
                    ))
                  )
                ) : (
                  <p className="text-center text-secondary italic py-8">No payments recorded.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-md rounded-3xl p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Edit Customer</h2>
              <button onClick={() => setIsEditOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-secondary uppercase">Name</label>
                <input type="text" value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary font-medium mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold text-secondary uppercase">Phone</label>
                <input type="tel" value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary font-medium mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold text-secondary uppercase">Address</label>
                <input type="text" value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary font-medium mt-1" />
              </div>
            </div>
            <Button className="w-full" onClick={handleEditCustomer} disabled={submitting || !editForm.name || !editForm.phone}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
