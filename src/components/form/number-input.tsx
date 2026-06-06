"use client";

import { InputHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type" | "onChange" | "value"> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  prefix?: string;
  suffix?: string;
  value?: number | string | "";
  onChange?: (value: number | "") => void;
  containerClassName?: string;
  min?: number;
  max?: number;
  step?: number;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ label, error, hint, required, prefix, suffix, className, containerClassName, id, value, onChange, min, max, step, ...props }, ref) => {
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
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-secondary font-medium pointer-events-none">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            type="number"
            inputMode="decimal"
            value={value ?? ""}
            min={min}
            max={max}
            step={step ?? "any"}
            aria-invalid={!!error}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                onChange?.("");
              } else {
                const n = Number(raw);
                onChange?.(Number.isFinite(n) ? n : "");
              }
            }}
            className={cn(
              "w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm",
              "placeholder:text-secondary/60",
              "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
              "transition-all duration-150",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
              prefix && "pl-12",
              suffix && "pr-16",
              error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
              className
            )}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-secondary font-medium pointer-events-none">
              {suffix}
            </span>
          )}
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

NumberInput.displayName = "NumberInput";
