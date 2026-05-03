"use client";

import { useState, useEffect } from "react";
import { 
  Plus, 
  Search,
  Phone,
  MapPin,
  X,
  Trash2,
  DollarSign,
  ShoppingCart,
  CreditCard,
  User,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerDetails, setCustomerDetails] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{type: "success"|"error", text: string} | null>(null);

  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "CASH", note: "" });

  const fetchCustomers = async () => {
    try {
      const res = await fetch("/api/customers");
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (err) {
      console.error("Failed to fetch customers", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleAddCustomer = async () => {
    if (!form.name || !form.phone) return;
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Customer added!" });
        setIsAddOpen(false);
        setForm({ name: "", phone: "", address: "" });
        fetchCustomers();
      } else {
        setMessage({ type: "error", text: "Failed to add customer" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm("Delete this customer?")) return;
    
    try {
      await fetch(`/api/customers/${id}`, { method: "DELETE" });
      fetchCustomers();
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const openCustomerDetails = async (customer: any) => {
    setSelectedCustomer(customer);
    setIsDetailsOpen(true);
    
    // Fetch customer details including sales
    try {
      const res = await fetch(`/api/customers/${customer.id}`);
      if (res.ok) {
        const data = await res.json();
        setCustomerDetails(data);
      }
    } catch (err) {
      console.error("Failed to fetch details", err);
    }
  };

  const handleReceivePayment = async () => {
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) return;
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        openCustomerDetails(selectedCustomer);
        fetchCustomers();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to receive payment" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Error" });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    !searchQuery ||
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.includes(searchQuery)
  );

  if (loading) {
    return <div className="p-8 animate-pulse text-secondary font-bold">Loading Customers...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      {message && (
        <div className={`p-4 rounded-xl text-sm font-bold ${
          message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold">Customers</h1>
          <p className="text-secondary">Manage customer database and track dues.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="w-5 h-5" /> Add Customer
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
        <input 
          type="text" 
          placeholder="Search by name or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-border outline-none focus:border-primary"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map((customer) => (
          <div key={customer.id} className="bg-surface p-6 rounded-2xl border border-border card-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{customer.name}</h3>
                  <p className="text-sm text-secondary flex items-center gap-2">
                    <Phone className="w-4 h-4" /> {customer.phone}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => handleDeleteCustomer(customer.id)}
                className="p-2 text-secondary hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {customer.address && (
              <p className="text-xs text-secondary flex items-center gap-2 mb-3">
                <MapPin className="w-3 h-3" /> {customer.address}
              </p>
            )}

            <div className="flex gap-3">
              <div className={`flex-1 p-3 rounded-xl text-center ${Number(customer.dueAmount) > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                <p className="text-xs text-secondary font-bold">Due</p>
                <p className={`font-bold ${Number(customer.dueAmount) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(customer.dueAmount || 0)}
                </p>
              </div>
              <button 
                onClick={() => openCustomerDetails(customer)}
                className="flex-1 p-3 rounded-xl bg-primary/5 border border-primary/20 text-center hover:bg-primary/10 transition-colors"
              >
                <p className="text-xs text-primary font-bold">View Details</p>
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredCustomers.length === 0 && (
        <div className="text-center py-12 text-secondary">
          <p>No customers found.</p>
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
                <input 
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary"
                  placeholder="Customer name"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-secondary uppercase">Phone *</label>
                <input 
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary"
                  placeholder="01XXXXXXXXX"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-secondary uppercase">Address</label>
                <input 
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary"
                  placeholder="Address (optional)"
                />
              </div>
            </div>

            <Button 
              className="w-full" 
              onClick={handleAddCustomer}
              disabled={submitting || !form.name || !form.phone}
            >
              {submitting ? "Saving..." : "Add Customer"}
            </Button>
          </div>
        </div>
      )}

      {/* Customer Details Modal */}
      {isDetailsOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface w-full max-w-2xl rounded-3xl p-8 space-y-6">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <User className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{selectedCustomer.name}</h2>
                  <p className="text-secondary flex items-center gap-2">
                    <Phone className="w-4 h-4" /> {selectedCustomer.phone}
                  </p>
                  {selectedCustomer.address && (
                    <p className="text-secondary flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4" /> {selectedCustomer.address}
                    </p>
                  )}
                </div>
              </div>
              <button onClick={() => { setIsDetailsOpen(false); setSelectedCustomer(null); setCustomerDetails(null); }}>
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Due Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 bg-red-50 rounded-2xl border border-red-200">
                <p className="text-sm font-bold text-red-600 flex items-center gap-2">
                  <ArrowDownRight className="w-4 h-4" /> Total Due
                </p>
                <p className="text-3xl font-black text-red-600 mt-2">
                  {formatCurrency(selectedCustomer.dueAmount || 0)}
                </p>
              </div>
              <button 
                onClick={() => setIsPaymentOpen(!isPaymentOpen)}
                className="p-6 bg-green-50 rounded-2xl border border-green-200 hover:bg-green-100 transition-colors"
              >
                <p className="text-sm font-bold text-green-600 flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4" /> Receive Payment
                </p>
                <p className="text-3xl font-black text-green-600 mt-2">Click to Pay</p>
              </button>
            </div>

            {/* Payment Form */}
            {isPaymentOpen && (
              <div className="p-6 bg-background rounded-2xl space-y-4">
                <h3 className="font-bold">Receive Payment</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-secondary uppercase">Amount</label>
                    <input 
                      type="number"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary font-bold"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-secondary uppercase">Method</label>
                    <select 
                      value={paymentForm.method}
                      onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary"
                    >
                      <option value="CASH">CASH</option>
                      <option value="BKASH">BKASH</option>
                      <option value="NAGAD">NAGAD</option>
                      <option value="CARD">CARD</option>
                      <option value="BANK">BANK</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-secondary uppercase">Note</label>
                  <input 
                    type="text"
                    value={paymentForm.note}
                    onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary"
                    placeholder="Payment note (optional)"
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleReceivePayment}
                  disabled={submitting || !paymentForm.amount}
                >
                  {submitting ? "Processing..." : "Confirm Payment"}
                </Button>
              </div>
            )}

            {/* Sales History */}
            <div>
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" /> Purchase History
              </h3>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {customerDetails?.sales?.length > 0 ? (
                  customerDetails.sales.map((sale: any) => (
                    <div key={sale.id} className="p-4 bg-background rounded-xl flex justify-between items-center">
                      <div>
                        <p className="font-bold text-sm">{sale.invoiceId}</p>
                        <p className="text-xs text-secondary">{formatDate(sale.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(sale.totalAmount)}</p>
                        <p className={`text-xs ${sale.dueAmount > 0 ? 'text-red-500' : 'text-green-500'}`}>
                          {sale.status} {sale.dueAmount > 0 && `(${formatCurrency(sale.dueAmount)} due)`}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-secondary text-sm italic">No purchases yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}