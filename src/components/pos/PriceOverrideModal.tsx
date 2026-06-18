"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { formatCurrency } from "@/lib/utils";

interface PriceOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newPrice: number) => void;
  productName: string;
  originalPrice: number;
  currency?: string;
}

export function PriceOverrideModal({
  isOpen,
  onClose,
  onConfirm,
  productName,
  originalPrice,
  currency,
}: PriceOverrideModalProps) {
  const [newPrice, setNewPrice] = useState(originalPrice.toString());

  useEffect(() => {
    if (isOpen) {
      setNewPrice(originalPrice.toString());
    }
  }, [isOpen, originalPrice]);

  const handleConfirm = () => {
    const parsed = Number(newPrice);
    if (!isNaN(parsed) && parsed > 0) {
      onConfirm(parsed);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleConfirm();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Override Price" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-secondary truncate">{productName}</p>

        <div>
          <label className="block text-xs font-medium text-secondary mb-1">
            Original Price
          </label>
          <p className="text-lg font-bold text-foreground">
            {formatCurrency(originalPrice)}
          </p>
        </div>

        <div>
          <label htmlFor="override-price" className="block text-xs font-medium text-secondary mb-1">
            New Price
          </label>
          <input
            id="override-price"
            type="number"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:border-primary transition-colors"
            autoFocus
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-border rounded-xl font-bold text-secondary hover:bg-background transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl font-bold hover:opacity-90 transition-opacity"
          >
            Confirm
          </button>
        </div>
      </div>
    </Modal>
  );
}
