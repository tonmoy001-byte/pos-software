"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, Store, Layout, Package, CreditCard, Printer, FileText, Eye, Download } from "lucide-react";
import { InvoiceRenderer } from "@/components/invoice";

type TabId = "general" | "layout" | "products" | "payment" | "footer" | "print";

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "general", label: "General", icon: Store },
  { id: "layout", label: "Layout", icon: Layout },
  { id: "products", label: "Products", icon: Package },
  { id: "payment", label: "Payment", icon: CreditCard },
  { id: "footer", label: "Footer", icon: FileText },
  { id: "print", label: "Print", icon: Printer },
];

interface GeneralSettings {
  businessName?: string;
  address?: string;
  phone?: string;
  website?: string;
  title?: string;
  logoUrl?: string;
}

interface LayoutSettings {
  showLogo?: boolean;
  showAddress?: boolean;
  showPhone?: boolean;
  showWebsite?: boolean;
  showDate?: boolean;
  showTime?: boolean;
  showInvoiceNumber?: boolean;
  showCustomer?: boolean;
  showCashier?: boolean;
}

interface ProductSettings {
  showSku?: boolean;
  showImei?: boolean;
  showWarranty?: boolean;
  showDiscount?: boolean;
  maxImeiDisplay?: number;
}

interface PaymentSettings {
  showSubtotal?: boolean;
  showDiscount?: boolean;
  showTax?: boolean;
  taxLabel?: string;
  taxRate?: number;
  showPaid?: boolean;
  showDue?: boolean;
  showPaymentMethod?: boolean;
}

interface FooterSettings {
  thankYouMessage?: string;
  returnPolicy?: string;
  warrantyPolicy?: string;
  showPolicies?: boolean;
}

interface PrintSettings {
  paperSize?: string;
  fontSize?: string;
  autoPrint?: boolean;
  cutAfterPrint?: boolean;
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? "bg-primary" : "bg-gray-300"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

export default function InvoiceSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [showPreview, setShowPreview] = useState(true);
  const [mounted, setMounted] = useState(false);

  const [general, setGeneral] = useState<GeneralSettings>({});
  const [layout, setLayout] = useState<LayoutSettings>({});
  const [products, setProducts] = useState<ProductSettings>({});
  const [payment, setPayment] = useState<PaymentSettings>({});
  const [footer, setFooter] = useState<FooterSettings>({});
  const [print, setPrint] = useState<PrintSettings>({});

  useEffect(() => {
    setMounted(true);
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/invoice-settings", { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setGeneral(typeof data.general === "object" ? data.general : {});
        setLayout(typeof data.layout === "object" ? data.layout : {});
        setProducts(typeof data.products === "object" ? data.products : {});
        setPayment(typeof data.payment === "object" ? data.payment : {});
        setFooter(typeof data.footer === "object" ? data.footer : {});
        setPrint(typeof data.print === "object" ? data.print : {});
      }
    } catch (err) {
      console.error("Failed to fetch settings", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/invoice-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ general, layout, products, payment, footer, print }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Settings saved successfully!" });
        await fetchSettings();
        setTimeout(() => setMessage(null), 3000);
      } else {
        const errData = await res.json();
        setMessage({ 
          type: "error", 
          text: errData.message || errData.error || "Failed to save settings" 
        });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: "Connection error: Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  const updateSection = (section: TabId, key: string, value: unknown) => {
    const updates: Record<TabId, (data: Record<string, unknown>) => void> = {
      general: (d) => setGeneral(d as GeneralSettings),
      layout: (d) => setLayout(d as LayoutSettings),
      products: (d) => setProducts(d as ProductSettings),
      payment: (d) => setPayment(d as PaymentSettings),
      footer: (d) => setFooter(d as FooterSettings),
      print: (d) => setPrint(d as PrintSettings),
    };
    const current: Record<string, unknown> = {
      general, layout, products, payment, footer, print
    }[section] as Record<string, unknown> || {};
    updates[section]({ ...current, [key]: value });
  };

  const previewConfig = { general, layout, products, payment, footer, print };

  const sampleInvoiceData = {
    invoiceId: "INV-0001",
    date: new Date().toISOString(),
    items: [
      { name: "iPhone 14 Pro", sku: "IP14P-256", quantity: 1, price: 120000, imeis: ["123456789012345", "123456789012346"], warranty: "1 Year Apple" },
      { name: "Case Cover", sku: "CASE-IP14", quantity: 2, price: 500, discount: 100 },
    ],
    customer: { name: "John Doe", phone: "01700-000000" },
    cashier: "Admin",
    subtotal: 121400,
    discount: 100,
    tax: 0,
    total: 121300,
    paid: 121300,
    due: 0,
    paymentMethod: "CASH",
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "general":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Business Name</label>
              <input
                type="text"
                value={general.businessName || ""}
                onChange={(e) => updateSection("general", "businessName", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary/50"
                placeholder="Your Store Name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Address</label>
              <textarea
                value={general.address || ""}
                onChange={(e) => updateSection("general", "address", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary/50 resize-none"
                rows={2}
                placeholder="123 Main Street, City"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Phone</label>
              <input
                type="text"
                value={general.phone || ""}
                onChange={(e) => updateSection("general", "phone", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary/50"
                placeholder="01700-000000"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Invoice Title</label>
              <input
                type="text"
                value={general.title || ""}
                onChange={(e) => updateSection("general", "title", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary/50"
                placeholder="INVOICE"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Logo URL</label>
              <input
                type="text"
                value={general.logoUrl || ""}
                onChange={(e) => updateSection("general", "logoUrl", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary/50"
                placeholder="https://example.com/logo.png"
              />
            </div>
          </div>
        );

      case "layout":
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Show Logo</span>
              <Toggle value={layout.showLogo !== false} onChange={(v) => updateSection("layout", "showLogo", v)} />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Show Address</span>
              <Toggle value={layout.showAddress !== false} onChange={(v) => updateSection("layout", "showAddress", v)} />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Show Phone</span>
              <Toggle value={layout.showPhone !== false} onChange={(v) => updateSection("layout", "showPhone", v)} />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Show Invoice Number</span>
              <Toggle value={layout.showInvoiceNumber !== false} onChange={(v) => updateSection("layout", "showInvoiceNumber", v)} />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Show Date</span>
              <Toggle value={layout.showDate !== false} onChange={(v) => updateSection("layout", "showDate", v)} />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Show Time</span>
              <Toggle value={layout.showTime !== false} onChange={(v) => updateSection("layout", "showTime", v)} />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Show Customer</span>
              <Toggle value={layout.showCustomer !== false} onChange={(v) => updateSection("layout", "showCustomer", v)} />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Show Cashier</span>
              <Toggle value={layout.showCashier === true} onChange={(v) => updateSection("layout", "showCashier", v)} />
            </div>
          </div>
        );

      case "products":
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Show SKU/Code</span>
              <Toggle value={products.showSku === true} onChange={(v) => updateSection("products", "showSku", v)} />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Show IMEI/Serial</span>
              <Toggle value={products.showImei !== false} onChange={(v) => updateSection("products", "showImei", v)} />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Show Discount</span>
              <Toggle value={products.showDiscount !== false} onChange={(v) => updateSection("products", "showDiscount", v)} />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Show Warranty</span>
              <Toggle value={products.showWarranty !== false} onChange={(v) => updateSection("products", "showWarranty", v)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Max IMEI Display</label>
              <input
                type="number"
                value={products.maxImeiDisplay || 2}
                onChange={(e) => updateSection("products", "maxImeiDisplay", parseInt(e.target.value) || 2)}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary/50"
                min={0}
                max={10}
              />
            </div>
          </div>
        );

      case "payment":
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Show Subtotal</span>
              <Toggle value={payment.showSubtotal !== false} onChange={(v) => updateSection("payment", "showSubtotal", v)} />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Show Discount</span>
              <Toggle value={payment.showDiscount !== false} onChange={(v) => updateSection("payment", "showDiscount", v)} />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Show Tax</span>
              <Toggle value={payment.showTax === true} onChange={(v) => updateSection("payment", "showTax", v)} />
            </div>
            {payment.showTax && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Tax Label</label>
                  <input
                    type="text"
                    value={payment.taxLabel || "VAT"}
                    onChange={(e) => updateSection("payment", "taxLabel", e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Tax Rate (%)</label>
                  <input
                    type="number"
                    value={payment.taxRate || 0}
                    onChange={(e) => updateSection("payment", "taxRate", parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary/50"
                    step="0.1"
                  />
                </div>
              </>
            )}
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Show Paid Amount</span>
              <Toggle value={payment.showPaid !== false} onChange={(v) => updateSection("payment", "showPaid", v)} />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Show Due Amount</span>
              <Toggle value={payment.showDue !== false} onChange={(v) => updateSection("payment", "showDue", v)} />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Show Payment Method</span>
              <Toggle value={payment.showPaymentMethod !== false} onChange={(v) => updateSection("payment", "showPaymentMethod", v)} />
            </div>
          </div>
        );

      case "footer":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Show Policies</span>
              <Toggle value={footer.showPolicies !== false} onChange={(v) => updateSection("footer", "showPolicies", v)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Thank You Message</label>
              <input
                type="text"
                value={footer.thankYouMessage || ""}
                onChange={(e) => updateSection("footer", "thankYouMessage", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary/50"
                placeholder="Thank you for shopping with us!"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Return Policy</label>
              <textarea
                value={footer.returnPolicy || ""}
                onChange={(e) => updateSection("footer", "returnPolicy", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary/50 resize-none"
                rows={2}
                placeholder="Return within 7 days with receipt."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Warranty Policy</label>
              <textarea
                value={footer.warrantyPolicy || ""}
                onChange={(e) => updateSection("footer", "warrantyPolicy", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary/50 resize-none"
                rows={2}
                placeholder="Warranty as per brand policy."
              />
            </div>
          </div>
        );

      case "print":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Paper Size</label>
              <select
                value={print.paperSize || "80mm"}
                onChange={(e) => updateSection("print", "paperSize", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary/50"
              >
                <option value="58mm">58mm (Small Thermal)</option>
                <option value="80mm">80mm (Standard Thermal)</option>
                <option value="A4">A4 (Page)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Font Size</label>
              <select
                value={print.fontSize || "normal"}
                onChange={(e) => updateSection("print", "fontSize", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary/50"
              >
                <option value="small">Small</option>
                <option value="normal">Normal</option>
                <option value="large">Large</option>
              </select>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Auto Print</span>
              <Toggle value={print.autoPrint === true} onChange={(v) => updateSection("print", "autoPrint", v)} />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Cut After Print</span>
              <Toggle value={print.cutAfterPrint !== false} onChange={(v) => updateSection("print", "cutAfterPrint", v)} />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoice Settings</h1>
          <p className="text-secondary mt-1">Configure your thermal invoice</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
              showPreview 
                ? "bg-primary text-white" 
                : "bg-surface border border-border text-secondary hover:text-foreground"
            }`}
          >
            <Eye className="w-4 h-4" />
            {showPreview ? "Hide Preview" : "Show Preview"}
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl ${
          message.type === "success" ? "bg-green-50 text-green-600 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          <div className="flex border-b border-border overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary border-b-2 border-primary"
                    : "text-secondary hover:text-foreground"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground">
                {tabs.find(t => t.id === activeTab)?.label}
              </h2>
            </div>

            {renderTabContent()}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 mt-8"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
        
        {mounted && showPreview && (
          <div className="bg-surface rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Live Preview</h2>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Download className="w-4 h-4" />
                Print / PDF
              </button>
            </div>
            <div className="bg-white rounded-lg overflow-auto max-h-[600px] flex justify-center border border-border">
              <InvoiceRenderer
                data={{
                  invoiceId: sampleInvoiceData.invoiceId,
                  date: sampleInvoiceData.date,
                  items: sampleInvoiceData.items,
                  customer: sampleInvoiceData.customer,
                  cashier: sampleInvoiceData.cashier,
                  subtotal: sampleInvoiceData.subtotal,
                  discount: sampleInvoiceData.discount,
                  tax: sampleInvoiceData.tax,
                  total: sampleInvoiceData.total,
                  paid: sampleInvoiceData.paid,
                  due: sampleInvoiceData.due,
                  paymentMethod: sampleInvoiceData.paymentMethod,
                  store: {
                    name: general.businessName || "My Store",
                    address: general.address || "123 Main Street",
                    phone: general.phone || "01700-000000",
                  },
                }}
                settings={previewConfig}
                mode="preview"
              />
            </div>
            <div className="hidden print:block print:bg-white print:p-4">
              <InvoiceRenderer
                data={{
                  invoiceId: sampleInvoiceData.invoiceId,
                  date: sampleInvoiceData.date,
                  items: sampleInvoiceData.items,
                  customer: sampleInvoiceData.customer,
                  cashier: sampleInvoiceData.cashier,
                  subtotal: sampleInvoiceData.subtotal,
                  discount: sampleInvoiceData.discount,
                  tax: sampleInvoiceData.tax,
                  total: sampleInvoiceData.total,
                  paid: sampleInvoiceData.paid,
                  due: sampleInvoiceData.due,
                  paymentMethod: sampleInvoiceData.paymentMethod,
                  store: {
                    name: general.businessName || "My Store",
                    address: general.address || "123 Main Street",
                    phone: general.phone || "01700-000000",
                  },
                }}
                settings={previewConfig}
                mode="print"
              />
            </div>
            <p className="text-xs text-secondary mt-4 text-center">
              This preview updates automatically as you change settings
            </p>
          </div>
        )}
      </div>
    </div>
  );
}