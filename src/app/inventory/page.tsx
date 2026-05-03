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
    setPrintItems(product.items || []);
    setIsBarcodeOpen(true);
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
                {product._count?.items || 0} in stock
              </span>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-2xl rounded-3xl p-8 space-y-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Print Barcode Labels</h2>
              <button onClick={() => setIsBarcodeOpen(false)}><X className="w-5 h-5" /></button>
            </div>

            <div className="text-center mb-4">
              <p className="font-bold">{selectedProduct.name}</p>
              <p className="text-sm text-secondary">{selectedProduct.barcode}</p>
            </div>

            <div className={`grid ${barcodeSettings?.labelWidth > 60 ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
              {printItems.map((item: any) => (
                <div key={item.id} className="border-2 border-dashed border-gray-300 p-2 text-center bg-white">
                  <BarcodeLabelPreview
                    productName={barcodeSettings?.showProductName ? selectedProduct.name : undefined}
                    price={barcodeSettings?.showPrice ? selectedProduct.price : undefined}
                    sku={barcodeSettings?.showSku ? selectedProduct.barcode : undefined}
                    imei={barcodeSettings?.showImei ? item.imei : undefined}
                    barcodeValue={item.barcode || item.imei || selectedProduct.barcode}
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
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <Button 
                className="flex-1" 
                onClick={() => window.print()}
              >
                <Printer className="w-5 h-5" /> Print All
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