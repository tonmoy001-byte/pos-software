"use client";

import { InputHTMLAttributes, forwardRef, useId } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  description?: string;
  error?: string;
  containerClassName?: string;
}

export const CheckboxInput = forwardRef<HTMLInputElement, CheckboxInputProps>(
  ({ label, description, error, className, containerClassName, id, checked, onChange, ...props }, ref) => {
    const autoId = useId();
    const inputId = id || autoId;
    return (
      <div className={cn("space-y-1", containerClassName)}>
        <label htmlFor={inputId} className="flex items-start gap-3 cursor-pointer group">
          <span className="relative inline-flex items-center mt-0.5">
            <input
              ref={ref}
              id={inputId}
              type="checkbox"
              checked={checked}
              onChange={onChange}
              className="peer sr-only"
              {...props}
            />
            <span
              className={cn(
                "w-5 h-5 rounded border-2 border-border bg-background flex items-center justify-center transition-all",
                "peer-checked:bg-primary peer-checked:border-primary",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30 peer-focus-visible:ring-offset-1",
                "group-hover:border-primary/50",
                error && "border-red-500"
              )}
            >
              <Check className="w-3.5 h-3.5 text-white scale-0 peer-checked:scale-100 transition-transform" strokeWidth={3} />
            </span>
          </span>
          <span className="flex-1">
            <span className="text-sm font-semibold text-foreground block">{label}</span>
            {description && <span className="text-xs text-secondary block mt-0.5">{description}</span>}
          </span>
        </label>
        {error && <p className="text-xs text-red-600 font-medium ml-8">{error}</p>}
      </div>
    );
  }
);

CheckboxInput.displayName = "CheckboxInput";
