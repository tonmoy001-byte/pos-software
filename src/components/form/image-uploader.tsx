"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Upload, X, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ImageUploaderProps {
  label?: string;
  value?: string | null;
  onChange: (url: string | null) => void;
  error?: string;
  maxSizeMB?: number;
  acceptedTypes?: string[];
  uploadEndpoint?: string;
}

const DEFAULT_MAX_SIZE = 2;
const DEFAULT_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function ImageUploader({
  label = "Product Image",
  value,
  onChange,
  error,
  maxSizeMB = DEFAULT_MAX_SIZE,
  acceptedTypes = DEFAULT_TYPES,
  uploadEndpoint = "/api/products/upload",
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploadError(null);

    if (!acceptedTypes.includes(file.type)) {
      setUploadError(`File type not allowed. Accepted: ${acceptedTypes.map(t => t.split("/")[1].toUpperCase()).join(", ")}`);
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setUploadError(`File too large. Max size: ${maxSizeMB}MB`);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(uploadEndpoint, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onChange(data.url);
    } catch (e: any) {
      setUploadError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-foreground block">{label}</label>
      {value ? (
        <div className="relative border-2 border-dashed border-border rounded-xl overflow-hidden bg-background aspect-video flex items-center justify-center group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Product preview" className="object-contain max-h-80 w-full" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Remove image"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
          className={cn(
            "border-2 border-dashed rounded-xl p-6 md:p-8 text-center cursor-pointer transition-all",
            "flex flex-col items-center justify-center gap-3 min-h-[220px]",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border bg-background hover:border-primary/50 hover:bg-primary/5",
            (error || uploadError) && "border-red-500"
          )}
        >
          {uploading ? (
            <>
              <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-secondary">Uploading...</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                {isDragging ? <ImageIcon className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Drag &amp; drop image here</p>
                <p className="text-xs text-secondary mt-1">or</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
              >
                Choose Image
              </button>
              <p className="text-xs text-secondary">
                {acceptedTypes.map(t => t.split("/")[1].toUpperCase()).join(", ")}. Max size {maxSizeMB}MB.
              </p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={acceptedTypes.join(",")}
            onChange={onSelect}
            className="hidden"
          />
        </div>
      )}
      {uploadError && <p className="text-xs text-red-600 font-medium">{uploadError}</p>}
      {error && !uploadError && <p className="text-xs text-red-600 font-medium">{error}</p>}
    </div>
  );
}
