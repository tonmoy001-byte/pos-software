import { z } from "zod";

export const PRODUCT_TYPES = ["SERIALIZED", "NON_SERIALIZED", "SERVICE"] as const;
export const CONDITIONS = ["NEW", "USED", "REFURBISHED"] as const;
export const UNITS = ["PIECE", "BOX", "PACK", "SET"] as const;
export const RAM_OPTIONS = ["2GB", "3GB", "4GB", "6GB", "8GB", "12GB", "16GB"] as const;
export const STORAGE_OPTIONS = ["16GB", "32GB", "64GB", "128GB", "256GB", "512GB", "1TB"] as const;
export const NETWORK_OPTIONS = ["3G", "4G", "5G"] as const;
export const PRODUCT_STATUSES = ["ACTIVE", "INACTIVE", "DRAFT"] as const;

export const productFormSchema = z.object({
  name: z.string().min(1, "Product name is required").max(200),
  sku: z.string().min(1, "SKU is required").max(80),
  barcode: z.string().max(80).optional().or(z.literal("")),
  brand: z.string().min(1, "Brand is required").max(80),
  category: z.string().min(1, "Category is required").max(80),
  productType: z.enum(PRODUCT_TYPES, { errorMap: () => ({ message: "Product type is required" }) }),
  modelNumber: z.string().max(80).optional().or(z.literal("")),
  condition: z.enum(CONDITIONS).optional().nullable(),
  ram: z.string().max(20).optional().or(z.literal("")),
  storage: z.string().max(20).optional().or(z.literal("")),
  network: z.string().max(20).optional().or(z.literal("")),
  color: z.string().max(40).optional().or(z.literal("")),
  description: z.string().max(2000).optional().or(z.literal("")),
  costPrice: z.coerce.number({ invalid_type_error: "Cost price is required" }).min(0, "Cost price cannot be negative"),
  sellingPrice: z.coerce.number({ errorMap: () => ({ message: "Selling price is required" }) }).min(0, "Selling price cannot be negative"),
  taxVat: z.coerce.number().min(0).max(100).optional().default(0),
  unit: z.enum(UNITS).default("PIECE"),
  openingStock: z.coerce.number().int("Stock must be a whole number").min(0, "Stock cannot be negative").optional().default(0),
  openingCost: z.coerce.number().min(0).optional().default(0),
  warehouse: z.string().max(80).optional().or(z.literal("")),
  minStockAlert: z.coerce.number().int().min(0).optional().default(5),
  reorderQuantity: z.coerce.number().int().min(0).optional().default(0),
  trackImei: z.boolean().optional().default(false),
  defaultSupplier: z.string().uuid().optional().or(z.literal("")).nullable(),
  purchaseWarrantyMonths: z.coerce.number().int().min(0, "Warranty cannot be negative").optional().default(0),
  salesWarrantyMonths: z.coerce.number().int().min(0, "Warranty cannot be negative").optional().default(0),
  imageUrl: z.string().optional().or(z.literal("")).nullable(),
  status: z.enum(PRODUCT_STATUSES).default("ACTIVE"),
  tags: z.array(z.string().max(40)).max(20).optional().default([]),
}).refine((d) => d.sellingPrice >= d.costPrice, {
  message: "Selling price must be greater than or equal to cost price",
  path: ["sellingPrice"],
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
