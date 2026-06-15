"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Save, X, Info, Plus, Hash, Package, DollarSign, Truck, Image as ImageIcon, X as XIcon } from "lucide-react";
import {
  PageHeader, FormSectionCard, TextInput, NumberInput, SelectInput,
  TextareaInput, CheckboxInput, ImageUploader, Button,
  type SelectOption,
} from "@/components/ui";
import {
  productFormSchema, type ProductFormValues,
  RAM_OPTIONS, STORAGE_OPTIONS,
} from "@/lib/validators/product";

type MetadataResponse = {
  categories: string[];
  brands: string[];
  suppliers: SelectOption[];
  warehouses: SelectOption[];
  units: SelectOption[];
  productTypes: SelectOption[];
  conditions: SelectOption[];
  ramOptions: string[];
  storageOptions: string[];
  networkOptions: string[];
  statuses: SelectOption[];
};

const EMPTY_VALUES: ProductFormValues = {
  name: "", sku: "", barcode: "", brand: "", category: "",
  productType: "SERIALIZED", modelNumber: "", condition: undefined,
  ram: "", storage: "", network: "", color: "", description: "",
  costPrice: "", sellingPrice: "", taxVat: "", unit: "PIECE",
  openingStock: "", openingCost: "", warehouse: "", minStockAlert: "", reorderQuantity: "", trackImei: false,
  defaultSupplier: "", purchaseWarrantyMonths: "", salesWarrantyMonths: "",
  imageUrl: "", status: "ACTIVE", tags: [],
};

export default function AddNewProductPage() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [values, setValues] = useState<ProductFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof ProductFormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [meta, setMeta] = useState<MetadataResponse | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    fetch("/api/products/metadata")
      .then(r => r.json())
      .then((d) => setMeta(d))
      .catch(() => setMeta(null))
      .finally(() => setMetaLoading(false));
  }, []);

  const set = <K extends keyof ProductFormValues>(k: K, v: ProductFormValues[K]) => {
    setValues((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  useEffect(() => {
    const stock = Number(values.openingStock) || 0;
    const cost = Number(values.costPrice) || 0;
    if (stock > 0 && cost > 0) {
      setValues((p) => {
        const calculated = Number((Number(p.openingStock) * Number(p.costPrice)).toFixed(2));
        if (Number(p.openingCost) === calculated) return p;
        return { ...p, openingCost: calculated };
      });
    }
  }, [values.openingStock, values.costPrice]);

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (values.tags && values.tags.length >= 20) return;
    if (values.tags?.includes(t)) { setTagInput(""); return; }
    set("tags", [...(values.tags || []), t]);
    setTagInput("");
  };

  const removeTag = (t: string) => set("tags", (values.tags || []).filter(x => x !== t));

  const validate = (): boolean => {
    const result = productFormSchema.safeParse(values);
    if (result.success) { setErrors({}); return true; }
    const newErrors: Partial<Record<keyof ProductFormValues, string>> = {};
    for (const issue of result.error.issues) {
      const path = issue.path[0] as keyof ProductFormValues;
      if (path && !newErrors[path]) newErrors[path] = issue.message;
    }
    setErrors(newErrors);
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      setToast({ type: "error", text: "Please fix the errors in the form" });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSubmitting(true);
    setToast(null);
    try {
      const payload = {
        name: values.name,
        sku: values.sku,
        barcode: values.barcode || null,
        brand: values.brand,
        category: values.category,
        productType: "NON_SERIALIZED",
        modelNumber: values.modelNumber || null,
        condition: values.condition || null,
        ram: values.ram || null,
        storage: values.storage || null,
        network: values.network || null,
        color: values.color || null,
        description: values.description || null,
        price: Number(values.sellingPrice) || 0,
        cost: Number(values.costPrice) || 0,
        taxVat: Number(values.taxVat) || 0,
        unit: values.unit,
        stock: Number(values.openingStock) || 0,
        openingCost: Number(values.openingCost) || 0,
        warehouse: values.warehouse || null,
        minStock: Number(values.minStockAlert) || 5,
        reorderQuantity: Number(values.reorderQuantity) || 0,
        trackImei: values.trackImei,
        defaultSupplier: values.defaultSupplier || null,
        purchaseWarrantyMonths: Number(values.purchaseWarrantyMonths) || 0,
        salesWarrantyMonths: Number(values.salesWarrantyMonths) || 0,
        imageUrl: values.imageUrl || null,
        status: values.status,
        tags: values.tags || [],
      };
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ type: "error", text: data.error || "Failed to save product" });
        if (data.field && typeof data.field === "string") {
          setErrors((e) => ({ ...e, [data.field as keyof ProductFormValues]: data.error }));
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setToast({ type: "success", text: "Product created successfully!" });
      startTransition(() => {
        setTimeout(() => router.push("/inventory"), 800);
      });
    } catch (err: any) {
      setToast({ type: "error", text: err.message || "An unexpected error occurred" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (confirm("Discard all changes and go back to inventory?")) {
      router.push("/inventory");
    }
  };

  const brandOptions: SelectOption[] = useMemo(() =>
    (meta?.brands || []).map(b => ({ value: b, label: b })),
    [meta]
  );
  const categoryOptions: SelectOption[] = useMemo(() =>
    (meta?.categories || []).map(c => ({ value: c, label: c.charAt(0) + c.slice(1).toLowerCase() })),
    [meta]
  );

  return (
    <div className="min-h-screen bg-gray-50/50">
      <form onSubmit={handleSubmit} className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8" noValidate>
        <PageHeader
          title="Add New Product"
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Products", href: "/inventory" },
            { label: "Add New Product" },
          ]}
          actions={
            <>
              <Button type="button" variant="secondary" onClick={handleCancel} disabled={submitting}>
                <X className="w-4 h-4" /> Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4" /> Save Product</>
                )}
              </Button>
            </>
          }
        />

        {toast && (
          <div
            role="alert"
            className={`mb-6 p-4 rounded-xl flex items-center justify-between gap-3 border ${
              toast.type === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-semibold">{toast.text}</p>
            </div>
            <button type="button" onClick={() => setToast(null)} className="p-1 hover:bg-black/5 rounded" aria-label="Dismiss">
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <FormSectionCard
            title="Basic Information"
            description="Core product details and classification."
            icon={Package}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextInput
                label="Product Name"
                required
                placeholder="e.g. iPhone 13 Pro"
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                error={errors.name}
                containerClassName="sm:col-span-2"
              />
              <TextInput
                label="SKU / Product Code"
                required
                placeholder="e.g. IP13PRO-128-BL"
                value={values.sku}
                onChange={(e) => set("sku", e.target.value)}
                error={errors.sku}
              />
              <TextInput
                label="Barcode"
                placeholder="e.g. 8901234567890"
                value={values.barcode}
                onChange={(e) => set("barcode", e.target.value)}
                error={errors.barcode}
                hint="Leave blank to auto-generate"
              />
              <SelectInput
                label="Brand"
                required
                options={brandOptions}
                value={values.brand}
                onChange={(e) => set("brand", e.target.value)}
                error={errors.brand}
                placeholder="Select brand"
                disabled={metaLoading}
              />
              <SelectInput
                label="Category"
                required
                options={categoryOptions}
                value={values.category}
                onChange={(e) => set("category", e.target.value)}
                error={errors.category}
                placeholder="Select category"
                disabled={metaLoading}
              />
              <TextInput
                label="Model Number"
                placeholder="e.g. A2483"
                value={values.modelNumber}
                onChange={(e) => set("modelNumber", e.target.value)}
                error={errors.modelNumber}
              />
              <SelectInput
                label="RAM"
                options={RAM_OPTIONS.map(r => ({ value: r, label: r }))}
                value={values.ram || ""}
                onChange={(e) => set("ram", e.target.value)}
                error={errors.ram}
                placeholder="Select RAM"
              />
              <SelectInput
                label="Storage / Variant"
                options={STORAGE_OPTIONS.map(s => ({ value: s, label: s }))}
                value={values.storage || ""}
                onChange={(e) => set("storage", e.target.value)}
                error={errors.storage}
                placeholder="Select storage"
              />
              <TextInput
                label="Color"
                placeholder="e.g. Blue Sierra"
                value={values.color || ""}
                onChange={(e) => set("color", e.target.value)}
                error={errors.color}
              />
              <TextareaInput
                label="Description"
                placeholder="Brief product description..."
                value={values.description || ""}
                onChange={(e) => set("description", e.target.value)}
                error={errors.description}
                containerClassName="sm:col-span-2"
                rows={3}
              />
            </div>
          </FormSectionCard>

          <FormSectionCard
            title="Pricing & Stock"
            description="Set pricing, stock levels, and warehouse."
            icon={DollarSign}
          >
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Pricing</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumberInput
                label="Cost Price"
                required
                prefix="BDT"
                min={0}
                value={values.costPrice}
                onChange={(v) => set("costPrice", v)}
                error={errors.costPrice}
                placeholder="0.00"
              />
              <NumberInput
                label="Selling Price"
                required
                prefix="BDT"
                min={0}
                value={values.sellingPrice}
                onChange={(v) => set("sellingPrice", v)}
                error={errors.sellingPrice}
                placeholder="0.00"
                hint="Must be ≥ cost price"
              />
              <NumberInput
                label="Tax / VAT"
                suffix="%"
                min={0}
                max={100}
                value={values.taxVat}
                onChange={(v) => set("taxVat", v)}
                error={errors.taxVat}
                placeholder="0"
              />
              <SelectInput
                label="Unit"
                required
                options={meta?.units || []}
                value={values.unit}
                onChange={(e) => set("unit", e.target.value as any)}
                error={errors.unit}
              />
            </div>
            <hr className="border-border" />
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Stock & Inventory</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumberInput
                label="Opening Stock"
                min={0}
                value={values.openingStock}
                onChange={(v) => set("openingStock", v)}
                error={errors.openingStock}
                placeholder="0"
              />
              <NumberInput
                label="Opening Cost (Total)"
                prefix="BDT"
                min={0}
                value={values.openingCost}
                onChange={(v) => set("openingCost", v)}
                error={errors.openingCost}
                placeholder="0.00"
                hint="Auto-calculated from stock × cost"
              />
              <SelectInput
                label="Warehouse / Store"
                options={meta?.warehouses || []}
                value={values.warehouse || ""}
                onChange={(e) => set("warehouse", e.target.value)}
                error={errors.warehouse}
                placeholder="Select warehouse"
                disabled={metaLoading}
              />
              <NumberInput
                label="Minimum Stock Alert"
                min={0}
                value={values.minStockAlert}
                onChange={(v) => set("minStockAlert", v)}
                error={errors.minStockAlert}
                placeholder="5"
              />
              <div className="sm:col-span-2 pt-2 border-t border-border/60">
                <CheckboxInput
                  label="Track By IMEI / Serial Number"
                  description="Enables serialized tracking. IMEI numbers are recorded during purchase and stock receiving."
                  checked={values.trackImei}
                  onChange={(e) => set("trackImei", e.target.checked)}
                />
              </div>
            </div>
          </FormSectionCard>

          <FormSectionCard
            title="Product Image"
            description="Drag and drop an image. JPG, PNG, or WEBP. Max 2MB."
            icon={ImageIcon}
          >
            <ImageUploader
              value={values.imageUrl || null}
              onChange={(url) => set("imageUrl", url || "")}
            />
          </FormSectionCard>

          <FormSectionCard
            title="Supplier & Warranty"
            description="Default supplier and warranty periods."
            icon={Truck}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectInput
                label="Default Supplier"
                options={meta?.suppliers || []}
                value={values.defaultSupplier || ""}
                onChange={(e) => set("defaultSupplier", e.target.value)}
                error={errors.defaultSupplier}
                placeholder="Select supplier"
                disabled={metaLoading}
                containerClassName="sm:col-span-2"
              />
              <NumberInput
                label="Purchase Warranty"
                suffix="months"
                min={0}
                value={values.purchaseWarrantyMonths}
                onChange={(v) => set("purchaseWarrantyMonths", v)}
                error={errors.purchaseWarrantyMonths}
                placeholder="0"
              />
              <NumberInput
                label="Sales Warranty"
                suffix="months"
                min={0}
                value={values.salesWarrantyMonths}
                onChange={(v) => set("salesWarrantyMonths", v)}
                error={errors.salesWarrantyMonths}
                placeholder="0"
              />
            </div>
          </FormSectionCard>

          <FormSectionCard
            title="Additional Information"
            description="Status and tags for organizing products."
            icon={Info}
          >
            <div className="space-y-4">
              <SelectInput
                label="Product Status"
                options={meta?.statuses || []}
                value={values.status}
                onChange={(e) => set("status", e.target.value as any)}
                error={errors.status}
              />
              <div>
                <label className="text-sm font-semibold text-foreground block mb-1.5">Tags</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <TextInput
                      placeholder="Add a tag and press Enter..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                    />
                  </div>
                  <Button type="button" variant="secondary" onClick={addTag} size="md">
                    <Plus className="w-4 h-4" /> Add
                  </Button>
                </div>
                {values.tags && values.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {values.tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary text-sm font-semibold rounded-full"
                      >
                        <Hash className="w-3 h-3" />
                        {t}
                        <button
                          type="button"
                          onClick={() => removeTag(t)}
                          className="ml-1 hover:bg-primary/20 rounded-full p-0.5"
                          aria-label={`Remove tag ${t}`}
                        >
                          <XIcon className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </FormSectionCard>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3 text-sm text-blue-800">
          <Info className="w-5 h-5 flex-shrink-0" />
          <p>
            Fields marked with <span className="text-red-500 font-bold">*</span> are required.
          </p>
        </div>
      </form>
    </div>
  );
}
