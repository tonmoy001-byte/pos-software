import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("info logs to console.log", async () => {
    const { logger } = await import("../logger");
    logger.info("test message", { storeId: "s1" });
    expect(console.log).toHaveBeenCalledTimes(1);
    const args = (console.log as any).mock.calls[0][0];
    const parsed = JSON.parse(args);

    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("test message");
    expect(parsed.storeId).toBe("s1");
    expect(parsed.timestamp).toBeDefined();
  });

  it("error logs to console.error", async () => {
    const { logger } = await import("../logger");
    logger.error("something broke");
    expect(console.error).toHaveBeenCalledTimes(1);
    const args = (console.error as any).mock.calls[0][0];
    const parsed = JSON.parse(args);

    expect(parsed.level).toBe("error");
    expect(parsed.message).toBe("something broke");
  });
});
