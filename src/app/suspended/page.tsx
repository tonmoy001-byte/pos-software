import { Shield, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function SuspendedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-10 h-10 text-red-600" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Account Suspended</h1>
          <p className="text-gray-500 mt-2">
            Your store account has been suspended. You no longer have access to this application.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 text-left space-y-3">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">Why was my account suspended?</p>
              <p className="text-sm text-gray-500">
                Possible reasons include payment issues, terms of service violations, or administrative action.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">What can I do?</p>
              <p className="text-sm text-gray-500">
                Please contact your system administrator or support team for assistance.
              </p>
            </div>
          </div>
        </div>

        <Link
          href="/auth/signin"
          className="inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
