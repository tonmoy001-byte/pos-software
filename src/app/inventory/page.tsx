"use client";

import { useState, useEffect, useRef, forwardRef } from "react";
import { 
  Plus, 
  Search, 
  FileSpreadsheet,
  AlertCircle,
  X,
  Printer,
  Download,
  Trash2,
  Tag
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui";
import { BarcodeGenerator, BarcodeLabelPreview } from "@/components/barcode/barcode-label";

// Barcode Component using JSBarcode
const Barcode = forwardRef<SVGSVGElement, { value: string }>(({ value }, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  
  useEffect(() => {
    if (svgRef.current && value) {
      import("jsbarcode").then((JsBarcode) => {
        JsBarcode.default(svgRef.current, value, {
          format: "CODE128",
          width: 1.5,
          height: 40,
          displayValue: true,
          fontSize: 12,
          margin: 5
        });
      });
    }
  }, [value]);

  return <svg ref={svgRef} />;
});

Barcode.displayName = "Barcode";

export default function InventoryPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [printItems, setPrintItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState<{type: "success"|"error", text: string} | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [printQuantity, setPrintQuantity] = useState(1);

  const [form, setForm] = useState({
    name: "",
    brand: "",
    category: "Mobile",
    price: "",
    cost: "",
    minStock: "5"
  });

  const [stockForm, setStockForm] = useState({
    quantity: "",
    cost: ""
  });
  const [barcodeSettings, setBarcodeSettings] = useState<any>(null);

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products");
      const json = await res.json();
      setProducts(json);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetch("/api/barcode-settings")
      .then(res => res.json())
      .then(data => setBarcodeSettings(data))
      .catch(() => {});
  }, []);

  const handleAddProduct = async () => {
    if (!form.name || !form.price) return;
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: "Product added!" });
        setIsAddOpen(false);
        setForm({ name: "", brand: "", category: "Mobile", price: "", cost: "", minStock: "5" });
        fetchProducts();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to add product" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddStock = async (productId: string) => {
    if (!stockForm.quantity || Number(stockForm.quantity) < 1) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/products/${productId}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stockForm)
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Stock added!" });
        setStockForm({ quantity: "", cost: "" });
        fetchProducts();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openBarcodePrint = (product: any) => {
    setSelectedProduct(product);
    setPrintItems(product.items && product.items.length > 0 ? product.items : []);
    setPrintQuantity(product.items && product.items.length > 0 ? product.items.length : 1);
    setIsBarcodeOpen(true);
  };

  const handlePrint = async () => {
    const printArea = document.getElementById("barcode-print-area");
    if (!printArea) {
      console.error("Print area not found");
      return;
    }
    printArea.style.display = "block";
    await new Promise(resolve => setTimeout(resolve, 300));
    window.print();
    printArea.style.display = "none";
  };

  const filteredProducts = products.filter(p => 
    !searchQuery || 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.barcode?.includes(searchQuery)
  );

  if (loading) {
    return <div className="p-8 animate-pulse text-secondary font-bold">Loading Inventory...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      {/* Print Styles - Optimized for roll stickers */}
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 0;
            padding: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: auto !important;
            height: auto !important;
          }
          body * {
            visibility: hidden;
          }
          #barcode-print-area,
          #barcode-print-area * {
            visibility: visible;
          }
          #barcode-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: var(--label-width, 38mm);
            display: flex !important;
            flex-direction: column;
            gap: 0;
            padding: 0;
            margin: 0;
          }
          #barcode-print-area > div {
            width: 100%;
            height: var(--label-height, 25mm);
            page-break-inside: avoid;
            break-inside: avoid;
            margin: 0;
            padding: 2mm;
            box-sizing: border-box;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Dedicated Print Area */}
      <div 
        id="barcode-print-area" 
        style={{ 
          display: 'none',
          '--label-width': `${barcodeSettings?.labelWidth || 38}mm`,
          '--label-height': `${barcodeSettings?.labelHeight || 25}mm`,
        } as React.CSSProperties}
      >
        {Array.from({ length: printQuantity }).map((_, idx) => {
          const item = selectedProduct?.items?.[idx % (selectedProduct?.items?.length || 1)];
          return (
            <div key={idx} className="p-1">
              <BarcodeLabelPreview
                productName={barcodeSettings?.showProductName ? selectedProduct?.name : undefined}
                price={barcodeSettings?.showPrice ? selectedProduct?.price : undefined}
                sku={barcodeSettings?.showSku ? selectedProduct?.barcode : undefined}
                imei={barcodeSettings?.showImei && item?.imei ? item.imei : undefined}
                barcodeValue={item?.barcode || item?.imei || selectedProduct?.barcode || selectedProduct?.id}
settings={barcodeSettings || {
                      barcodeType: "CODE128",
                      showProductName: true,
                      showPrice: true,
                      showSku: true,
                      showImei: true,
                      showBarcode: true,
                      includeCurrency: true,
                      fontSize: 8,
                      labelWidth: 38,
                      labelHeight: 25,
                      compactMode: true
                    }}
              />
            </div>
          );
        })}
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold">Inventory</h1>
          <p className="text-secondary">Manage stock and print barcode labels.</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setIsAddOpen(true)}>
            <Plus className="w-5 h-5" /> Add Product
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
        <input 
          type="text" 
          placeholder="Search by name or barcode..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-border outline-none focus:border-primary"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-surface p-6 rounded-2xl border border-border card-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg">{product.name}</h3>
                <p className="text-sm text-secondary">{product.brand} - {product.category}</p>
              </div>
              <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded">
                {product.stock || 0} in stock
              </span>
              {(product.advanceOrderQuantity ?? 0) > 0 && (
                <span className="text-xs font-bold bg-orange-500 text-white px-2 py-1 rounded ml-2">
                  {product.advanceOrderQuantity} in Advance
                </span>
              )}
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-secondary">Price:</span>
                <span className="font-bold">{formatCurrency(product.price)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-secondary">Cost:</span>
                <span className="font-bold">{formatCurrency(product.cost)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-secondary">Barcode:</span>
                <span className="font-mono text-xs">{product.barcode || "N/A"}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                size="sm" 
                className="flex-1"
                onClick={() => openBarcodePrint(product)}
                disabled={(product.stock || 0) === 0}
              >
                <Printer className="w-4 h-4" /> Print Label
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setSelectedProduct(product);
                  setStockForm({ quantity: "", cost: product.cost?.toString() || "" });
                }}
              >
                <Plus className="w-4 h-4" /> Add Stock
              </Button>
            </div>

            {selectedProduct?.id === product.id && !isBarcodeOpen && (
              <div className="mt-4 p-4 bg-background rounded-xl space-y-3">
                <div>
                  <label className="text-xs font-bold text-secondary uppercase">Quantity</label>
                  <input 
                    type="number"
                    placeholder="Enter quantity"
                    value={stockForm.quantity || ""}
                    onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm"
                    min="1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-secondary uppercase">Cost Price (per unit)</label>
                  <input 
                    type="number"
                    placeholder="Cost price"
                    value={stockForm.cost}
                    onChange={(e) => setStockForm({ ...stockForm, cost: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm"
                  />
                </div>
                <Button 
                  size="sm" 
                  className="w-full"
                  onClick={() => handleAddStock(product.id)}
                  disabled={submitting || !stockForm.quantity || Number(stockForm.quantity) < 1}
                >
                  {submitting ? "Adding..." : "Add to Stock"}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12 text-secondary">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No products found. Add your first product!</p>
        </div>
      )}

      {/* Add Product Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-md rounded-3xl p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Add New Product</h2>
              <button onClick={() => setIsAddOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-secondary uppercase">Product Name *</label>
                <input 
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary"
                  placeholder="iPhone 13 Pro"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-secondary uppercase">Brand</label>
                  <input 
                    type="text"
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary"
                    placeholder="Apple"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-secondary uppercase">Category</label>
                  <select 
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary"
                  >
                    <option value="Mobile">Mobile</option>
                    <option value="Accessory">Accessory</option>
                    <option value="Gadget">Gadget</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-secondary uppercase">Selling Price *</label>
                  <input 
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary font-bold"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-secondary uppercase">Cost Price</label>
                  <input 
                    type="number"
                    value={form.cost}
                    onChange={(e) => setForm({ ...form, cost: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-border outline-none font-bold"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-secondary uppercase">Min Stock Alert</label>
                <input 
                  type="number"
                  value={form.minStock}
                  onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary"
                />
              </div>
            </div>

            <Button 
              className="w-full" 
              size="lg"
              onClick={handleAddProduct}
              disabled={submitting || !form.name || !form.price}
            >
              {submitting ? "Saving..." : "Add Product"}
            </Button>
          </div>
        </div>
      )}

      {/* Barcode Print Modal */}
      {isBarcodeOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-surface w-full max-w-2xl rounded-3xl p-8 space-y-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Print Barcode Labels</h2>
              <button onClick={() => setIsBarcodeOpen(false)}><X className="w-5 h-5" /></button>
            </div>

            <div className="text-center mb-4">
              <p className="font-bold">{selectedProduct.name}</p>
              <p className="text-sm text-secondary">{selectedProduct.barcode}</p>
            </div>

            {/* Print Quantity Selector - Always visible */}
            <div className="flex items-center justify-center gap-4 mb-6 p-4 bg-background rounded-xl">
              <label className="text-sm font-bold text-secondary">Number of Labels to Print:</label>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setPrintQuantity(Math.max(1, printQuantity - 1))} 
                  className="w-10 h-10 flex items-center justify-center bg-surface border-2 border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all font-bold text-lg"
                >
                  -
                </button>
                <span className="w-16 text-center font-bold text-xl bg-surface py-2 rounded-xl border-2 border-border">
                  {printQuantity}
                </span>
                <button 
                  onClick={() => setPrintQuantity(printQuantity + 1)} 
                  className="w-10 h-10 flex items-center justify-center bg-surface border-2 border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all font-bold text-lg"
                >
                  +
                </button>
              </div>
              <button 
                onClick={() => setPrintQuantity(1)} 
                className="text-xs text-secondary hover:text-primary underline ml-2"
              >
                Reset
              </button>
            </div>

            {/* Print and Screen preview area */}
            <div 
              className="print-area grid gap-4"
              style={{
                '--label-width': `${barcodeSettings?.labelWidth || 38}mm`,
                '--label-height': `${barcodeSettings?.labelHeight || 25}mm`,
              } as React.CSSProperties}
            >
              {Array.from({ length: printQuantity }).map((_, idx) => {
                const item = selectedProduct?.items?.[idx % (selectedProduct?.items?.length || 1)];
                return (
                  <div key={idx} className="border-2 border-dashed border-gray-300 p-2 text-center bg-white flex justify-center">
                    <BarcodeLabelPreview
                      productName={barcodeSettings?.showProductName ? selectedProduct?.name : undefined}
                      price={barcodeSettings?.showPrice ? selectedProduct?.price : undefined}
                      sku={barcodeSettings?.showSku ? selectedProduct?.barcode : undefined}
                      imei={barcodeSettings?.showImei && item?.imei ? item.imei : undefined}
                      barcodeValue={item?.barcode || item?.imei || selectedProduct?.barcode || selectedProduct?.id}
                      settings={barcodeSettings || {
                        barcodeType: "CODE128",
                        showProductName: true,
                        showPrice: true,
                        showSku: true,
                        showImei: true,
                        showBarcode: true,
                        includeCurrency: true,
                        fontSize: 8,
                        labelWidth: 38,
                        labelHeight: 25,
                        compactMode: true
                      }}
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex gap-4">
              <Button 
                className="flex-1" 
                onClick={handlePrint}
              >
                <Printer className="w-5 h-5" /> Print
              </Button>
              <Button variant="secondary" onClick={() => setIsBarcodeOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}