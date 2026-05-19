import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  account: {
    upsert: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  journalEntry: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

describe("posting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.account.upsert.mockResolvedValue({ id: "acct-new" });
    mockPrisma.account.findMany.mockResolvedValue([
      { id: "acct-1000", code: "1000", type: "ASSET" },
      { id: "acct-1100", code: "1100", type: "ASSET" },
      { id: "acct-1200", code: "1200", type: "ASSET" },
      { id: "acct-4000", code: "4000", type: "REVENUE" },
      { id: "acct-5000", code: "5000", type: "EXPENSE" },
    ]);
  });

  it("postSaleEntry creates balanced journal entry", async () => {
    const { postSaleEntry } = await import("../posting");

    await postSaleEntry("sale-1", 1000, 600, 1000, "CASH", "store-1", mockPrisma as any);

    expect(mockPrisma.journalEntry.create).toHaveBeenCalledTimes(1);
    const call = mockPrisma.journalEntry.create.mock.calls[0][0];
    expect(call.data.storeId).toBe("store-1");
    expect(call.data.referenceId).toBe("sale-1");
    expect(call.data.lines.create).toHaveLength(4); // Dr Cash, Cr Revenue, Dr COGS, Cr Inventory

    const lines: any[] = call.data.lines.create;
    const debits = lines.filter((l: any) => l.debit > 0);
    const credits = lines.filter((l: any) => l.credit > 0);

    const totalDebit = debits.reduce((s: number, l: any) => s + l.debit, 0);
    const totalCredit = credits.reduce((s: number, l: any) => s + l.credit, 0);
    expect(totalDebit).toBe(totalCredit);
  });

  it("postSaleEntry creates due entry when paid < total", async () => {
    const { postSaleEntry } = await import("../posting");

    await postSaleEntry("sale-2", 1000, 600, 500, "CASH", "store-1", mockPrisma as any);

    expect(mockPrisma.journalEntry.create).toHaveBeenCalledTimes(1);
    const call = mockPrisma.journalEntry.create.mock.calls[0][0];
    const debits: any[] = call.data.lines.create.filter((l: any) => l.debit > 0);
    const amounts = debits.map((l: any) => l.debit);
    expect(amounts).toContain(500); // due portion
  });
});
