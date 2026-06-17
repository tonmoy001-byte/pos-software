"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, Smartphone, ArrowLeft, Package, ExternalLink } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { safeFetch } from "@/lib/api-client";
import Link from "next/link";

export default function ScanPage() {
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function lookup(code: string) {
    if (!code.trim()) return;
    setLoading(true);
    setProduct(null);
    try {
      const data = await safeFetch<any>(`/api/products?barcode=${encodeURIComponent(code.trim())}`);
      const found = Array.isArray(data) ? data[0] : data.products?.[0] || data;
      if (found?.id) {
        setProduct(found);
        setHistory(prev => {
          const next = [found, ...prev.filter((p: any) => p.id !== found.id)];
          return next.slice(0, 20);
        });
      } else {
        setProduct({ notFound: true, barcode: code.trim() });
      }
    } catch {
      setProduct({ notFound: true, barcode: code.trim() });
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    lookup(barcode);
    setBarcode("");
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-6">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <Link href="/mobile-pos" className="p-2 rounded-xl bg-accent text-accent-foreground">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-black">Barcode Scanner</h1>
          <p className="text-xs text-secondary">Search products by barcode</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <input ref={inputRef} autoFocus value={barcode} onChange={e => setBarcode(e.target.value)}
          placeholder="Scan or type barcode..."
          className="w-full px-4 py-4 pr-12 rounded-2xl bg-surface border-2 border-border text-lg font-mono text-center focus:border-primary outline-none transition-all" />
        <Camera size={24} className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary" />
      </form>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      )}

      {product && !loading && (
        product.notFound ? (
          <div className="text-center py-12 bg-surface rounded-2xl border border-border">
            <Package size={48} className="mx-auto text-secondary mb-3" strokeWidth={1.5} />
            <p className="font-bold text-lg">Product Not Found</p>
            <p className="text-sm text-secondary mt-1">Barcode: {product.barcode}</p>
          </div>
        ) : (
          <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black">{product.name}</h2>
                {product.category && (
                  <span className="text-xs font-bold text-secondary uppercase tracking-wider">{product.category}</span>
                )}
              </div>
              <Link href={`/inventory`} className="p-2 rounded-xl bg-accent">
                <ExternalLink size={18} />
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-background rounded-xl p-3 text-center">
                <p className="text-xs text-secondary">Price</p>
                <p className="text-lg font-black text-green-600">{formatCurrency(Number(product.price || product.sellingPrice))}</p>
              </div>
              <div className="bg-background rounded-xl p-3 text-center">
                <p className="text-xs text-secondary">Stock</p>
                <p className={`text-lg font-black ${Number(product.stock) < (product.minStock || 5) ? "text-red-500" : "text-foreground"}`}>
                  {Number(product.stock)}
                </p>
              </div>
              <div className="bg-background rounded-xl p-3 text-center">
                <p className="text-xs text-secondary">Cost</p>
                <p className="text-lg font-black text-foreground">{formatCurrency(Number(product.cost || product.buyingPrice || 0))}</p>
              </div>
            </div>
            {product.barcode && (
              <div className="text-center text-xs text-secondary font-mono">{product.barcode}</div>
            )}
          </div>
        )
      )}

      {history.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-secondary mb-2 uppercase tracking-wider">Recent Scans</h3>
          <div className="space-y-2">
            {history.map((p: any) => (
              <button key={p.id} onClick={() => { setProduct(p); }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-surface border border-border hover:bg-accent transition-all">
                <div>
                  <p className="font-bold text-sm">{p.name}</p>
                  <p className="text-xs text-secondary">{p.barcode}</p>
                </div>
                <p className="font-bold">{formatCurrency(Number(p.sellingPrice))}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
