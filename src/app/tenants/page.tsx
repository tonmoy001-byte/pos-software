"use client";

import { useEffect, useState } from "react";

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/tenants")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setTenants(data);
        setLoading(false);
      });
  }, []);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        setTenants(tenants.map(t => t.id === id ? { ...t, status: newStatus } : t));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8">Loading tenants...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Tenant Management</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-6 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Store Name</th>
              <th className="px-6 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              <th className="px-6 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {tenants.map((tenant) => (
              <tr key={tenant.id}>
                <td className="px-6 py-4 whitespace-nowrap">{tenant.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{new Date(tenant.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                    ${tenant.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                      tenant.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                    {tenant.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap space-x-2">
                  {tenant.status === 'PENDING' && (
                    <button
                      onClick={() => handleStatusChange(tenant.id, 'ACTIVE')}
                      className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                    >
                      Approve
                    </button>
                  )}
                  {tenant.status === 'ACTIVE' && (
                    <button
                      onClick={() => handleStatusChange(tenant.id, 'SUSPENDED')}
                      className="text-red-600 hover:text-red-900 text-sm font-medium"
                    >
                      Suspend
                    </button>
                  )}
                  {tenant.status === 'SUSPENDED' && (
                    <button
                      onClick={() => handleStatusChange(tenant.id, 'ACTIVE')}
                      className="text-green-600 hover:text-green-900 text-sm font-medium"
                    >
                      Activate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
