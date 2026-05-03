export function generateBarcode(): string {
  const prefix = "DNX";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

export function generateProductBarcode(productId: string): string {
  const prefix = "PRD";
  const shortId = productId.substring(0, 8).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}${shortId}${random}`;
}

export function validateBarcode(barcode: string): boolean {
  if (!barcode || barcode.length < 8) return false;
  const validPrefixes = ["DNX", "PRD", "INV"];
  return validPrefixes.some(p => barcode.startsWith(p));
}

export function formatBarcodeForDisplay(barcode: string): string {
  if (!barcode) return "";
  if (barcode.length <= 12) return barcode;
  
  const parts: string[] = [];
  for (let i = 0; i < barcode.length; i += 4) {
    parts.push(barcode.substring(i, i + 4));
  }
  return parts.join(" ");
}

export function generateInvoiceId(prefix: string, sequence: number): string {
  const paddedSequence = String(sequence).padStart(6, '0');
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${prefix}-${year}${month}${paddedSequence}`;
}