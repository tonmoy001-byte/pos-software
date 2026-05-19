import { prisma } from "@/lib/prisma";

export async function checkIdempotency(key: string, storeId: string): Promise<{ isDuplicate: boolean; existingResponse?: any }> {
  const existing = await prisma.idempotencyKey.findUnique({
    where: { key_storeId: { key, storeId } },
  });

  if (existing) {
    if (existing.status === "COMPLETED") {
      return { isDuplicate: true, existingResponse: JSON.parse(existing.response) };
    }
    if (existing.status === "PROCESSING") {
      return { isDuplicate: true, existingResponse: { error: "Request is still being processed. Please wait." } };
    }
  }

  return { isDuplicate: false };
}

export async function createIdempotencyKey(key: string, storeId: string): Promise<void> {
  await prisma.idempotencyKey.create({
    data: {
      key,
      storeId,
      status: "PROCESSING",
      response: JSON.stringify(null),
    },
  });
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
