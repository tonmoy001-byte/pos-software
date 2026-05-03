"use client";

import { useState, useEffect } from "react";
import { Printer, Package, Search, Check, X, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { BarcodeLabelPreview } from "@/components/barcode/barcode-label";

interface Product {
  id: string;
  name: string;
  barcode: string;
  price: number;
  model: string;
  brand: string;
  items: { id: string; imei: string; barcode: string }[];
}

interface PrintItem {
  productId: string;
  product: Product;
  quantity: number;
  items: string[];
}

export default function BarcodePrintPage() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [barcodeSettings, setBarcodeSettings] = useState<any>(null);
  const [printItems, setPrintItems] = useState<PrintItem[]>([]);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/products").then(res => res.json()),
      fetch("/api/barcode-settings").then(res => res.json())
    ]).then(([productsData, settings]) => {
      setProducts(productsData);
      setBarcodeSettings(settings);
      setLoading(false);
    });
  }, []);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.barcode?.includes(searchQuery) ||
    p.model?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addToPrint = (product: Product) => {
    const existing = printItems.find(p => p.productId === product.id);
    if (existing) {
      setPrintItems(printItems.map(p => 
        p.productId === product.id 
          ? { ...p, quantity: p.quantity + 1 }
          : p
      ));
    } else {
      // Use product barcode as fallback if no IMEIs available
      const imeis = product.items?.slice(0, 10).map(i => i.imei) || [];
      const fallbackValue = product.barcode || product.id;
      const allItems = imeis.length > 0 ? imeis : [fallbackValue];
      setPrintItems([...printItems, {
        productId: product.id,
        product,
        quantity: 1,
        items: allItems
      }]);
    }
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setPrintItems(printItems.filter(p => p.productId !== productId));
    } else {
      setPrintItems(printItems.map(p => 
        p.productId === productId ? { ...p, quantity } : p
      ));
    }
  };

  const removeFromPrint = (productId: string) => {
    setPrintItems(printItems.filter(p => p.productId !== productId));
  };

  const totalLabels = printItems.reduce((sum, item) => sum + item.quantity, 0);

  const handlePrint = () => {
    setShowPrintPreview(true);
    setTimeout(() => {
      window.print();
      setShowPrintPreview(false);
    }, 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; }
          .no-print { display: none !important; }
          @page { margin: 5mm; }
        }
      `}</style>

      <div className="flex h-screen no-print">
        {/* Product Selection */}
        <div className="flex-1 p-6 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-black">Bulk Barcode Print</h1>
              <p className="text-secondary">Select products to print barcode labels</p>
            </div>
            {printItems.length > 0 && (
              <button
                onClick={() => setShowPrintPreview(true)}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90"
              >
                <Printer className="w-5 h-5" />
                Print {totalLabels} Labels
              </button>
            )}
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary w-5 h-5" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-xl bg-surface border border-border focus:border-primary outline-none"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => addToPrint(product)}
                  className="bg-surface p-4 rounded-xl border border-border hover:border-primary cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Package className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{product.name}</p>
                      <p className="text-xs text-secondary">{product.model}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-border">
                    <span className="font-bold text-primary">{formatCurrency(product.price)}</span>
                    <span className="text-xs text-secondary">
                      {product.items?.length || 0} units
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Items */}
        <div className="w-96 bg-surface border-l border-border p-6 flex flex-col">
          <h2 className="text-lg font-bold mb-4">Selected Products ({printItems.length})</h2>
          
          <div className="flex-1 overflow-y-auto space-y-3">
            {printItems.length === 0 ? (
              <div className="text-center text-secondary py-8">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No products selected</p>
              </div>
            ) : (
              printItems.map((item) => (
                <div key={item.productId} className="p-4 bg-background rounded-xl border border-border">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{item.product.name}</p>
                      <p className="text-xs text-secondary">{item.product.barcode}</p>
                    </div>
                    <button onClick={() => removeFromPrint(item.productId)} className="text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="w-8 h-8 bg-surface border border-border rounded-lg flex items-center justify-center"
                    >
                      -
                    </button>
                    <span className="flex-1 text-center font-bold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="w-8 h-8 bg-surface border border-border rounded-lg flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex justify-between font-bold mb-4">
              <span>Total Labels</span>
              <span>{totalLabels}</span>
            </div>
            <button
              onClick={handlePrint}
              disabled={printItems.length === 0}
              className="w-full py-4 bg-gradient-to-r from-primary to-primary/80 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Printer className="w-5 h-5" />
              Print Labels
            </button>
          </div>
        </div>
      </div>

      {/* Print Preview Modal */}
      {showPrintPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
            <div className="flex justify-between items-center mb-6 no-print">
              <h2 className="text-xl font-bold">Print Preview</h2>
              <button onClick={() => setShowPrintPreview(false)} className="p-2 hover:bg-background rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="print-area grid gap-2" style={{ 
              gridTemplateColumns: `repeat(${barcodeSettings?.labelWidth > 60 ? 2 : 4}, minmax(${barcodeSettings?.labelWidth || 50}mm, 1fr))` 
            }}>
              {printItems.map((item) => 
                Array.from({ length: item.quantity }).map((_, idx) => (
                  <BarcodeLabelPreview
                    key={`${item.productId}-${idx}`}
                    productName={barcodeSettings?.showProductName ? item.product.name : undefined}
                    price={barcodeSettings?.showPrice ? item.product.price.toString() : undefined}
                    sku={barcodeSettings?.showSku ? item.product.barcode : undefined}
                    imei={barcodeSettings?.showImei && item.items.length > 0 ? item.items[0] : undefined}
                    barcodeValue={item.items.length > 0 ? item.items[idx % item.items.length] : (item.product.barcode || item.productId)}
                    settings={barcodeSettings || {
                      barcodeType: "CODE128",
                      showProductName: true,
                      showPrice: true,
                      showSku: true,
                      showImei: true,
                      showBarcode: true,
                      includeCurrency: true,
                      fontSize: 10,
                      labelWidth: 50,
                      labelHeight: 25
                    }}
                  />
                ))
              )}
            </div>

            <div className="flex gap-4 mt-6 no-print">
              <button
                onClick={handlePrint}
                className="flex-1 py-4 bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Print Now
              </button>
              <button
                onClick={() => setShowPrintPreview(false)}
                className="px-6 py-4 bg-secondary/10 text-secondary rounded-xl font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}