function env(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required env variable: ${name}`);
  }
  return value;
}

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL || "file:./prisma/dev.db";
}

export function getDatabaseType(): "sqlite" | "postgresql" {
  const url = getDatabaseUrl();
  return url.startsWith("postgresql") ? "postgresql" : "sqlite";
}

export function getNextAuthSecret(): string {
  return env("NEXTAUTH_SECRET");
}

export function getNextAuthUrl(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

export function getCronApiKey(): string | undefined {
  return process.env.CRON_API_KEY;
}

export function getRateLimitDefault(): number {
  return Number(process.env.RATE_LIMIT_DEFAULT) || 60;
}

export function getRateLimitStrict(): number {
  return Number(process.env.RATE_LIMIT_STRICT) || 10;
}

export function getRateLimitAuth(): number {
  return Number(process.env.RATE_LIMIT_AUTH) || 5;
}

export function getLogLevel(): string {
  return process.env.LOG_LEVEL || "info";
}

export function getBackupDir(): string {
  return process.env.BACKUP_DIR || "./prisma/backups";
}

export function getSuperAdminIds(): string[] {
  return (process.env.SUPER_ADMIN_IDS || "").split(",").filter(Boolean);
}

export function getEncryptionStoreKey(): string | undefined {
  return process.env.ENCRYPTION_STORE_KEY;
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
