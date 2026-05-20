import { prisma } from "@/lib/prisma";

const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export async function checkIdempotency(key: string, storeId: string): Promise<{ isDuplicate: boolean; existingResponse?: any }> {
  const existing = await prisma.idempotencyKey.findUnique({
    where: { key_storeId: { key, storeId } },
  });

  if (existing) {
    if (existing.status === "COMPLETED") {
      return { isDuplicate: true, existingResponse: JSON.parse(existing.response) };
    }
    if (existing.status === "PROCESSING") {
      // Check if stuck in PROCESSING state for too long
      const age = Date.now() - existing.createdAt.getTime();
      if (age > PROCESSING_TIMEOUT_MS) {
        // Treat as failed — allow retry
        await prisma.idempotencyKey.delete({
          where: { key_storeId: { key, storeId } },
        });
        return { isDuplicate: false };
      }
      return { isDuplicate: true, existingResponse: { error: "Request is still being processed. Please wait." } };
    }
  }

  return { isDuplicate: false };
}

export async function createIdempotencyKey(key: string, storeId: string): Promise<void> {
  try {
    await prisma.idempotencyKey.create({
      data: {
        key,
        storeId,
        status: "PROCESSING",
        response: JSON.stringify(null),
      },
    });
  } catch (error: any) {
    // Unique constraint violation — another request already created this key
    if (error.code === "P2002") {
      return; // Key already exists, proceed with caution
    }
    throw error;
  }
}

export async function completeIdempotencyKey(key: string, storeId: string, response: any): Promise<void> {
  await prisma.idempotencyKey.update({
    where: { key_storeId: { key, storeId } },
    data: {
      status: "COMPLETED",
      response: JSON.stringify(response),
    },
  });
}

export async function markIdempotent(key: string, storeId: string, response: any): Promise<void> {
  await completeIdempotencyKey(key, storeId, response);
}

export function extractIdempotencyKey(req: Request): string | null {
  return req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");
}
