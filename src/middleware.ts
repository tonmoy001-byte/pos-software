import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const publicPaths = ["/auth/signin", "/auth/signup", "/api/auth"];

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Admin routes require SUPER_ADMIN_IDS
    if (pathname.startsWith("/(admin)") || pathname.startsWith("/api/admin")) {
      const superAdminIds = process.env.SUPER_ADMIN_IDS?.split(",") ?? [];
      if (!token?.sub || !superAdminIds.includes(token.sub)) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Allow public paths without token
        if (publicPaths.some(p => pathname.startsWith(p))) {
          return true;
        }

        // Allow NextAuth API routes
        if (pathname.startsWith("/api/auth")) {
          return true;
        }

        // Root path
        if (pathname === "/") {
          return true;
        }

        // All other paths require token
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};