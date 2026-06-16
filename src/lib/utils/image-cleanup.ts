"use server";
import { promises as fs } from "fs";
import path from "path";

export async function deleteImageFromUploads(filename: string | null | undefined): Promise<void> {
  if (!filename) return;
  
  // Extract just the filename from the path if needed
  const basename = path.basename(filename);
  const filePath = path.join(process.cwd(), "public", "uploads", "products", basename);
  
  try {
    await fs.access(filePath);
    await fs.unlink(filePath);
    console.log(`Deleted image: ${filePath}`);
  } catch (error) {
    // File doesn't exist, which is fine
    console.log(`Image not found (may already be deleted): ${filePath}`);
  }
}

export async function extractImageUrlFromUrl(url?: string | null): Promise<string | null> {
  if (!url) return null;
  // Handle URLs like /uploads/products/filename.ext or http://localhost:3000/uploads/products/filename.ext
  const match = url.match(/\/uploads\/products\/([^?]+)/);
  return match ? match[1] : null;
}