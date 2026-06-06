"use client";

import { SelectHTMLAttributes, forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectInputProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  options: SelectOption[];
  placeholder?: string;
  containerClassName?: string;
}

export const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(
  ({ label, error, hint, required, options, placeholder, className, containerClassName, id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id || autoId;
    return (
      <div className={cn("space-y-1.5", containerClassName)}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-semibold text-foreground block">
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            aria-invalid={!!error}
            className={cn(
              "w-full pl-3.5 pr-10 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm appearance-none",
              "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
              "transition-all duration-150",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
              className
            )}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary pointer-events-none" />
        </div>
        {error ? (
          <p className="text-xs text-red-600 font-medium">{error}</p>
        ) : hint ? (
          <p className="text-xs text-secondary">{hint}</p>
        ) : null}
      </div>
    );
  }
);

SelectInput.displayName = "SelectInput";
