"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Save, X, Info, Package, DollarSign, Truck, Image as ImageIcon, Hash, Cpu } from "lucide-react";
import {
  PageHeader, FormSectionCard, TextInput, NumberInput, SelectInput,
  TextareaInput, CheckboxInput, ImageUploader, Button,
  type SelectOption,
} from "@/components/ui";
import {
  productFormSchema, type ProductFormValues,
  RAM_OPTIONS, STORAGE_OPTIONS,
} from "@/lib/validators/product";
import { safeFetch, ApiError } from "@/lib/api-client";

type MetadataResponse = {
  categories: string[];
  brands: string[];
  suppliers: SelectOption[];
  units: SelectOption[];
  statuses: SelectOption[];
};

const EMPTY_VALUES: ProductFormValues = {
  name: "", sku: "", barcode: "", brand: "", category: "",
  productType: "NON_SERIALIZED", modelNumber: "", condition: undefined,
  ram: "", storage: "", network: "", color: "", description: "",
  costPrice: "", sellingPrice: "", unit: "PIECE",
  minStockAlert: "", reorderQuantity: "", trackImei: false,
  defaultSupplier: "", purchaseWarrantyMonths: "", salesWarrantyMonths: "",
  imageUrl: "", status: "ACTIVE",
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

  useEffect(() => {
    safeFetch<MetadataResponse>("/api/products/metadata")
      .then((d) => setMeta(d))
      .catch(() => setMeta(null))
      .finally(() => setMetaLoading(false));
  }, []);

  const set = <K extends keyof ProductFormValues>(k: K, v: ProductFormValues[K]) => {
    setValues((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const autoGenerateSku = (name: string) => {
    if (!name) return "";
    const words = name.trim().split(/\s+/);
    const code = words.map(w => {
      const first = w[0];
      if (!first) return "";
      if (/\d/.test(first)) return first;
      return first.toUpperCase();
    }).join("");
    return code.slice(0, 5);
  };

  useEffect(() => {
    if (values.name && !values.sku) {
      set("sku", autoGenerateSku(values.name));
    }
  }, [values.name]);

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
        unit: values.unit,
        minStock: Number(values.minStockAlert) || 5,
        reorderQuantity: Number(values.reorderQuantity) || 0,
        trackImei: values.trackImei,
        defaultSupplier: values.defaultSupplier || null,
        purchaseWarrantyMonths: Number(values.purchaseWarrantyMonths) || 0,
        salesWarrantyMonths: Number(values.salesWarrantyMonths) || 0,
        imageUrl: values.imageUrl || null,
        status: values.status,
      };
      await safeFetch<{ id?: string; error?: string; field?: string }>("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setToast({ type: "success", text: "Product created successfully!" });
      startTransition(() => {
        setTimeout(() => router.push("/products"), 800);
      });
    } catch (err: any) {
      if (err instanceof ApiError && err.body) {
        try {
          const body = JSON.parse(err.body);
          setToast({ type: "error", text: body.error || "Failed to save product" });
          if (body.field && typeof body.field === "string") {
            setErrors((e) => ({ ...e, [body.field as keyof ProductFormValues]: body.error }));
          }
        } catch {
          setToast({ type: "error", text: "Failed to save product" });
        }
      } else {
        setToast({ type: "error", text: err.message || "An unexpected error occurred" });
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (confirm("Discard all changes and go back?")) {
      router.push("/products");
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
      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8" noValidate>
        <PageHeader
          title="Add New Product"
          breadcrumbs={[
            { label: "Dashboard", href: "/" },
            { label: "Products", href: "/products" },
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
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="space-y-5">
          <FormSectionCard
            title="Basic Information"
            description="Core product details and classification."
            icon={Package}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextInput
                label="Product Name"
                required
                placeholder="e.g. iPhone 15 Pro"
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                error={errors.name}
                containerClassName="sm:col-span-2"
              />
              <TextInput
                label="Product Code"
                required
                placeholder="Auto-generated from name"
                value={values.sku}
                onChange={(e) => set("sku", e.target.value)}
                error={errors.sku}
                hint="Short code for stock tracking (e.g. IP15P)"
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
                label="Condition"
                options={[
                  { value: "NEW", label: "New" },
                  { value: "USED", label: "Used" },
                  { value: "REFURBISHED", label: "Refurbished" },
                ]}
                value={values.condition || ""}
                onChange={(e) => set("condition", e.target.value as any)}
                placeholder="Select condition"
              />
            </div>
          </FormSectionCard>

          <FormSectionCard
            title="Specifications"
            description="Technical specs and physical attributes."
            icon={Cpu}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectInput
                label="RAM"
                options={RAM_OPTIONS.map(r => ({ value: r, label: r }))}
                value={values.ram || ""}
                onChange={(e) => set("ram", e.target.value)}
                error={errors.ram}
                placeholder="Select RAM"
              />
              <SelectInput
                label="Storage"
                options={STORAGE_OPTIONS.map(s => ({ value: s, label: s }))}
                value={values.storage || ""}
                onChange={(e) => set("storage", e.target.value)}
                error={errors.storage}
                placeholder="Select storage"
              />
              <SelectInput
                label="Network"
                options={[
                  { value: "3G", label: "3G" },
                  { value: "4G", label: "4G" },
                  { value: "5G", label: "5G" },
                ]}
                value={values.network || ""}
                onChange={(e) => set("network", e.target.value)}
                placeholder="Select network"
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
            title="Pricing"
            description="Set cost and selling prices."
            icon={DollarSign}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <NumberInput
                label="Cost Price"
                required
                prefix="৳"
                min={0}
                value={values.costPrice}
                onChange={(v) => set("costPrice", v)}
                error={errors.costPrice}
                placeholder="0.00"
              />
              <NumberInput
                label="Selling Price"
                required
                prefix="৳"
                min={0}
                value={values.sellingPrice}
                onChange={(v) => set("sellingPrice", v)}
                error={errors.sellingPrice}
                placeholder="0.00"
                hint="Must be ≥ cost price"
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
          </FormSectionCard>

          <FormSectionCard
            title="Inventory"
            description="Stock levels and tracking settings."
            icon={Hash}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumberInput
                label="Minimum Stock Alert"
                min={0}
                value={values.minStockAlert}
                onChange={(v) => set("minStockAlert", v)}
                error={errors.minStockAlert}
                placeholder="5"
              />
              <NumberInput
                label="Reorder Quantity"
                min={0}
                value={values.reorderQuantity}
                onChange={(v) => set("reorderQuantity", v)}
                error={errors.reorderQuantity}
                placeholder="0"
              />
              <div className="sm:col-span-2 pt-2 border-t border-border/60">
                <CheckboxInput
                  label="Track By IMEI / Serial Number"
                  description="Enable when receiving stock — each unit gets a unique tracking number."
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SelectInput
                label="Default Supplier"
                options={meta?.suppliers || []}
                value={values.defaultSupplier || ""}
                onChange={(e) => set("defaultSupplier", e.target.value)}
                error={errors.defaultSupplier}
                placeholder="Select supplier"
                disabled={metaLoading}
                containerClassName="sm:col-span-3"
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
              <SelectInput
                label="Product Status"
                options={meta?.statuses || []}
                value={values.status}
                onChange={(e) => set("status", e.target.value as any)}
                error={errors.status}
              />
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
