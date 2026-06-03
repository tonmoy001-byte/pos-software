import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/api/health", "/api/auth", "/auth/signin", "/auth/signup", "/setup", "/api/setup", "/pending-approval"];
const AUTH_PAGES = ["/auth/signin", "/auth/signup"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    // If user is already authenticated and trying to access auth pages, redirect to dashboard
    if (AUTH_PAGES.some(path => pathname.startsWith(path))) {
      const token = await getToken({ req: request });
      if (token) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
    return NextResponse.next();
  }

  // 2. Check authentication
  const token = await getToken({ req: request });

  if (!token) {
    const url = new URL("/auth/signin", request.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // 3. Super Admin protection
  const SUPER_ADMIN_IDS = (process.env.SUPER_ADMIN_IDS || "").split(",");
  if (pathname.startsWith("/tenants") || pathname.startsWith("/plans")) {
    if (!SUPER_ADMIN_IDS.includes(token.id as string)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // 4. Pending store check
  if (token.status !== "ACTIVE" && pathname !== "/pending-approval") {
    return NextResponse.redirect(new URL("/pending-approval", request.url));
  }

  // 5. Onboarding check
  if (!token.onboardingComplete && !pathname.startsWith("/onboarding") && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  // 6. Role-based route protection
  if (pathname.startsWith("/settings/store") && token.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const response = NextResponse.next();

  // 7. Add CORS headers for API
  if (pathname.startsWith("/api/")) {
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  return response;
}

// Next.js 16 uses src/proxy.ts for global routing if configured,
// otherwise we can export it as middleware.
export default proxy;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public|stitch_assets).*)",
  ],
};
