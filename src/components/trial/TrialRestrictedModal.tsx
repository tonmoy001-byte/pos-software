import { Lock, X, CreditCard } from "lucide-react";
import Link from "next/link";
import { Modal } from "@/components/ui/modal";

interface TrialRestrictedModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: string;
}

export function TrialRestrictedModal({ isOpen, onClose, action }: TrialRestrictedModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="flex flex-col items-center text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-background rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-6">
          <Lock className="w-8 h-8 text-amber-600" />
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          Action Restricted
        </h2>

        <p className="text-gray-600 mb-8">
          Your trial period does not include access to{" "}
          <span className="font-semibold text-gray-900">{action}</span>.
          Upgrade your plan to unlock this feature.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Link
            href="/settings"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-medium transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            Upgrade Plan
          </Link>

          <button
            onClick={onClose}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
