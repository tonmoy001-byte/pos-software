import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function proxy(req: NextRequest) {
  const requestId = generateId();

  // Skip auth for public endpoints to avoid unnecessary token checks
  const publicPaths = ["/api/health", "/api/auth", "/setup", "/api/setup"];
  if (publicPaths.some(path => req.nextUrl.pathname.startsWith(path))) {
    const response = NextResponse.next();
    response.headers.set("X-Request-ID", requestId);
    return response;
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isAuth = !!token;
  const pathname = req.nextUrl.pathname;
  const isAuthPage = pathname.startsWith("/auth");
  const isOnboardingPage = pathname.startsWith("/onboarding");

  // API-specific headers — scope CORS to the app origin, not wildcard
  if (pathname.startsWith("/api/")) {
    const appOrigin = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const response = NextResponse.next();
    response.headers.set("X-Request-ID", requestId);
    response.headers.set("Access-Control-Allow-Origin", appOrigin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key");
    return response;
  }

  // Onboarding check — redirect to setup wizard if not completed
  if (isAuth && !pathname.startsWith("/onboarding") && !pathname.startsWith("/api/")) {
    const onboardingComplete = token?.onboardingComplete;
    if (!onboardingComplete) {
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }
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
    let from = pathname;
    if (req.nextUrl.search) {
      from += req.nextUrl.search;
    }

    return NextResponse.redirect(
      new URL(`/auth/signin?callbackUrl=${encodeURIComponent(from)}`, req.url)
    );
  }

  // Admin routes require SUPER_ADMIN_IDS
  if (pathname.startsWith("/(admin)") || pathname.startsWith("/api/admin")) {
    const superAdminIds = process.env.SUPER_ADMIN_IDS?.split(",") ?? [];
    if (!token?.sub || !superAdminIds.includes(token.sub)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  const role = token?.role as string;
  const adminRoutes = ["/users", "/activity", "/settings"];

  if (adminRoutes.some(route => pathname.startsWith(route)) && role !== "ADMIN") {
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
    "/(admin)/:path*",
    "/auth/signin",
    "/auth/signup",
    "/onboarding",
    "/onboarding/:path*",
    "/setup",
    "/setup/:path*",
    "/api/onboarding/:path*",
    "/api/admin/:path*",
    "/api/:path*",
  ],
};
