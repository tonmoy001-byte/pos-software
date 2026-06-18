import { AlertTriangle, Mail, CreditCard, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";

interface TrialExpiredModalProps {
  isOpen: boolean;
  trialEndsAt: Date;
}

export function TrialExpiredModal({ isOpen, trialEndsAt }: TrialExpiredModalProps) {
  if (!isOpen) return null;

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(trialEndsAt));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Trial Period Ended
          </h2>

          <p className="text-gray-600 mb-2">
            Your trial period has expired on{" "}
            <span className="font-semibold text-gray-900">{formattedDate}</span>.
          </p>
          <p className="text-gray-500 text-sm mb-8">
            To continue using the POS system, please contact your administrator
            to upgrade your plan or sign out.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <a
              href="mailto:support@example.com"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
            >
              <Mail className="w-4 h-4" />
              Contact Admin
            </a>

            <Link
              href="/settings"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              Upgrade Plan
            </Link>

            <button
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
