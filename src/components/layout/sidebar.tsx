"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  Smartphone, 
  CreditCard,
  UserPlus,
  Wallet,
  TrendingUp,
  FileText,
  Settings,
  Calculator,
  ChevronDown,
  ChevronRight,
  Building2,
  LogOut
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";

const ALL_ROLES: string[] = ["ADMIN", "MANAGER", "CASHIER"];
const ADMIN_MANAGER: string[] = ["ADMIN", "MANAGER"];
const ADMIN_ONLY: string[] = ["ADMIN"];

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", roles: ALL_ROLES },
  { 
    icon: ShoppingCart, 
    label: "Sales", 
    href: "/sales", 
    roles: ALL_ROLES,
    submenu: [
      { label: "All Sale", href: "/sales/regular", roles: ALL_ROLES },
      { label: "Advance Order", href: "/sales/advance", roles: ALL_ROLES },
      { label: "Due Sale", href: "/sales/due", roles: ADMIN_MANAGER },
      { label: "Exchange Sale", href: "/sales/exchange", roles: ADMIN_MANAGER },
      { label: "Repair Sale", href: "/sales/repair", roles: ADMIN_MANAGER },
      { label: "Online Sale", href: "/sales/online", roles: ADMIN_MANAGER },
      { label: "Wholesale Sale", href: "/sales/wholesale", roles: ADMIN_MANAGER },
      { label: "Return & Refund", href: "/sales/return", roles: ADMIN_MANAGER },
    ]
  },
  { icon: Package, label: "Products", href: "/products", roles: ALL_ROLES },
  { icon: CreditCard, label: "EMI", href: "/emi", roles: ADMIN_MANAGER },
  { icon: Users, label: "Customers", href: "/customers", roles: ALL_ROLES },
  { icon: Wallet, label: "Hawlat", href: "/loans", roles: ADMIN_MANAGER },
  { icon: Calculator, label: "Suppliers", href: "/suppliers", roles: ADMIN_MANAGER },
  { icon: Smartphone, label: "Second Hand", href: "/second-hand", roles: ALL_ROLES },
  { icon: FileText, label: "Reports", href: "/reports", roles: ADMIN_MANAGER },
  { icon: UserPlus, label: "Users", href: "/users", roles: ADMIN_ONLY },
  { 
    icon: Settings, 
    label: "Settings", 
    href: "/settings", 
    roles: ADMIN_ONLY,
    submenu: [
      { label: "Store Settings", href: "/settings/store", roles: ADMIN_ONLY },
      { label: "Invoice Settings", href: "/settings/invoice", roles: ADMIN_ONLY },
      { label: "Barcode Settings", href: "/settings/barcode", roles: ADMIN_ONLY },
    ]
  },
  {
    icon: Building2,
    label: "Admin Panel",
    href: "/admin",
    roles: ["SUPER_ADMIN"],
    submenu: [
      { label: "Overview", href: "/admin", roles: ["SUPER_ADMIN"] },
      { label: "Tenants", href: "/admin/tenants", roles: ["SUPER_ADMIN"] },
      { label: "Users", href: "/admin/users", roles: ["SUPER_ADMIN"] },
      { label: "Plans", href: "/admin/plans", roles: ["SUPER_ADMIN"] },
      { label: "Subscriptions", href: "/admin/subscriptions", roles: ["SUPER_ADMIN"] },
    ]
  },
];

export function Sidebar({ userRole, userId, storeName }: { userRole: string; userId?: string; storeName?: string }) {
  const pathname = usePathname();
  const [expandedMenu, setExpandedMenu] = useState<string | null>("/sales");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const superAdminIds = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPER_ADMIN_IDS) || "";
  const isSuperAdmin = userId ? superAdminIds.split(",").includes(userId) : false;

  const toggleSubmenu = (href: string) => {
    setExpandedMenu(expandedMenu === href ? null : href);
  };

  return (
    <div className="w-64 h-screen bg-surface border-r border-border flex flex-col">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary tracking-tight truncate">{storeName || "RetailOS"}</h1>
        <p className="text-xs text-secondary font-medium">Retail Management</p>
      </div>

      <div className="px-4 mb-4">
        <Link
          href="/sales/pos"
          className={cn(
            "flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold transition-all duration-200",
            pathname === "/sales/pos"
              ? "bg-primary text-white shadow-lg shadow-primary/20" 
              : "bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20"
          )}
        >
          <ShoppingCart className="w-5 h-5" />
          POS
        </Link>
      </div>
      
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {menuItems.filter(item => {
  if (item.roles.includes("SUPER_ADMIN")) return isSuperAdmin;
  return item.roles.includes(userRole);
}).map((item) => {
          const isActive = pathname === item.href;
          const hasSubmenu = item.submenu && item.submenu.length > 0;
          const isExpanded = expandedMenu === item.href;

          return (
            <div key={item.href}>
              {hasSubmenu ? (
                <>
                  <button
                    onClick={() => toggleSubmenu(item.href)}
                    className={cn(
                      "flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all duration-200 group",
                      isActive || pathname.startsWith(item.href + "/")
                        ? "bg-primary text-white shadow-lg shadow-primary/20" 
                        : "text-secondary hover:bg-background hover:text-primary"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={cn("w-5 h-5", isActive || pathname.startsWith(item.href + "/") ? "text-white" : "group-hover:text-primary")} />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  {isExpanded && (
                    <div className="ml-4 mt-1 space-y-1">
                      {item.submenu!.filter(sub => {
  if (sub.roles.includes("SUPER_ADMIN")) return isSuperAdmin;
  return sub.roles.includes(userRole);
}).map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={cn(
                            "flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all",
                            pathname === sub.href
                              ? "bg-primary/10 text-primary font-medium" 
                              : "text-secondary hover:bg-background hover:text-primary"
                          )}
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                    isActive 
                      ? "bg-primary text-white shadow-lg shadow-primary/20" 
                      : "text-secondary hover:bg-background hover:text-primary"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "group-hover:text-primary")} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-4 py-2">
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 w-full text-secondary hover:bg-background hover:text-primary"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>

      <Modal isOpen={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} title="Confirm Logout" size="sm">
        <p className="text-sm text-secondary mb-6">Are you sure you want to log out?</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setShowLogoutConfirm(false)}
            className="px-4 py-2 rounded-xl text-sm font-medium text-secondary hover:bg-background transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            Logout
          </button>
        </div>
      </Modal>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
            {userRole[0]}
          </div>
          <div>
            <p className="text-sm font-bold text-foreground capitalize">{userRole.toLowerCase()}</p>
            <p className="text-xs text-secondary">Store Access</p>
          </div>
        </div>
      </div>
    </div>
  );
}