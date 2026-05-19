import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function proxy(req: NextRequest) {
  const requestId = generateId();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isAuth = !!token;
  const isAuthPage = req.nextUrl.pathname.startsWith("/auth");
  const isOnboardingPage = req.nextUrl.pathname.startsWith("/onboarding");

  // API-specific headers — scope CORS to the app origin, not wildcard
  if (req.nextUrl.pathname.startsWith("/api/")) {
    const appOrigin = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const response = NextResponse.next();
    response.headers.set("X-Request-ID", requestId);
    response.headers.set("Access-Control-Allow-Origin", appOrigin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key");
    return response;
  }

  // Auth and onboarding pages: accessible without a session.
  // Authenticated visitors are redirected to /dashboard.
  if (isAuthPage || isOnboardingPage) {
    if (isAuth) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (!isAuth) {
    let from = req.nextUrl.pathname;
    if (req.nextUrl.search) {
      from += req.nextUrl.search;
    }

    return NextResponse.redirect(
      new URL(`/auth/signin?callbackUrl=${encodeURIComponent(from)}`, req.url)
    );
  }

  const role = token?.role as string;
  const adminRoutes = ["/users", "/activity", "/settings"];

  if (adminRoutes.some(route => req.nextUrl.pathname.startsWith(route)) && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/pos/:path*",
    "/inventory/:path*",
    "/customers/:path*",
    "/dues/:path*",
    "/loans/:path*",
    "/second-hand/:path*",
    "/users/:path*",
    "/activity/:path*",
    "/reports/:path*",
    "/suppliers/:path*",
    "/settings/:path*",
    "/scan/:path*",
    "/mobile-pos/:path*",
    "/admin/:path*",
    "/auth/signin",
    "/onboarding",
    "/api/onboarding/:path*",
    "/api/:path*",
  ],
};
