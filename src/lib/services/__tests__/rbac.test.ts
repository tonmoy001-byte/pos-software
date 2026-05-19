import { describe, it, expect } from "vitest";
import { hasPermission, hasAnyPermission, hasAllPermissions, getPermissions, getRoleHierarchy, canManageRole } from "../rbac";

describe("RBAC", () => {
  describe("getPermissions", () => {
    it("admin has all permissions", () => {
      const perms = getPermissions("ADMIN");
      expect(perms).toContain("sale:create");
      expect(perms).toContain("product:delete");
      expect(perms).toContain("store:settings");
    });

    it("manager has most permissions but not admin", () => {
      const perms = getPermissions("MANAGER");
      expect(perms).toContain("sale:create");
      expect(perms).toContain("product:update");
      expect(perms).not.toContain("store:settings");
    });

    it("cashier has limited permissions", () => {
      const perms = getPermissions("CASHIER");
      expect(perms).toContain("sale:create");
      expect(perms).not.toContain("sale:refund");
      expect(perms).not.toContain("product:delete");
    });
  });

  describe("hasPermission", () => {
    it("admin can access any permission", () => {
      expect(hasPermission("ADMIN", "sale:refund")).toBe(true);
    });

    it("cashier cannot refund", () => {
      expect(hasPermission("CASHIER", "sale:refund")).toBe(false);
    });
  });

  describe("hasAnyPermission", () => {
    it("returns true if any permission matches", () => {
      expect(hasAnyPermission("CASHIER", ["sale:refund", "sale:create"])).toBe(true);
    });

    it("returns false if none match", () => {
      expect(hasAnyPermission("CASHIER", ["sale:refund", "store:settings"])).toBe(false);
    });
  });

  describe("hasAllPermissions", () => {
    it("returns true only if all match", () => {
      expect(hasAllPermissions("MANAGER", ["product:view", "product:update"])).toBe(true);
    });

    it("returns false if any missing", () => {
      expect(hasAllPermissions("MANAGER", ["product:view", "store:settings"])).toBe(false);
    });
  });

  describe("getRoleHierarchy", () => {
    it("returns hierarchy object", () => {
      const h = getRoleHierarchy();
      expect(h.ADMIN).toBe(3);
      expect(h.MANAGER).toBe(2);
      expect(h.CASHIER).toBe(1);
    });
  });

  describe("canManageRole", () => {
    it("admin can manage any role", () => {
      expect(canManageRole("ADMIN", "MANAGER")).toBe(true);
    });

    it("manager cannot manage admin", () => {
      expect(canManageRole("MANAGER", "ADMIN")).toBe(false);
    });

    it("manager can manage cashier", () => {
      expect(canManageRole("MANAGER", "CASHIER")).toBe(true);
    });
  });
});
