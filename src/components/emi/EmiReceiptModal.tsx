"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui";
import { Printer } from "lucide-react";

interface EmiReceiptModalProps {
  open: boolean;
  onClose: () => void;
  sale: any;
}

export function EmiReceiptModal({ open, onClose, sale }: EmiReceiptModalProps) {
  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>EMI Receipt</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm" id="emi-receipt">
          {/* Store Header */}
          <div className="text-center border-b pb-4">
            <h2 className="text-lg font-black">
              {sale.storeName || "Store"}
            </h2>
            <p className="text-xs text-secondary">{sale.storePhone || ""}</p>
          </div>

          {/* Invoice Info */}
          <div className="border-b pb-3">
            <div className="flex justify-between">
              <span className="font-bold">Invoice:</span>
              <span>{sale.invoiceNumber || sale.invoiceId}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Date:</span>
              <span>
                {new Date(sale.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Customer */}
          <div className="border-b pb-3">
            <div className="flex justify-between">
              <span className="font-bold">Customer:</span>
              <span>{sale.customer?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Phone:</span>
              <span>{sale.customer?.phone}</span>
            </div>
          </div>

          {/* Products */}
          <div className="border-b pb-3">
            <div className="grid grid-cols-3 font-bold text-xs text-secondary uppercase mb-2">
              <span>Product</span>
              <span className="text-center">Qty</span>
              <span className="text-right">Total</span>
            </div>
            {sale.items?.map((item: any, idx: number) => (
              <div key={idx} className="grid grid-cols-3 text-sm">
                <span>{item.product?.name || item.name}</span>
                <span className="text-center">{item.quantity}</span>
                <span className="text-right">
                  {Number(item.total || item.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-b pb-3 space-y-1">
            {Number(sale.discount) > 0 && (
              <div className="flex justify-between text-secondary">
                <span>Discount</span>
                <span>-{Number(sale.discount).toFixed(2)}</span>
              </div>
            )}
            {Number(sale.interestRate) > 0 && (
              <div className="flex justify-between text-secondary">
                <span>Interest ({sale.interestRate}%)</span>
                <span>
                  +
                  {(
                    (Number(sale.totalAmount) - Number(sale.downPayment)) *
                    Number(sale.interestRate) /
                    100
                  ).toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between font-black text-lg">
              <span>Total</span>
              <span>{Number(sale.totalAmount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Down Payment</span>
              <span>{Number(sale.downPayment).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Monthly EMI</span>
              <span>{Number(sale.monthlyAmount).toFixed(2)}</span>
            </div>
          </div>

          {/* Installment Schedule */}
          <div className="border-b pb-3">
            <h3 className="font-black text-xs uppercase tracking-widest mb-2">
              Installment Schedule
            </h3>
            <div className="grid grid-cols-4 font-bold text-[10px] text-secondary uppercase mb-1">
              <span>#</span>
              <span>Due</span>
              <span>Amount</span>
              <span className="text-right">Status</span>
            </div>
            {sale.emiSchedules?.map((s: any) => (
              <div key={s.id} className="grid grid-cols-4 text-xs">
                <span>{s.installmentNo}</span>
                <span>
                  {new Date(s.dueDate).toLocaleDateString()}
                </span>
                <span>{Number(s.amount).toFixed(2)}</span>
                <span
                  className={`text-right font-bold ${
                    s.status === "PAID"
                      ? "text-green-600"
                      : s.status === "OVERDUE"
                      ? "text-red-600"
                      : "text-yellow-600"
                  }`}
                >
                  {s.status}
                </span>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="font-bold">Total</span>
              <span>{Number(sale.totalAmount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Paid</span>
              <span>{Number(sale.paidAmount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Due</span>
              <span>{Number(sale.dueAmount).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <Button onClick={handlePrint} className="w-full mt-4">
          <Printer className="w-4 h-4 mr-2" />
          Print Receipt
        </Button>
      </DialogContent>
    </Dialog>
  );
}
