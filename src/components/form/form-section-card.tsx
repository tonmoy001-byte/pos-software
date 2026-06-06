"use client";

import { HTMLAttributes } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FormSectionCardProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}

export function FormSectionCard({ title, description, icon: Icon, children, className, ...props }: FormSectionCardProps) {
  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-xl shadow-sm",
        "p-5 md:p-6",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/60">
        {Icon && (
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-base md:text-lg font-bold text-foreground leading-tight">{title}</h2>
          {description && <p className="text-xs text-secondary mt-0.5 leading-relaxed">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
