"use client";

import { useEffect, useRef, forwardRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeLabelProps {
  value: string;
  type?: "CODE128" | "EAN13" | "CODE39" | "QR";
  showText?: boolean;
  width?: number;
  height?: number;
  fontSize?: number;
}

export const BarcodeGenerator = forwardRef<SVGSVGElement, BarcodeLabelProps>(
  ({ value, type = "CODE128", showText = true, width = 2, height = 50, fontSize = 12 }, ref) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
      if (svgRef.current && value) {
        try {
          JsBarcode(svgRef.current, value, {
            format: type === "QR" ? "QR" : type,
            width: width,
            height: height,
            displayValue: showText,
            fontSize: fontSize,
            margin: 5,
            background: "transparent",
            lineColor: "#000",
          });
        } catch (err) {
          console.error("Barcode generation error:", err);
        }
      }
    }, [value, type, showText, width, height, fontSize]);

    return <svg ref={svgRef}></svg>;
  }
);

BarcodeGenerator.displayName = "BarcodeGenerator";

interface LabelPreviewProps {
  productName?: string;
  price?: string;
  sku?: string;
  imei?: string;
  barcodeValue: string;
  settings: {
    barcodeType: string;
    showProductName: boolean;
    showPrice: boolean;
    showSku: boolean;
    showImei: boolean;
    showBarcode: boolean;
    includeCurrency: boolean;
    fontSize: number;
    labelWidth: number;
    labelHeight: number;
  };
}

export function BarcodeLabelPreview({
  productName,
  price,
  sku,
  imei,
  barcodeValue,
  settings
}: LabelPreviewProps) {
  const labelWidth = settings.labelWidth || 50;
  const labelHeight = settings.labelHeight || 25;
  const fontSize = settings.fontSize || 10;

  return (
    <div
      className="bg-white border border-gray-200 rounded p-2"
      style={{
        width: `${labelWidth}mm`,
        minHeight: `${labelHeight}mm`,
        fontSize: `${fontSize}px`,
      }}
    >
      {settings.showProductName && productName && (
        <div className="font-bold text-center truncate">{productName}</div>
      )}
      {settings.showPrice && price && (
        <div className="text-center font-bold text-primary">
          {settings.includeCurrency ? "৳" : ""}{price}
        </div>
      )}
      {(settings.showSku || settings.showImei) && (
        <div className="text-center text-xs text-gray-600">
          {settings.showSku && sku && <span>{sku}</span>}
          {settings.showSku && settings.showImei && sku && imei && <span> | </span>}
          {settings.showImei && imei && <span>{imei}</span>}
        </div>
      )}
      {settings.showBarcode && (
        <div className="flex justify-center">
          <BarcodeGenerator
            value={barcodeValue}
            type={settings.barcodeType as any}
            showText={false}
            height={30}
            fontSize={fontSize}
          />
        </div>
      )}
    </div>
  );
}