export interface InvoiceConfig {
  prefix?: string;
  nextNumber?: number;
  minDigits?: number;
  separator?: string;
  title?: string;
  subtitle?: string;
  currencySymbol?: string;
  dateFormat?: string;
  footer?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  logoPosition?: string;
  storeInfoPosition?: string;
  datePosition?: string;
  showQRCode?: boolean;
  showSerial?: boolean;
  showHsn?: boolean;
  showBatch?: boolean;
  showUnit?: boolean;
  showDiscount?: boolean;
  showTax?: boolean;
  taxLabel?: string;
  showDiscountSummary?: boolean;
  roundDecimals?: number;
  field1Label?: string;
  field1Value?: string;
  field2Label?: string;
  field2Value?: string;
  paperSize?: string;
  orientation?: string;
  autoPrint?: boolean;
}

export function formatDate(date: Date, format: string = "yyyy-MM-dd"): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return format
    .replace("yyyy", String(year))
    .replace("MM", month)
    .replace("dd", day)
    .replace("MMM", monthNames[d.getMonth()]);
}

export function formatCurrency(value: number, symbol: string = "$", decimals: number = 2): string {
  return `${symbol}${value.toFixed(decimals)}`;
}