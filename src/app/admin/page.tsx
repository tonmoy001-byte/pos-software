"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Building2, Users, CreditCard, AlertTriangle, TrendingUp, Plus } from "lucide-react";
import { safeFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [recentStores, setRecentStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [storesData, subsData] = await Promise.all([
          safeFetch<any>("/api/admin/stores?limit=5"),
          safeFetch<any>("/api/admin/subscriptions?limit=5"),
        ]);

        const stores = storesData.stores || [];
        const subscriptions = subsData.subscriptions || [];

        setRecentStores(stores);
        setStats({
          totalStores: storesData.total || 0,
          activeStores: stores.filter((s: any) => s.status === "active").length,
          suspendedStores: stores.filter((s: any) => s.status === "suspended").length,
          trialStores: stores.filter((s: any) => s.status === "trial").length,
          pendingApproval: stores.filter((s: any) => s.status === "pending_approval").length,
          activeSubscriptions: subscriptions.filter((s: any) => s.status === "active" || s.status === "trial").length,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-400 text-center py-12">Loading dashboard...</p>
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Stores",
      value: stats?.totalStores || 0,
      icon: Building2,
      color: "bg-blue-50 text-blue-700",
      iconColor: "text-blue-600",
    },
    {
      label: "Active",
      value: stats?.activeStores || 0,
      icon: TrendingUp,
      color: "bg-green-50 text-green-700",
      iconColor: "text-green-600",
    },
    {
      label: "Suspended",
      value: stats?.suspendedStores || 0,
      icon: AlertTriangle,
      color: "bg-red-50 text-red-700",
      iconColor: "text-red-600",
    },
    {
      label: "Pending Approval",
      value: stats?.pendingApproval || 0,
      icon: Users,
      color: "bg-yellow-50 text-yellow-700",
      iconColor: "text-yellow-600",
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor and manage your SaaS platform</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{card.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-lg ${card.color} flex items-center justify-center`}>
                <card.icon className={`w-6 h-6 ${card.iconColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent signups */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent Stores</h2>
            <Link
              href="/admin/tenants"
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentStores.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">No stores yet</p>
            ) : (
              recentStores.map((store: any) => (
                <Link
                  key={store.id}
                  href={`/admin/tenants/${store.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{store.name}</p>
                    <p className="text-xs text-gray-400">{store.users?.[0]?.name || "No owner"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      store.status === "active" ? "bg-green-50 text-green-700" :
                      store.status === "suspended" ? "bg-red-50 text-red-700" :
                      store.status === "pending_approval" ? "bg-yellow-50 text-yellow-700" :
                      "bg-gray-50 text-gray-600"
                    }`}>
                      {store.status.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(store.createdAt)}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="p-5 space-y-3">
            <Link
              href="/admin/tenants"
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors"
            >
              <Building2 className="w-5 h-5 text-indigo-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">Manage Tenants</p>
                <p className="text-xs text-gray-400">View, suspend, or approve stores</p>
              </div>
            </Link>
            <Link
              href="/admin/plans"
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors"
            >
              <CreditCard className="w-5 h-5 text-indigo-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">Manage Plans</p>
                <p className="text-xs text-gray-400">Create and edit subscription plans</p>
              </div>
            </Link>
            <Link
              href="/admin/users"
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors"
            >
              <Users className="w-5 h-5 text-indigo-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">Manage Users</p>
                <p className="text-xs text-gray-400">View all users across stores</p>
              </div>
            </Link>
            <Link
              href="/admin/subscriptions"
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors"
            >
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">Subscriptions</p>
                <p className="text-xs text-gray-400">Monitor and manage subscriptions</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
