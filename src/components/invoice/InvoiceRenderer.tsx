"use client";

import { useState, useEffect } from "react";
import { 
  InvoiceData, 
  InvoiceSettings, 
  InvoiceMode,
  defaultInvoiceSettings 
} from "./invoice-types";
import { 
  formatCurrencyWithDecimal, 
  safeNumber, 
  formatDate, 
  formatTime,
  getInvoiceConfig 
} from "./invoice-utils";

interface InvoiceRendererProps {
  data: InvoiceData;
  settings?: Partial<InvoiceSettings>;
  mode?: InvoiceMode;
  showPrintStyles?: boolean;
}

export function InvoiceRenderer({
  data,
  settings,
  mode = "print",
}: InvoiceRendererProps) {
  const [isClient, setIsClient] = useState(false);
  const [formattedTime, setFormattedTime] = useState("");
  const [formattedDate, setFormattedDate] = useState("");

  useEffect(() => {
    setIsClient(true);
    if (data.date) {
      setFormattedTime(formatTime(data.date));
      setFormattedDate(formatDate(data.date));
    }
  }, [data.date]);

  const cfg = settings ? {
    general: { ...defaultInvoiceSettings.general, ...settings.general },
    layout: { ...defaultInvoiceSettings.layout, ...settings.layout },
    products: { ...defaultInvoiceSettings.products, ...settings.products },
    payment: { ...defaultInvoiceSettings.payment, ...settings.payment },
    footer: { ...defaultInvoiceSettings.footer, ...settings.footer },
    print: { ...defaultInvoiceSettings.print, ...settings.print },
  } : defaultInvoiceSettings;

  const { isA4 } = getInvoiceConfig(cfg);

  const general = cfg.general;
  const layout = cfg.layout;
  const products = cfg.products;
  const payment = cfg.payment;
  const footer = cfg.footer;

  const showInPreview = mode === "preview" || mode === "a4" || isA4;
  const showInPrint = mode === "print" || mode === "thermal" || !isA4;

  // Helper to format currency
  const formatPrice = (value: unknown): string => {
    return formatCurrencyWithDecimal(value);
  };

  // Calculate line total
  const getLineTotal = (item: any): number => {
    return safeNumber(item.price) * safeNumber(item.quantity);
  };

  return (
    <div 
      className={`invoice-renderer bg-white text-gray-800 ${
        mode === "preview" ? "print:hidden" : "print:block"
      }`}
      style={{ maxWidth: '400px', margin: '0 auto' }}
    >
      {(mode === "print" || mode === "thermal" || mode === "a4") && (
        <style jsx global>{`
          @media print {
            body * { visibility: hidden; }
            .invoice-renderer, .invoice-renderer * { visibility: visible; }
            .invoice-renderer { position: absolute; left: 0; top: 0; }
            @page { size: auto; margin: 0; }
          }
        `}</style>
      )}

      <div className="p-4 rounded-2xl shadow-sm border border-gray-200">
        {/* Header - Centered */}
        <div className="text-center border-b pb-3 mb-3">
          <h1 className="text-lg font-semibold uppercase">
            {general.businessName || data.store?.name || "STORE"}
          </h1>
          <p className="text-xs text-gray-500">
            {general.address || data.store?.address || ""}
          </p>
          <p className="text-xs text-gray-500">
            Ph: {general.phone || data.store?.phone || ""}
          </p>
        </div>

        {/* Invoice Info - Left Aligned */}
        <div className="mb-3 text-xs">
          <p>
            <span className="font-medium">Invoice:</span> {data.invoiceId}
          </p>
          {(layout.showDate !== false) && isClient && data.date && (
            <p><span className="font-medium">Date:</span> {formattedDate}</p>
          )}
          {(layout.showCustomer !== false && data.customer?.name) && (
            <p><span className="font-medium">Customer:</span> {data.customer.name}</p>
          )}
        </div>

        {/* Items Header */}
        <div className="grid grid-cols-4 text-xs font-medium border-b pb-1.5 mb-1.5">
          <span>Item</span>
          <span className="text-center">Qty</span>
          <span className="text-right">Price</span>
          <span className="text-right">Total</span>
        </div>

        {/* Items List */}
        <div className="mb-3">
          {data.items && data.items.length > 0 ? (
            data.items.map((item: any, idx: number) => (
              <div key={idx} className="grid grid-cols-4 text-xs py-1">
                <span>{item.name || "Unknown"}</span>
                <span className="text-center">{safeNumber(item.quantity)}</span>
                <span className="text-right">{formatPrice(item.price)}</span>
                <span className="text-right">{formatPrice(getLineTotal(item))}</span>
              </div>
            ))
          ) : (
            <div className="text-xs text-center text-gray-400 py-2">No items</div>
          )}
        </div>

        {/* Totals Section */}
        <div className="border-t pt-3 text-xs space-y-1">
          {(payment.showSubtotal !== false) && (
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatPrice(data.subtotal)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatPrice(data.total)}</span>
          </div>
          {(payment.showPaid !== false) && (
            <div className="flex justify-between">
              <span>Paid</span>
              <span>{formatPrice(data.paid)}</span>
            </div>
          )}
          {(payment.showDue !== false && safeNumber(data.due) > 0) && (
            <div className="flex justify-between text-red-500 font-medium">
              <span>Due</span>
              <span>{formatPrice(data.due)}</span>
            </div>
          )}
        </div>

        {/* Footer - Simple Thank You */}
        <div className="text-center text-xs text-gray-400 mt-4">
          {footer.thankYouMessage || "Thank you for shopping with us!"}
        </div>
      </div>
    </div>
  );
}