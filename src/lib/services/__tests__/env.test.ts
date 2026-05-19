import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("env config", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("getDatabaseUrl returns file URL by default", async () => {
    delete process.env.DATABASE_URL;
    const { getDatabaseUrl } = await import("../../env");
    expect(getDatabaseUrl()).toBe("file:./prisma/dev.db");
  });

  it("getDatabaseType detects sqlite", async () => {
    process.env.DATABASE_URL = "file:./prisma/dev.db";
    const { getDatabaseType } = await import("../../env");
    expect(getDatabaseType()).toBe("sqlite");
  });

  it("getDatabaseType detects postgresql", async () => {
    process.env.DATABASE_URL = "postgresql://localhost/mydb";
    const { getDatabaseType } = await import("../../env");
    expect(getDatabaseType()).toBe("postgresql");
  });

  it("getRateLimitDefault falls back to 60", async () => {
    delete process.env.RATE_LIMIT_DEFAULT;
    const { getRateLimitDefault } = await import("../../env");
    expect(getRateLimitDefault()).toBe(60);
  });

  it("isProduction returns false by default", async () => {
    process.env.NODE_ENV = "development";
    const { isProduction } = await import("../../env");
    expect(isProduction()).toBe(false);
  });

  it("isProduction returns true when NODE_ENV=production", async () => {
    process.env.NODE_ENV = "production";
    const { isProduction } = await import("../../env");
    expect(isProduction()).toBe(true);
  });
});
