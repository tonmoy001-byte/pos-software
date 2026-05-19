import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { checkRateLimit } from "../rateLimiter";

describe("rateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests within default limit", () => {
    const key = "test-key-1";
    for (let i = 0; i < 50; i++) {
      const result = checkRateLimit(key);
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks requests over default limit", () => {
    const key = "test-key-2";
    for (let i = 0; i < 61; i++) {
      const result = checkRateLimit(key);
      if (i >= 60) {
        expect(result.allowed).toBe(false);
      }
    }
  });

  it("resets after window elapses", () => {
    const key = "test-key-3";
    for (let i = 0; i < 65; i++) {
      checkRateLimit(key);
    }
    expect(checkRateLimit(key).allowed).toBe(false);
    vi.advanceTimersByTime(61_000);
    expect(checkRateLimit(key).allowed).toBe(true);
  });

  it("strict tier allows fewer requests", () => {
    const key = "test-key-4";
    for (let i = 0; i < 12; i++) {
      const result = checkRateLimit(key, "strict");
      if (i >= 10) {
        expect(result.allowed).toBe(false);
      }
    }
  });

  it("auth tier allows only 5 requests", () => {
    const key = "test-key-5";
    for (let i = 0; i < 7; i++) {
      const result = checkRateLimit(key, "auth");
      if (i >= 5) {
        expect(result.allowed).toBe(false);
      }
    }
  });
});
