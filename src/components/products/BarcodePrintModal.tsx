"use client";

import { useState, useEffect, useRef, forwardRef } from "react";
import { X, Printer } from "lucide-react";
import { Button } from "@/components/ui";
import { BarcodeLabelPreview } from "@/components/barcode/barcode-label";

interface BarcodePrintModalProps {
  product: any;
  onClose: () => void;
}

const Barcode = forwardRef<SVGSVGElement, { value: string }>(({ value }, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (svgRef.current && value) {
      import("jsbarcode").then((JsBarcode) => {
        JsBarcode.default(svgRef.current, value, {
          format: "CODE128", width: 1.5, height: 40, displayValue: true,
          font: "monospace", fontSize: 14, margin: 5,
        });
      });
    }
  }, [value]);
  return <svg ref={(node) => { svgRef.current = node; if (typeof ref === 'function') ref(node); else if (ref) ref.current = node; }} />;
});
Barcode.displayName = "Barcode";

export function BarcodePrintModal({ product, onClose }: BarcodePrintModalProps) {
  const [quantity, setQuantity] = useState(product?.items?.length || 1);
  const [settings] = useState({
    barcodeType: "CODE128", showProductName: true, showPrice: true, showSku: true,
    showImei: true, showBarcode: true, includeCurrency: true, fontSize: 8,
    labelWidth: 38, labelHeight: 25, compactMode: true,
  });

  const handlePrint = async () => {
    const printArea = document.getElementById("barcode-print-area-products");
    if (!printArea) return;
    printArea.style.display = "block";
    await new Promise((r) => setTimeout(r, 300));
    window.print();
    printArea.style.display = "none";
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
      <div className="bg-surface w-full max-w-2xl rounded-3xl p-8 space-y-6 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Print Barcode Labels</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="text-center mb-4">
          <p className="font-bold">{product.name}</p>
          <p className="text-sm text-secondary">{product.barcode}</p>
        </div>
        <div className="flex items-center justify-center gap-4 mb-6 p-4 bg-background rounded-xl">
          <label className="text-sm font-bold text-secondary">Labels:</label>
          <div className="flex items-center gap-3">
            <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 flex items-center justify-center bg-surface border-2 border-border rounded-xl hover:border-primary font-bold text-lg">-</button>
            <span className="w-16 text-center font-bold text-xl bg-surface py-2 rounded-xl border-2 border-border">{quantity}</span>
            <button onClick={() => setQuantity(Math.min(100, quantity + 1))} className="w-10 h-10 flex items-center justify-center bg-surface border-2 border-border rounded-xl hover:border-primary font-bold text-lg">+</button>
          </div>
          <button onClick={() => setQuantity(1)} className="text-xs text-secondary hover:text-primary underline ml-2">Reset</button>
        </div>
        <div id="barcode-print-area-products" style={{ display: "none", position: "absolute", left: 0, top: 0, width: `${settings.labelWidth}mm` }}>
          {Array.from({ length: quantity }).map((_, idx) => {
            const item = product?.items?.[idx % (product?.items?.length || 1)];
            return (
              <div key={idx} style={{ width: "100%", height: `${settings.labelHeight}mm`, padding: "2mm", boxSizing: "border-box", pageBreakInside: "avoid" }}>
                <BarcodeLabelPreview
                  productName={settings.showProductName ? product.name : undefined}
                  price={settings.showPrice ? product.price : undefined}
                  sku={settings.showSku ? product.barcode : undefined}
                  barcodeValue={item?.barcode || item?.imei || product.barcode || product.id}
                  settings={settings}
                />
              </div>
            );
          })}
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fill, ${settings.labelWidth}mm)` }}>
          {Array.from({ length: Math.min(quantity, 6) }).map((_, idx) => {
            const item = product?.items?.[idx % (product?.items?.length || 1)];
            return (
              <div key={idx} className="border border-border p-1 bg-white flex justify-center">
                <BarcodeLabelPreview
                  productName={settings.showProductName ? product.name : undefined}
                  price={settings.showPrice ? product.price : undefined}
                  sku={settings.showSku ? product.barcode : undefined}
                  barcodeValue={item?.barcode || item?.imei || product.barcode || product.id}
                  settings={settings}
                />
              </div>
            );
          })}
        </div>
        {quantity > 6 && <p className="text-xs text-secondary text-center">+ {quantity - 6} more labels (visible when printing)</p>}
        <div className="flex gap-4">
          <Button className="flex-1" onClick={handlePrint}><Printer className="w-5 h-5" /> Print</Button>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
