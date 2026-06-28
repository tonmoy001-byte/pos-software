"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/form/page-header";
import { FormSectionCard } from "@/components/form/form-section-card";
import { TextInput } from "@/components/form/text-input";
import { NumberInput } from "@/components/form/number-input";
import { SelectInput } from "@/components/form/select-input";
import { TextareaInput } from "@/components/form/textarea-input";
import { safeFetch } from "@/lib/api-client";

interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  sellCost: number;
  notes: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  cost: number;
  price: number;
}

export default function NewPurchasePage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([
    { productId: "", productName: "", quantity: 1, unitCost: 0, sellCost: 0, notes: "" },
  ]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [supRes, prodRes] = await Promise.all([
          safeFetch<any>("/api/suppliers"),
          safeFetch<any>("/api/products"),
        ]);
        setSuppliers(Array.isArray(supRes) ? supRes : []);
        setProducts(Array.isArray(prodRes?.products) ? prodRes.products : []);
      } catch (err) {
        console.error("Failed to fetch data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  function addItem() {
    setItems([...items, { productId: "", productName: "", quantity: 1, unitCost: 0, sellCost: 0, notes: "" }]);
  }

  function removeItem(index: number) {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  }

  function updateItem(index: number, field: keyof PurchaseItem, value: any) {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === "productId" && value) {
      const product = products.find((p) => p.id === value);
      if (product) {
        newItems[index].productName = product.name;
        newItems[index].unitCost = product.cost;
        newItems[index].sellCost = product.price;
      }
    }

    setItems(newItems);
  }

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const validItems = items.filter((item) => item.productName && item.quantity > 0 && item.unitCost > 0);
      if (validItems.length === 0) {
        setError("Add at least one item with name, quantity, and cost");
        return;
      }

      await safeFetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          items: validItems.map((item) => ({
            productId: item.productId || undefined,
            productName: item.productName,
            quantity: item.quantity,
            unitCost: item.unitCost,
            sellCost: item.sellCost || undefined,
            notes: item.notes || undefined,
          })),
          notes: notes || undefined,
          expectedDeliveryDate: expectedDelivery || null,
        }),
      });

      router.push("/purchases");
    } catch (err: any) {
      setError(err.message || "Failed to create purchase");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Purchase"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Purchases", href: "/purchases" },
          { label: "New" },
        ]}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <FormSectionCard title="Purchase Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectInput
              label="Supplier"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              required
            />
            <TextInput
              label="Expected Delivery"
              type="date"
              value={expectedDelivery}
              onChange={(e) => setExpectedDelivery(e.target.value)}
            />
          </div>
          <TextareaInput
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Purchase notes..."
          />
        </FormSectionCard>

        <FormSectionCard title={`Items (${items.length})`}>
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="p-4 bg-muted/30 rounded-lg border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Item {index + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-destructive text-xs hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Product</label>
                    <select
                      value={item.productId}
                      onChange={(e) => updateItem(index, "productId", e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm"
                    >
                      <option value="">Select product...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Product Name</label>
                    <input
                      type="text"
                      value={item.productName}
                      onChange={(e) => updateItem(index, "productName", e.target.value)}
                      placeholder="Or enter name..."
                      className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Qty</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity || ""}
                      onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Buy Cost</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitCost || ""}
                      onChange={(e) => updateItem(index, "unitCost", parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Sell Cost</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.sellCost || ""}
                      onChange={(e) => updateItem(index, "sellCost", parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
                    <input
                      type="text"
                      value={item.notes}
                      onChange={(e) => updateItem(index, "notes", e.target.value)}
                      placeholder="Optional..."
                      className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addItem}
            className="mt-3 text-sm text-primary hover:underline font-medium"
          >
            + Add Item
          </button>
        </FormSectionCard>

        <div className="bg-card border border-border rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-lg font-bold">
            Total: ৳{totalAmount.toLocaleString()}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push("/purchases")}
              className="px-6 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Purchase"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
