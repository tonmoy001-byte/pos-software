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
    compactMode?: boolean;
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
  const labelWidth = settings.labelWidth || 38;
  const labelHeight = settings.labelHeight || 25;
  const baseFontSize = settings.fontSize || 8;
  const compactMode = settings.compactMode ?? true;
  
  const isCompact = compactMode || labelWidth <= 40;
  const padding = isCompact ? "1mm" : "2mm";
  const barcodeHeight = isCompact ? 18 : 30;
  const lineHeight = isCompact ? 1.0 : 1.2;
  const gap = isCompact ? "0.3mm" : "1mm";

  return (
    <div
      className="bg-white"
      style={{
        width: `${labelWidth}mm`,
        minHeight: `${labelHeight}mm`,
        maxHeight: `${labelHeight}mm`,
        fontSize: `${baseFontSize}px`,
        lineHeight: lineHeight,
        padding: padding,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: gap,
        overflow: "hidden",
      }}
    >
      {settings.showProductName && productName && (
        <div className="font-bold text-center truncate" style={{ fontSize: `${baseFontSize}px` }}>
          {productName}
        </div>
      )}
      {settings.showPrice && price && (
        <div className="text-center font-bold text-primary" style={{ fontSize: `${baseFontSize + 1}px` }}>
          {settings.includeCurrency ? "৳" : ""}{price}
        </div>
      )}
      {(settings.showSku || settings.showImei) && (
        <div className="text-center" style={{ fontSize: `${baseFontSize - 1}px` }}>
          {settings.showSku && sku && <span>{sku}</span>}
          {settings.showSku && settings.showImei && sku && imei && <span> | </span>}
          {settings.showImei && imei && <span>{imei}</span>}
        </div>
      )}
      {settings.showBarcode && (
        <div className="flex justify-center items-center" style={{ marginTop: isCompact ? "0.2mm" : "0" }}>
          <BarcodeGenerator
            value={barcodeValue}
            type={settings.barcodeType as any}
            showText={false}
            width={isCompact ? 1 : 1.5}
            height={barcodeHeight}
            fontSize={baseFontSize}
          />
        </div>
      )}
    </div>
  );
}