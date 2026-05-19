import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  idempotencyKey: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

describe("idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns isDuplicate false on first request", async () => {
    mockPrisma.idempotencyKey.findUnique.mockResolvedValue(null);

    const { checkIdempotency } = await import("../idempotency");
    const result = await checkIdempotency("key-1", "store-1");

    expect(result.isDuplicate).toBe(false);
    expect(result.existingResponse).toBeUndefined();
  });

  it("returns cached response on duplicate", async () => {
    const cached = { id: "1", key: "key-2", storeId: "store-1", response: JSON.stringify({ id: "sale-1" }) };
    mockPrisma.idempotencyKey.findUnique.mockResolvedValue(cached);

    const { checkIdempotency } = await import("../idempotency");
    const result = await checkIdempotency("key-2", "store-1");

    expect(result.isDuplicate).toBe(true);
    expect(result.existingResponse).toEqual({ id: "sale-1" });
  });

  it("marks idempotent with response", async () => {
    mockPrisma.idempotencyKey.create.mockResolvedValue({});

    const { markIdempotent } = await import("../idempotency");
    await markIdempotent("key-3", "store-1", { id: "sale-2" });

    expect(mockPrisma.idempotencyKey.create).toHaveBeenCalledWith({
      data: { key: "key-3", storeId: "store-1", response: JSON.stringify({ id: "sale-2" }) },
    });
  });
});
