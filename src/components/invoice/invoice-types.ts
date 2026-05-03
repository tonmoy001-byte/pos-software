export interface InvoiceItem {
  name: string;
  sku?: string;
  quantity: number | string;
  price: number | string;
  discount?: number | string;
  imeis?: string[];
  warranty?: string;
}

export interface InvoiceCustomer {
  name: string;
  phone?: string;
}

export interface InvoiceStore {
  name: string;
  address?: string | null;
  phone?: string | null;
}

export interface InvoiceGeneralSettings {
  businessName?: string;
  address?: string;
  phone?: string;
  website?: string;
  title?: string;
  logoUrl?: string;
}

export interface InvoiceLayoutSettings {
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

export interface InvoiceProductSettings {
  showSku?: boolean;
  showImei?: boolean;
  showWarranty?: boolean;
  showDiscount?: boolean;
  maxImeiDisplay?: number;
}

export interface InvoicePaymentSettings {
  showSubtotal?: boolean;
  showDiscount?: boolean;
  showTax?: boolean;
  taxLabel?: string;
  taxRate?: number;
  showPaid?: boolean;
  showDue?: boolean;
  showPaymentMethod?: boolean;
}

export interface InvoiceFooterSettings {
  thankYouMessage?: string;
  returnPolicy?: string;
  warrantyPolicy?: string;
  showPolicies?: boolean;
}

export interface InvoicePrintSettings {
  paperSize?: string;
  fontSize?: string;
  autoPrint?: boolean;
  cutAfterPrint?: boolean;
}

export interface InvoiceSettings {
  general: InvoiceGeneralSettings;
  layout: InvoiceLayoutSettings;
  products: InvoiceProductSettings;
  payment: InvoicePaymentSettings;
  footer: InvoiceFooterSettings;
  print: InvoicePrintSettings;
}

export interface InvoiceData {
  invoiceId: string;
  date?: string;
  items: InvoiceItem[];
  customer?: InvoiceCustomer;
  cashier?: string;
  subtotal: number;
  discount?: number;
  tax?: number;
  taxLabel?: string;
  total: number;
  paid?: number;
  due?: number;
  paymentMethod?: string;
  store: InvoiceStore;
}

export type InvoiceMode = "preview" | "print" | "thermal" | "a4";

export const defaultInvoiceSettings: InvoiceSettings = {
  general: {
    businessName: "",
    address: "",
    phone: "",
    website: "",
    title: "INVOICE",
    logoUrl: "",
  },
  layout: {
    showLogo: true,
    showAddress: true,
    showPhone: true,
    showWebsite: false,
    showDate: true,
    showTime: true,
    showInvoiceNumber: true,
    showCustomer: true,
    showCashier: false,
  },
  products: {
    showSku: false,
    showImei: true,
    showWarranty: true,
    showDiscount: true,
    maxImeiDisplay: 2,
  },
  payment: {
    showSubtotal: true,
    showDiscount: true,
    showTax: false,
    taxLabel: "VAT",
    taxRate: 0,
    showPaid: true,
    showDue: true,
    showPaymentMethod: true,
  },
  footer: {
    thankYouMessage: "Thank you for shopping with us!",
    returnPolicy: "",
    warrantyPolicy: "",
    showPolicies: true,
  },
  print: {
    paperSize: "80mm",
    fontSize: "normal",
    autoPrint: false,
    cutAfterPrint: true,
  },
};