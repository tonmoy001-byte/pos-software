import { InvoiceSettings, defaultInvoiceSettings, InvoiceData } from "./invoice-types";

export const formatCurrency = (value: unknown): string => {
  const num = Number(value || 0);
  if (isNaN(num)) {
    return "0";
  }
  // Format with commas and no decimal for cleaner display
  return Math.round(num).toLocaleString("en-BD");
};

export const formatCurrencyWithDecimal = (value: unknown): string => {
  const num = Number(value || 0);
  if (isNaN(num)) {
    return "৳0";
  }
  // Format with comma separators
  return "৳" + Math.round(num).toLocaleString("en-BD");
};

export const safeNumber = (value: unknown): number => {
  const num = Number(value || 0);
  return isNaN(num) ? 0 : num;
};

export const formatDate = (dateStr: string): string => {
  if (typeof window === 'undefined') return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", { 
    day: "2-digit", 
    month: "2-digit", 
    year: "2-digit" 
  });
};

export const formatTime = (dateStr: string): string => {
  if (typeof window === 'undefined') return '';
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-GB", { 
    hour: "2-digit", 
    minute: "2-digit" 
  });
};

export const getPaperWidth = (paperSize: string): string => {
  switch (paperSize) {
    case "58mm":
      return "58mm";
    case "A4":
      return "210mm";
    case "80mm":
    default:
      return "80mm";
  }
};

export const getFontSizeClass = (fontSize: string, isA4: boolean): string => {
  if (isA4) return "text-sm";
  switch (fontSize) {
    case "small":
      return "text-[10px]";
    case "large":
      return "text-[14px]";
    default:
      return "text-xs";
  }
};

export const getPaddingClass = (isA4: boolean): string => {
  return isA4 ? "p-6" : "p-2";
};

export const mergeInvoiceSettings = (
  stored: Partial<InvoiceSettings> | null
): InvoiceSettings => {
  if (!stored) {
    return defaultInvoiceSettings;
  }
  
  return {
    general: { ...defaultInvoiceSettings.general, ...stored.general },
    layout: { ...defaultInvoiceSettings.layout, ...stored.layout },
    products: { ...defaultInvoiceSettings.products, ...stored.products },
    payment: { ...defaultInvoiceSettings.payment, ...stored.payment },
    footer: { ...defaultInvoiceSettings.footer, ...stored.footer },
    print: { ...defaultInvoiceSettings.print, ...stored.print },
  };
};

export const getInvoiceConfig = (settings: InvoiceSettings) => {
  const print = settings.print || {};
  const paperSize = print.paperSize || "80mm";
  const isA4 = paperSize === "A4";
  
  return {
    paperSize,
    isA4,
    width: getPaperWidth(paperSize),
    fontSize: print.fontSize || "normal",
    fontSizeClass: getFontSizeClass(print.fontSize || "normal", isA4),
    paddingClass: getPaddingClass(isA4),
    headerClass: isA4 ? "space-y-2 mb-6" : "space-y-0.5 mb-3",
    headerTextClass: isA4 ? "text-lg" : "text-base",
    detailTextClass: isA4 ? "text-sm" : "text-[10px]",
  };
};

export const calculateInvoiceTotals = (data: InvoiceData) => {
  const subtotal = data.items.reduce((sum, item) => {
    return sum + safeNumber(item.price) * safeNumber(item.quantity);
  }, 0);
  
  const totalDiscount = data.items.reduce((sum, item) => {
    return sum + safeNumber(item.discount);
  }, 0) + safeNumber(data.discount);
  
  const tax = safeNumber(data.tax);
  const total = safeNumber(data.total);
  const paid = safeNumber(data.paid);
  const due = safeNumber(data.due);
  
  return {
    subtotal,
    totalDiscount,
    tax,
    total,
    paid,
    due,
  };
};