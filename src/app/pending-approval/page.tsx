export default function PendingApprovalPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <h1 className="text-2xl font-bold mb-4">Account Pending Approval</h1>
      <p className="text-gray-600 mb-6">
        Your store account is currently being reviewed. You will gain access once an administrator approves your registration.
      </p>
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-md text-blue-700">
        Contact support if you believe this is an error.
      </div>
      <a href="/api/auth/signout" className="mt-8 text-sm text-gray-500 hover:underline">
        Sign out
      </a>
    </div>
  );
}
