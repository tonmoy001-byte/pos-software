"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui";

interface StockAdjustModalProps {
  product: { id: string; name: string; brand: string; category: string; stock: number; cost: number };
  onClose: () => void;
  onSuccess: () => void;
}

export function StockAdjustModal({ product, onClose, onSuccess }: StockAdjustModalProps) {
  const [quantity, setQuantity] = useState("");
  const [cost, setCost] = useState(product.cost?.toString() || "");
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!quantity || Number(quantity) < 1) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${product.id}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity, cost }),
      });
      if (res.ok) {
        onSuccess();
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface w-full max-w-md rounded-3xl p-8 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Add Stock</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="bg-background p-4 rounded-xl">
          <p className="font-bold">{product.name}</p>
          <p className="text-xs text-secondary">{product.brand} - {product.category}</p>
          <p className="text-xs text-secondary">Current Stock: {product.stock}</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-secondary uppercase ml-1">Quantity</label>
            <input
              type="number"
              value={quantity || undefined}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary font-bold text-xl"
              placeholder="0"
              min="1"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-secondary uppercase ml-1">Cost Price (per unit)</label>
            <input
              type="number"
              value={cost || undefined}
              onChange={(e) => setCost(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border outline-none focus:border-primary font-bold text-xl"
              placeholder="0"
            />
          </div>
        </div>
        <Button className="w-full" size="lg" onClick={handleAdd} disabled={loading || !quantity || Number(quantity) < 1}>
          {loading ? "Adding..." : "Add to Stock"}
        </Button>
      </div>
    </div>
  );
}
