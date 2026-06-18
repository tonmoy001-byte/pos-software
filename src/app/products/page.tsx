"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { ProductFilters } from "@/components/products/ProductFilters";
import { ProductTable } from "@/components/products/ProductTable";
import { Pagination } from "@/components/products/Pagination";
import { BulkActionsBar } from "@/components/products/BulkActionsBar";
import { StockAdjustModal } from "@/components/products/StockAdjustModal";
import { BarcodePrintModal } from "@/components/products/BarcodePrintModal";

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [stockStatus, setStockStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: "asc" | "desc" } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [stockProduct, setStockProduct] = useState<any>(null);
  const [printProduct, setPrintProduct] = useState<any>(null);

  // Bulk action modals
  const [bulkModal, setBulkModal] = useState<"category" | "status" | "price" | null>(null);
  const [bulkValue, setBulkValue] = useState("");

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      if (search) params.set("search", search);
      if (category !== "ALL") params.set("category", category);
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      let items = data.products || [];

      if (stockStatus !== "all") {
        items = items.filter((p: any) => {
          const stock = p.stock || 0;
          const min = p.minStock || 5;
          if (stockStatus === "out_of_stock") return stock === 0;
          if (stockStatus === "low_stock") return stock > 0 && stock <= min;
          if (stockStatus === "in_stock") return stock > min;
          return true;
        });
      }

      if (sortConfig) {
        items.sort((a: any, b: any) => {
          const aVal = a[sortConfig.field] ?? "";
          const bVal = b[sortConfig.field] ?? "";
          const cmp = typeof aVal === "number" ? aVal - bVal : String(aVal).localeCompare(String(bVal));
          return sortConfig.direction === "asc" ? cmp : -cmp;
        });
      }

      setProducts(items);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, category, stockStatus, sortConfig]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  useEffect(() => { setPage(1); }, [search, category, stockStatus, limit]);

  const handleUpdate = async (id: string, updates: Record<string, any>) => {
    const res = await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to delete product");
        return;
      }
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch {
      alert("Network error — product was not deleted");
    }
  };

  const handleBulkAction = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    let action = "";
    let value: any = bulkValue;

    if (bulkModal === "category") action = "updateCategory";
    else if (bulkModal === "status") action = "updateStatus";
    else if (bulkModal === "price") { action = "updatePrice"; value = parseFloat(bulkValue); }

    if (!action) return;
    if (!bulkValue && bulkModal !== null) { alert("Please enter a value"); return; }

    await fetch("/api/products/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, productIds: ids, value }),
    });
    setSelectedIds(new Set());
    setBulkModal(null);
    setBulkValue("");
    fetchProducts();
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} products?`)) return;
    try {
      const res = await fetch("/api/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", productIds: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to delete products");
        return;
      }
    } catch {
      alert("Network error — products were not deleted");
    }
    setSelectedIds(new Set());
    fetchProducts();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === products.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(products.map((p) => p.id)));
  };

  const handleSort = (field: string) => {
    setSortConfig((prev) => {
      if (prev?.field === field) {
        return prev.direction === "asc" ? { field, direction: "desc" } : null;
      }
      return { field, direction: "asc" };
    });
  };

  return (
    <div className="p-8 space-y-6">
      <style>{`
        @media print {
          @page { size: auto; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; }
          body * { visibility: hidden; }
          #barcode-print-area-products, #barcode-print-area-products * { visibility: visible; }
          #barcode-print-area-products { position: absolute; left: 0; top: 0; display: flex !important; flex-direction: column; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-secondary">Manage your product catalog.</p>
        </div>
        <Link href="/products/new">
          <Button><Plus className="w-5 h-5" /> Add Product</Button>
        </Link>
      </div>

      <ProductFilters
        search={search} category={category} stockStatus={stockStatus}
        onSearchChange={setSearch} onCategoryChange={setCategory} onStockStatusChange={setStockStatus}
      />

      {loading ? (
        <div className="p-8 animate-pulse text-secondary font-bold">Loading products...</div>
      ) : (
        <>
          <ProductTable
            products={products} selectedIds={selectedIds} sortConfig={sortConfig}
            onToggleSelect={toggleSelect} onToggleAll={toggleAll} onSort={handleSort}
            onUpdate={handleUpdate} onDelete={handleDelete}
            onPrint={setPrintProduct} onStockAdjust={setStockProduct}
          />
          <Pagination
            page={page} totalPages={totalPages} total={total} limit={limit}
            label="product"
            onPageChange={setPage} onLimitChange={setLimit}
          />
        </>
      )}

      {selectedIds.size > 0 && (
        <BulkActionsBar
          selectedCount={selectedIds.size}
          onClearSelection={() => setSelectedIds(new Set())}
          onDelete={handleBulkDelete}
          onSetCategory={() => { setBulkModal("category"); setBulkValue(""); }}
          onSetStatus={() => { setBulkModal("status"); setBulkValue(""); }}
          onUpdatePrice={() => { setBulkModal("price"); setBulkValue(""); }}
        />
      )}

      {stockProduct && <StockAdjustModal product={stockProduct} onClose={() => setStockProduct(null)} onSuccess={fetchProducts} />}
      {printProduct && <BarcodePrintModal product={printProduct} onClose={() => setPrintProduct(null)} />}

      {bulkModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-sm rounded-3xl p-8 space-y-6">
            <h2 className="text-xl font-bold capitalize">
              {bulkModal === "category" && "Set Category"}
              {bulkModal === "status" && "Set Status"}
              {bulkModal === "price" && "Update Price"}
            </h2>
            <p className="text-sm text-secondary">For {selectedIds.size} selected products</p>
            {bulkModal === "category" && (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-border">
                <option value="">Select category</option>
                {["SMARTPHONE", "TABLET", "ACCESSORIES", "PARTS", "EARBUDS", "GADGET"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            {bulkModal === "status" && (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-border">
                <option value="">Select status</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            )}
            {bulkModal === "price" && (
              <input type="number" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} placeholder="New price" className="w-full px-4 py-3 rounded-xl border border-border" />
            )}
            <div className="flex gap-3">
              <Button className="flex-1" onClick={handleBulkAction}>Apply</Button>
              <Button variant="secondary" onClick={() => { setBulkModal(null); setBulkValue(""); }}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
