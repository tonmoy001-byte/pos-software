import { describe, it, expect } from "vitest";
import { apiError, unauthorized, forbidden, notFound, conflict, tooManyRequests, validationError, serverError } from "../errorHandler";

describe("errorHandler", () => {
  it("apiError returns correct status and body", async () => {
    const res = apiError(400, "Bad input", "VALIDATION");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "Bad input", code: "VALIDATION" });
  });

  it("unauthorized returns 401", async () => {
    const res = unauthorized();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("forbidden returns 403", async () => {
    const res = forbidden("No access");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("No access");
  });

  it("notFound returns 404 with entity name", async () => {
    const res = notFound("Product");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Product not found");
  });

  it("conflict returns 409", async () => {
    const res = conflict("Duplicate");
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("CONFLICT");
  });

  it("tooManyRequests returns 429", async () => {
    const res = tooManyRequests();
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("RATE_LIMITED");
  });

  it("validationError includes details", async () => {
    const details = { name: ["Required"] };
    const res = validationError(details);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details).toEqual(details);
  });

  it("serverError wraps Error message", async () => {
    const res = serverError(new Error("DB down"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("DB down");
  });
});
