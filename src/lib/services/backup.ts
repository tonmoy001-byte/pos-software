import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { prisma } from "@/lib/prisma";

const execAsync = promisify(exec);

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
  await fs.mkdir(backupDir, { recursive: true });

  let backupPath: string;

  if (isSqlite()) {
    const dbPath = getDbPath();
    backupPath = path.join(backupDir, `backup-${timestamp}.db`);
    await prisma.$executeRawUnsafe(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
  } else {
    backupPath = path.join(backupDir, `backup-${timestamp}.sql`);
    const url = new URL(process.env.DATABASE_URL || "");
    const dbName = url.pathname.replace(/^\//, "");
    await execAsync(
      `pg_dump --dbname="${process.env.DATABASE_URL}" --file="${backupPath}" --format=plain`
    );
  }

  const stat = await fs.stat(backupPath);
  return { filePath: backupPath, size: stat.size };
}

export async function listBackups(): Promise<{ name: string; size: number; date: Date }[]> {
  const projectRoot = path.resolve(process.cwd(), "prisma");
  const backupDir = path.join(projectRoot, "backups");

  try {
    const files = await fs.readdir(backupDir);
    const ext = isSqlite() ? ".db" : ".sql";
    const result = await Promise.all(
      files
        .filter(f => f.endsWith(ext))
        .map(async name => {
          const stat = await fs.stat(path.join(backupDir, name));
          return { name, size: stat.size, date: stat.mtime };
        })
    );
    return result.sort((a, b) => b.date.getTime() - a.date.getTime());
  } catch {
    return [];
  }
}
