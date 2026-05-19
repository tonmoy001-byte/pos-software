import { NextResponse } from "next/server";

export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

export function apiError(status: number, message: string, code?: string, details?: unknown): NextResponse {
  return NextResponse.json(
    { error: message, code: code || "ERROR", ...(details ? { details } : {}) },
    { status }
  );
}

export function unauthorized(): NextResponse {
  return apiError(401, "Unauthorized", "UNAUTHORIZED");
}

export function forbidden(reason?: string): NextResponse {
  return apiError(403, reason || "Forbidden", "FORBIDDEN");
}

export function notFound(entity?: string): NextResponse {
  return apiError(404, entity ? `${entity} not found` : "Not found", "NOT_FOUND");
}

export function conflict(message: string): NextResponse {
  return apiError(409, message, "CONFLICT");
}

export function tooManyRequests(): NextResponse {
  return NextResponse.json(
    { error: "Too many requests", code: "RATE_LIMITED" },
    { status: 429 }
  );
}

export function validationError(details: unknown): NextResponse {
  return apiError(400, "Validation failed", "VALIDATION_ERROR", details);
}

export function serverError(error: unknown): NextResponse {
  const isProduction = process.env.NODE_ENV === "production";
  const message = isProduction
    ? "Internal server error"
    : (error instanceof Error ? error.message : "Internal server error");
  return apiError(500, message, "SERVER_ERROR");
}
