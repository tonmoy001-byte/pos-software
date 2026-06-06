"use client";

import { InputHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  containerClassName?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, error, hint, required, className, containerClassName, id, ...props }, ref) => {
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
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          className={cn(
            "w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm",
            "placeholder:text-secondary/60",
            "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
            "transition-all duration-150",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
            className
          )}
          {...props}
        />
        {error ? (
          <p className="text-xs text-red-600 font-medium">{error}</p>
        ) : hint ? (
          <p className="text-xs text-secondary">{hint}</p>
        ) : null}
      </div>
    );
  }
);

TextInput.displayName = "TextInput";
