import type { Role } from "@prisma/client";

export type Permission =
  | "sale:create"
  | "sale:view"
  | "sale:refund"
  | "sale:cancel"
  | "sale:view_all"
  | "product:create"
  | "product:update"
  | "product:delete"
  | "product:view"
  | "customer:create"
  | "customer:update"
  | "customer:delete"
  | "customer:view"
  | "supplier:create"
  | "supplier:update"
  | "supplier:delete"
  | "supplier:view"
  | "supplier:due_adjust"
  | "loan:create"
  | "loan:update"
  | "loan:view"
  | "expense:create"
  | "expense:view"
  | "expense:delete"
  | "transaction:create"
  | "transaction:view"
  | "transaction:refund"
  | "report:view"
  | "report:view_all"
  | "cash:opening"
  | "cash:closing"
  | "cash:view"
  | "secondhand:create"
  | "secondhand:view"
  | "secondhand:edit"
  | "document:view"
  | "document:upload"
  | "user:create"
  | "user:update"
  | "user:view"
  | "user:delete"
  | "store:settings"
  | "store:view_all";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    "sale:create", "sale:view", "sale:refund", "sale:cancel", "sale:view_all",
    "product:create", "product:update", "product:delete", "product:view",
    "customer:create", "customer:update", "customer:delete", "customer:view",
    "supplier:create", "supplier:update", "supplier:delete", "supplier:view", "supplier:due_adjust",
    "loan:create", "loan:update", "loan:view",
    "expense:create", "expense:view", "expense:delete",
    "transaction:create", "transaction:view", "transaction:refund",
    "report:view", "report:view_all",
    "cash:opening", "cash:closing", "cash:view",
    "secondhand:create", "secondhand:view", "secondhand:edit",
    "document:view", "document:upload",
    "user:create", "user:update", "user:view", "user:delete",
    "store:settings", "store:view_all"
  ],
  MANAGER: [
    "sale:create", "sale:view", "sale:refund", "sale:cancel", "sale:view_all",
    "product:create", "product:update", "product:delete", "product:view",
    "customer:create", "customer:update", "customer:view",
    "supplier:create", "supplier:update", "supplier:delete", "supplier:view", "supplier:due_adjust",
    "loan:create", "loan:update", "loan:view",
    "expense:create", "expense:view",
    "transaction:create", "transaction:view", "transaction:refund",
    "report:view",
    "cash:opening", "cash:closing", "cash:view",
    "secondhand:create", "secondhand:view",
    "document:view", "document:upload"
  ],
  CASHIER: [
    "sale:create", "sale:view",
    "product:view",
    "customer:create", "customer:view",
    "expense:create",
    "transaction:view",
    "cash:view",
    "secondhand:view"
  ]
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}

export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(role, p));
}

export function getPermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function getRoleHierarchy(): Record<Role, number> {
  return {
    ADMIN: 3,
    MANAGER: 2,
    CASHIER: 1
  };
}

export function canManageRole(byRole: Role, targetRole: Role): boolean {
  const hierarchy = getRoleHierarchy();
  return hierarchy[byRole] > hierarchy[targetRole];
}

export interface AccessCheck {
  allowed: boolean;
  reason?: string;
}

export function checkAccess(role: Role, permission: Permission): AccessCheck {
  if (hasPermission(role, permission)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `Permission denied: ${permission} required for ${role} role`
  };
}