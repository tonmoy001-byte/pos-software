"use client";

import { useState, useEffect } from "react";
import { Save, Barcode, Ruler, Type, DollarSign, Package, QrCode, Shield, Check } from "lucide-react";

interface BarcodeSettings {
  barcodeType: string;
  labelWidth: number;
  labelHeight: number;
  labelSizeName: string;
  showProductName: boolean;
  showPrice: boolean;
  showSku: boolean;
  showImei: boolean;
  showBarcode: boolean;
  showQrCode: boolean;
  showWarranty: boolean;
  includeCurrency: boolean;
  fontSize: number;
}

const BARCODE_TYPES = [
  { value: "CODE128", label: "CODE128", description: "Default, supports alphanumeric" },
  { value: "EAN13", label: "EAN-13", description: "13 digit international" },
  { value: "CODE39", label: "CODE39", description: "Legacy barcode type" },
  { value: "QR", label: "QR Code", description: "2D barcode with more data" },
];

const LABEL_SIZES = [
  { width: 40, height: 20, name: "40x20mm" },
  { width: 50, height: 25, name: "50x25mm" },
  { width: 70, height: 35, name: "70x35mm" },
  { width: 80, height: 50, name: "80x50mm" },
];

export default function BarcodeSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<BarcodeSettings>({
    barcodeType: "CODE128",
    labelWidth: 50,
    labelHeight: 25,
    labelSizeName: "50x25mm",
    showProductName: true,
    showPrice: true,
    showSku: true,
    showImei: true,
    showBarcode: true,
    showQrCode: false,
    showWarranty: false,
    includeCurrency: true,
    fontSize: 10,
  });

  useEffect(() => {
    fetch("/api/barcode-settings")
      .then(res => res.json())
      .then(data => {
        setSettings({ ...settings, ...data });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/barcode-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save:", err);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-foreground">Barcode Settings</h1>
            <p className="text-secondary mt-1">Configure barcode generation and label printing</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
              saved
                ? "bg-green-500 text-white"
                : "bg-primary text-white hover:bg-primary/90"
            }`}
          >
            {saved ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />}
            {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
          </button>
        </div>

        <div className="space-y-6">
          {/* Barcode Type */}
          <div className="bg-surface rounded-2xl border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Barcode className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Barcode Type</h2>
                <p className="text-sm text-secondary">Select the barcode format</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {BARCODE_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setSettings({ ...settings, barcodeType: type.value })}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    settings.barcodeType === type.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="font-bold text-sm">{type.label}</div>
                  <div className="text-xs text-secondary mt-1">{type.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Label Size */}
          <div className="bg-surface rounded-2xl border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Ruler className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Label Size</h2>
                <p className="text-sm text-secondary">Select the label dimensions</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {LABEL_SIZES.map((size) => (
                <button
                  key={size.name}
                  onClick={() => setSettings({
                    ...settings,
                    labelWidth: size.width,
                    labelHeight: size.height,
                    labelSizeName: size.name
                  })}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    settings.labelSizeName === size.name
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="font-bold text-sm">{size.name}</div>
                  <div className="text-xs text-secondary mt-1">{size.width} x {size.height} mm</div>
                </button>
              ))}
            </div>
          </div>

          {/* Label Fields */}
          <div className="bg-surface rounded-2xl border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Type className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Label Fields</h2>
                <p className="text-sm text-secondary">Choose what to display on labels</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-background/50">
                <input
                  type="checkbox"
                  checked={settings.showProductName}
                  onChange={(e) => setSettings({ ...settings, showProductName: e.target.checked })}
                  className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                />
                <Package className="w-5 h-5 text-secondary" />
                <span className="font-medium">Product Name</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-background/50">
                <input
                  type="checkbox"
                  checked={settings.showPrice}
                  onChange={(e) => setSettings({ ...settings, showPrice: e.target.checked })}
                  className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                />
                <DollarSign className="w-5 h-5 text-secondary" />
                <span className="font-medium">Price</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-background/50">
                <input
                  type="checkbox"
                  checked={settings.showSku}
                  onChange={(e) => setSettings({ ...settings, showSku: e.target.checked })}
                  className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                />
                <Package className="w-5 h-5 text-secondary" />
                <span className="font-medium">SKU</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-background/50">
                <input
                  type="checkbox"
                  checked={settings.showImei}
                  onChange={(e) => setSettings({ ...settings, showImei: e.target.checked })}
                  className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                />
                <Barcode className="w-5 h-5 text-secondary" />
                <span className="font-medium">IMEI</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-background/50">
                <input
                  type="checkbox"
                  checked={settings.showBarcode}
                  onChange={(e) => setSettings({ ...settings, showBarcode: e.target.checked })}
                  className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                />
                <Barcode className="w-5 h-5 text-secondary" />
                <span className="font-medium">Barcode Number</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-background/50">
                <input
                  type="checkbox"
                  checked={settings.showQrCode}
                  onChange={(e) => setSettings({ ...settings, showQrCode: e.target.checked })}
                  className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                />
                <QrCode className="w-5 h-5 text-secondary" />
                <span className="font-medium">QR Code</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-background/50">
                <input
                  type="checkbox"
                  checked={settings.showWarranty}
                  onChange={(e) => setSettings({ ...settings, showWarranty: e.target.checked })}
                  className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                />
                <Shield className="w-5 h-5 text-secondary" />
                <span className="font-medium">Warranty</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-background/50 col-span-2">
                <input
                  type="checkbox"
                  checked={settings.includeCurrency}
                  onChange={(e) => setSettings({ ...settings, includeCurrency: e.target.checked })}
                  className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                />
                <DollarSign className="w-5 h-5 text-secondary" />
                <span className="font-medium">Include Currency Symbol (৳)</span>
              </label>
            </div>
          </div>

          {/* Font Size */}
          <div className="bg-surface rounded-2xl border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Type className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Font Size</h2>
                <p className="text-sm text-secondary">Adjust label text size</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="8"
                max="16"
                value={settings.fontSize}
                onChange={(e) => setSettings({ ...settings, fontSize: Number(e.target.value) })}
                className="flex-1 h-2 bg-background rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <span className="w-12 text-center font-bold">{settings.fontSize}px</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}