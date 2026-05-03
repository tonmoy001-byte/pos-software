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
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", roles: ["ADMIN", "STAFF"] },
  { 
    icon: ShoppingCart, 
    label: "Sales", 
    href: "/sales", 
    roles: ["ADMIN", "STAFF"],
    submenu: [
      { label: "POS", href: "/sales/pos", roles: ["ADMIN", "STAFF"] },
      { label: "All Sale", href: "/sales/regular", roles: ["ADMIN", "STAFF"] },
      { label: "Advance Order", href: "/sales/advance", roles: ["ADMIN", "STAFF"] },
      { label: "Due Sale", href: "/sales/due", roles: ["ADMIN", "STAFF"] },
      { label: "EMI Sale", href: "/sales/emi", roles: ["ADMIN", "STAFF"] },
      { label: "Exchange Sale", href: "/sales/exchange", roles: ["ADMIN", "STAFF"] },
      { label: "Repair Sale", href: "/sales/repair", roles: ["ADMIN", "STAFF"] },
      { label: "Online Sale", href: "/sales/online", roles: ["ADMIN", "STAFF"] },
      { label: "Wholesale Sale", href: "/sales/wholesale", roles: ["ADMIN", "STAFF"] },
      { label: "Return & Refund", href: "/sales/return", roles: ["ADMIN", "STAFF"] },
    ]
  },
  { icon: Package, label: "Inventory", href: "/inventory", roles: ["ADMIN", "STAFF"] },
  { icon: Users, label: "Customers", href: "/customers", roles: ["ADMIN", "STAFF"] },
  { icon: Wallet, label: "Hawlat", href: "/loans", roles: ["ADMIN", "STAFF"] },
  { icon: Calculator, label: "Suppliers", href: "/suppliers", roles: ["ADMIN"] },
  { icon: Smartphone, label: "Second Hand", href: "/second-hand", roles: ["ADMIN", "STAFF"] },
  { icon: TrendingUp, label: "Capital", href: "/capital", roles: ["ADMIN"] },
  { icon: FileText, label: "Reports", href: "/reports", roles: ["ADMIN"] },
  { icon: UserPlus, label: "Users", href: "/users", roles: ["ADMIN"] },
  { 
    icon: Settings, 
    label: "Settings", 
    href: "/settings", 
    roles: ["ADMIN"],
    submenu: [
      { label: "Store Settings", href: "/settings/store", roles: ["ADMIN"] },
      { label: "Invoice Settings", href: "/settings/invoice", roles: ["ADMIN"] },
    ]
  },
];

export function Sidebar({ userRole }: { userRole: string }) {
  const pathname = usePathname();
  const [expandedMenu, setExpandedMenu] = useState<string | null>("/sales");

  const toggleSubmenu = (href: string) => {
    setExpandedMenu(expandedMenu === href ? null : href);
  };

  return (
    <div className="w-64 h-screen bg-surface border-r border-border flex flex-col">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary tracking-tight">Dinex POS</h1>
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
        {menuItems.filter(item => item.roles.includes(userRole)).map((item) => {
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
                      {item.submenu!.filter(sub => sub.roles.includes(userRole)).map((sub) => (
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