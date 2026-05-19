import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { prisma } from "@/lib/prisma";

function isSqlite(): boolean {
  const url = process.env.DATABASE_URL || "file:./prisma/dev.db";
  return url.startsWith("file:");
}

function getDbPath(): string {
  const url = process.env.DATABASE_URL || "file:./prisma/dev.db";
  const filePath = url.replace("file:", "");
  return path.resolve(filePath);
}

export async function createBackup(): Promise<{ filePath: string; size: number }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  const projectRoot = path.resolve(import.meta.dirname || process.cwd(), "..", "..");
  const backupDir = path.join(projectRoot, "prisma", "backups");
  fs.mkdirSync(backupDir, { recursive: true });

  let backupPath: string;

  if (isSqlite()) {
    const dbPath = getDbPath();
    backupPath = path.join(backupDir, `backup-${timestamp}.db`);
    await prisma.$executeRawUnsafe(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
  } else {
    backupPath = path.join(backupDir, `backup-${timestamp}.sql`);
    const url = new URL(process.env.DATABASE_URL || "");
    const dbName = url.pathname.replace(/^\//, "");
    execSync(
      `pg_dump --dbname="${process.env.DATABASE_URL}" --file="${backupPath}" --format=plain`,
      { stdio: "pipe" }
    );
  }

  const stat = fs.statSync(backupPath);
  return { filePath: backupPath, size: stat.size };
}

export function listBackups(): { name: string; size: number; date: Date }[] {
  const projectRoot = path.resolve(process.cwd(), "prisma");
  const backupDir = path.join(projectRoot, "backups");
  if (!fs.existsSync(backupDir)) return [];

  const ext = isSqlite() ? ".db" : ".sql";
  return fs.readdirSync(backupDir)
    .filter(f => f.endsWith(ext))
    .map(name => {
      const stat = fs.statSync(path.join(backupDir, name));
      return { name, size: stat.size, date: stat.mtime };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}
