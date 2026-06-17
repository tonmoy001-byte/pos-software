"use client";

import { Smartphone, Loader2 } from "lucide-react";

export function FullScreenLoader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
        <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
          <Smartphone className="text-white w-8 h-8" />
        </div>
        <div className="flex items-center gap-2">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <span className="text-sm text-secondary font-medium">Loading...</span>
        </div>
      </div>
    </div>
  );
}
