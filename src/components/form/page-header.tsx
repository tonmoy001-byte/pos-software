"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6", className)}>
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-secondary mb-2 flex-wrap">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-primary transition-colors font-medium">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground font-semibold">{crumb.label}</span>
                )}
                {i < breadcrumbs.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-secondary/60" />}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
