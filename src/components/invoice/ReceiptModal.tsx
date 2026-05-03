"use client";

import { X, Printer, CheckCircle2 } from "lucide-react";
import { InvoiceRenderer } from "./InvoiceRenderer";
import { InvoiceSettings, InvoiceData } from "./invoice-types";

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  settings: Partial<InvoiceSettings> | null;
}

export function ReceiptModal({ isOpen, onClose, data, settings }: ReceiptModalProps) {
  if (!isOpen || !data) return null;

  const subtotal = Number(data.totalAmount) + (Number(data.discount) || 0);
  
  // Robust customer mapping
  const customerName = data.customerName || data.customer?.name;
  const customerPhone = data.customerPhone || data.customer?.phone;
  const customer = (customerName || customerPhone) 
    ? { name: customerName || "Walking Customer", phone: customerPhone || "" } 
    : undefined;

  const invoiceData: InvoiceData = {
    invoiceId: data.invoiceId,
    date: data.createdAt,
    items: (data.items || []).map((item: any) => ({
      name: item.product?.name || item.name || "Unknown Product",
      quantity: item.quantity,
      price: item.price,
      imeis: Array.isArray(item.imeis) ? item.imeis.map((i: any) => typeof i === 'string' ? i : i.imei) : [],
      sku: item.product?.sku || item.sku || "",
      warranty: item.product?.warranty || item.warranty || "",
      discount: item.discount || 0,
    })),
    customer,
    subtotal,
    discount: Number(data.discount) || 0,
    total: Number(data.totalAmount),
    paid: Number(data.paidAmount),
    due: Number(data.dueAmount),
    paymentMethod: (data.payments?.[0]?.method) || data.paymentMethod || "CASH",
    store: {
      name: settings?.general?.businessName || data.store?.name || "Store",
      address: settings?.general?.address || data.store?.address || "",
      phone: settings?.general?.phone || data.store?.phone || "",
    },
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-surface w-full max-w-4xl rounded-[2.5rem] overflow-hidden card-shadow flex flex-col md:flex-row animate-in zoom-in-95 duration-200 h-[90vh]">
        {/* Left Side: Success Message & Actions */}
        <div className="flex-1 p-10 flex flex-col justify-center items-center text-center space-y-8 bg-primary/5">
          <div className="w-24 h-24 bg-green-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-green-500/20 animate-bounce">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <div className="space-y-2">
            <h2 className="text-4xl font-black tracking-tight">Sale Completed!</h2>
            <p className="text-secondary font-medium text-lg">Invoice #{data.invoiceId} generated successfully</p>
          </div>
          
          <div className="grid grid-cols-1 gap-4 w-full max-w-xs pt-4">
            <button 
              onClick={() => window.print()}
              className="flex items-center justify-center gap-3 py-5 bg-primary text-white rounded-2xl font-black text-xl shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <Printer className="w-6 h-6" />
              Print Invoice
            </button>
            <button 
              onClick={onClose}
              className="flex items-center justify-center gap-3 py-5 bg-white border-2 border-border text-secondary rounded-2xl font-black text-xl hover:bg-surface transition-all"
            >
              Done & Close
            </button>
          </div>
        </div>

        {/* Right Side: Invoice Preview */}
        <div className="flex-1 bg-white p-8 overflow-y-auto border-l border-border flex justify-center">
          <div className="w-full max-w-md">
            <div className="mb-6 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-sm py-2 z-10 border-b border-border">
              <span className="text-xs font-black text-secondary uppercase tracking-widest">Live Preview</span>
              <button onClick={onClose} className="text-secondary hover:text-foreground">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <InvoiceRenderer
              data={invoiceData}
              settings={settings || {}}
              mode="preview"
            />
            
            {/* Hidden Print Version */}
            <div id="printable-receipt" className="hidden print:block">
              <InvoiceRenderer
                data={invoiceData}
                settings={settings || {}}
                mode="print"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
