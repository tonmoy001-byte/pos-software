"use client";

import { useState, useEffect } from "react";
import { 
  InvoiceData, 
  InvoiceSettings, 
  InvoiceMode,
  defaultInvoiceSettings 
} from "./invoice-types";
import { 
  formatCurrency, 
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

  const { 
    isA4, 
    width, 
    fontSizeClass, 
    paddingClass, 
    headerClass, 
    headerTextClass, 
    detailTextClass 
  } = getInvoiceConfig(cfg);

  const general = cfg.general;
  const layout = cfg.layout;
  const products = cfg.products;
  const payment = cfg.payment;
  const footer = cfg.footer;
  const print = cfg.print;

  const showInPreview = mode === "preview" || mode === "a4" || isA4;
  const showInPrint = mode === "print" || mode === "thermal" || !isA4;

  return (
    <div 
      className={`invoice-renderer bg-white text-black font-mono mx-auto ${
        mode === "preview" ? "print:hidden" : "print:block"
      } ${showInPreview ? '' : 'hidden'}`}
      style={{ width, maxWidth: isA4 ? '210mm' : undefined }}
    >
      {(mode === "print" || mode === "thermal" || mode === "a4") && (
        <style jsx global>{`
          @media print {
            body * { visibility: hidden; }
            .invoice-renderer, .invoice-renderer * { visibility: visible; }
            .invoice-renderer { position: absolute; left: 0; top: 0; width: ${width}; }
            @page { size: ${isA4 ? 'A4' : width} auto; margin: 0; }
          }
        `}</style>
      )}

      <div className={paddingClass}>
        {(layout.showLogo !== false && general.logoUrl) && (
          <div className="text-center mb-3">
            <img src={general.logoUrl} alt="Logo" className="max-h-16 mx-auto" />
          </div>
        )}

        <div className={`text-center ${headerClass}`}>
          <h1 className={`font-bold uppercase ${headerTextClass}`}>
            {general.businessName || data.store.name || "Store"}
          </h1>
          {(layout.showAddress !== false && (general.address || data.store.address)) && (
            <p className={detailTextClass}>{general.address || data.store.address}</p>
          )}
          {(layout.showPhone !== false && (general.phone || data.store.phone)) && (
            <p className={detailTextClass}>{general.phone || data.store.phone}</p>
          )}
        </div>

        <div className={`border-t border-b border-dashed border-gray-600 py-1.5 mb-3 ${isA4 ? 'text-sm py-3' : ''} ${detailTextClass}`}>
          {(layout.showInvoiceNumber !== false) && (
            <div className="flex justify-between">
              <span>{general.title || "INV"}:</span>
              <span className="font-bold">{data.invoiceId}</span>
            </div>
          )}
          {(layout.showDate !== false) && isClient && data.date && (
            <div className="flex justify-between">
              <span>Date:</span>
              <span>{formattedDate}</span>
            </div>
          )}
          {(layout.showTime !== false) && isClient && data.date && (
            <div className="flex justify-between">
              <span>Time:</span>
              <span>{formattedTime}</span>
            </div>
          )}
          {(layout.showCustomer !== false && data.customer?.name) && (
            <>
              <div className="flex justify-between">
                <span>Cust:</span>
                <span>{data.customer.name}</span>
              </div>
              {data.customer.phone && (
                <div className="flex justify-between">
                  <span>Phone:</span>
                  <span>{data.customer.phone}</span>
                </div>
              )}
            </>
          )}
          {(layout.showCashier === true && data.cashier) && (
            <div className="flex justify-between">
              <span>Cashier:</span>
              <span>{data.cashier}</span>
            </div>
          )}
        </div>

        <div className={`space-y-1 mb-3 ${isA4 ? 'text-sm' : ''}`}>
          <div className={`grid grid-cols-12 font-bold ${isA4 ? 'text-xs' : 'text-[9px]'} border-b border-gray-600 pb-1`}>
            <div className="col-span-6">Item</div>
            <div className="col-span-2 text-center">Qty</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-2 text-right">Total</div>
          </div>
          {data.items.map((item, idx) => (
            <div key={idx} className="space-y-0.5">
              <div className={`grid grid-cols-12 ${fontSizeClass}`}>
                <div className="col-span-6 font-medium truncate">{item.name}</div>
                <div className="col-span-2 text-center">{safeNumber(item.quantity)}</div>
                <div className="col-span-2 text-right">{formatCurrency(item.price)}</div>
                <div className="col-span-2 text-right font-medium">
                  {formatCurrency(safeNumber(item.price) * safeNumber(item.quantity))}
                </div>
              </div>
              {(products.showSku === true && item.sku) && (
                <div className="text-[8px] text-gray-500">SKU: {item.sku}</div>
              )}
              {(products.showImei !== false && item.imeis && item.imeis.length > 0) && isClient && (
                <div className="text-[8px] text-gray-500">
                  IMEI: {item.imeis.slice(0, products.maxImeiDisplay || 2).join(", ")}
                  {item.imeis.length > (products.maxImeiDisplay || 2) && 
                    ` +${item.imeis.length - (products.maxImeiDisplay || 2)}`}
                </div>
              )}
              {(products.showDiscount !== false && item.discount && safeNumber(item.discount) > 0) && (
                <div className="text-[8px] text-gray-500">Disc: -{formatCurrency(item.discount)}</div>
              )}
              {(products.showWarranty !== false && item.warranty) && (
                <div className="text-[8px] text-gray-500">{item.warranty}</div>
              )}
            </div>
          ))}
        </div>

        <div className={`border-t border-dashed border-gray-600 pt-1.5 ${isA4 ? 'text-sm py-2' : ''} ${detailTextClass}`}>
          {(payment.showSubtotal !== false) && (
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatCurrency(data.subtotal)}</span>
            </div>
          )}
          {(payment.showDiscount !== false && safeNumber(data.discount) > 0) && (
            <div className="flex justify-between">
              <span>Discount:</span>
              <span>-{formatCurrency(data.discount)}</span>
            </div>
          )}
          {(payment.showTax === true && safeNumber(data.tax) > 0) && (
            <div className="flex justify-between">
              <span>{payment.taxLabel || data.taxLabel || "VAT"}:</span>
              <span>{formatCurrency(data.tax)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold border-t border-gray-600 pt-1">
            <span>TOTAL:</span>
            <span>{formatCurrency(data.total)}</span>
          </div>
          {(payment.showPaid !== false) && (
            <div className="flex justify-between">
              <span>Paid:</span>
              <span>{formatCurrency(data.paid)}</span>
            </div>
          )}
          {(payment.showDue !== false && safeNumber(data.due) > 0) && (
            <div className="flex justify-between">
              <span>Due:</span>
              <span>{formatCurrency(data.due)}</span>
            </div>
          )}
          {(payment.showPaymentMethod !== false && data.paymentMethod) && (
            <div className="flex justify-between">
              <span>Method:</span>
              <span>{data.paymentMethod}</span>
            </div>
          )}
        </div>

        {(footer.showPolicies !== false) && (
          <div className={`mt-3 text-center ${isA4 ? 'text-sm' : 'text-[9px]'} space-y-0.5`}>
            {footer.thankYouMessage && <p className="font-medium">{footer.thankYouMessage}</p>}
            {footer.returnPolicy && <p>{footer.returnPolicy}</p>}
            {footer.warrantyPolicy && <p>{footer.warrantyPolicy}</p>}
          </div>
        )}

        <div className={`mt-3 text-center ${isA4 ? 'text-xs' : 'text-[8px]'} text-gray-400`}>
          {general.website || "Powered by RetailOS"}
        </div>
      </div>
    </div>
  );
}

export default InvoiceRenderer;