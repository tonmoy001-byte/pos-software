"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui";
import {
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface InstallmentPaymentModalProps {
  open: boolean;
  onClose: () => void;
  sale: any;
  nextInstallment: any;
  onPaymentComplete: (result: any) => void;
}

const paymentMethods = [
  { id: "CASH", label: "Cash", icon: Banknote },
  { id: "BKASH", label: "bKash", icon: Smartphone },
  { id: "NAGAD", label: "Nagad", icon: Smartphone },
  { id: "CARD", label: "Card", icon: CreditCard },
];

export function InstallmentPaymentModal({
  open,
  onClose,
  sale,
  nextInstallment,
  onPaymentComplete,
}: InstallmentPaymentModalProps) {
  const [method, setMethod] = useState("CASH");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!nextInstallment) return null;

  const isOverdue = new Date(nextInstallment.dueDate) < new Date();

  const handlePayInstallment = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/sales/${sale.id}/emi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installmentNo: nextInstallment.installmentNo,
          method,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onPaymentComplete(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePayAll = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/sales/${sale.id}/emi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payAll: true, method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onPaymentComplete(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const pendingCount =
    sale.emiSchedules?.filter((s: any) => s.status === "PENDING").length || 0;

  return (
    <Modal isOpen={open} onClose={onClose} title="Pay Installment" size="sm">
      <div className="space-y-4">
        {/* Installment Info */}
        <div className="bg-background rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-secondary">
              Installment #{nextInstallment.installmentNo} of {sale.emiMonths}
            </span>
            {isOverdue ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                Overdue
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                Due
              </span>
            )}
          </div>
          <div className="text-xs text-secondary mb-1">
            Due:{" "}
            {new Date(nextInstallment.dueDate).toLocaleDateString()}
          </div>
          <div className="text-2xl font-black text-foreground">
            {Number(nextInstallment.amount).toFixed(2)}
          </div>
        </div>

        {/* Payment Method */}
        <div>
          <label className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2 block">
            Payment Method
          </label>
          <div className="grid grid-cols-4 gap-2">
            {paymentMethods.map((pm) => {
              const Icon = pm.icon;
              return (
                <button
                  key={pm.id}
                  onClick={() => setMethod(pm.id)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                    method === pm.id
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-secondary hover:border-primary/50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px] font-bold">{pm.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-center gap-2 text-red-700 text-xs font-bold">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          <Button
            onClick={handlePayInstallment}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Pay Installment —{" "}
                {Number(nextInstallment.amount).toFixed(2)}
              </>
            )}
          </Button>

          {pendingCount > 1 && (
            <Button
              onClick={handlePayAll}
              disabled={loading}
              variant="secondary"
              className="w-full"
            >
              Pay All Remaining ({pendingCount} installments)
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
