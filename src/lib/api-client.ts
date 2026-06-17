/**
 * Bulletproof fetch wrapper that validates response content type
 * before parsing. Prevents HTML-as-JSON crashes.
 */

export class ApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, message: string, body: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export class ContentTypeError extends TypeError {
  body: string;

  constructor(url: string, body: string) {
    super(`Expected JSON from ${url} but received non-JSON response.`);
    this.name = "ContentTypeError";
    this.body = body;
  }
}

/**
 * Type-safe fetch wrapper that:
 * 1. Checks response.ok before parsing
 * 2. Validates content-type is JSON before calling .json()
 * 3. Throws typed errors for both HTTP and content-type failures
 */
export async function safeFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new ApiError(response.status, `API Error [${response.status}]: ${url}`, errorText);
  }

  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const fallbackText = await response.text().catch(() => "");
    console.error("Non-JSON response from:", url, fallbackText.slice(0, 200));
    throw new ContentTypeError(url, fallbackText);
  }

  return response.json() as Promise<T>;
}

/**
 * Safe fetch for cases where you want null instead of throwing on error.
 * Useful for optional data loads where failure is acceptable.
 */
export async function safeFetchOrNull<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    return await safeFetch<T>(url, options);
  } catch {
    return null;
  }
}
