export const dynamic = "force-dynamic";
import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import { checkRateLimit } from "@/lib/services/rateLimiter";
import { NextResponse } from "next/server";

function getIpFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "unknown";
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { username: credentials.username },
              { store: { email: credentials.username } },
            ],
          },
          include: { store: true },
        });

        if (!user) return null;

        const isPasswordValid = await compare(credentials.password, user.password);

        if (!isPasswordValid) return null;

        return {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          storeId: user.storeId,
          storeName: user.store.name,
          onboardingComplete: user.store.onboardingComplete,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = user.role;
        token.storeId = user.storeId;
        token.storeName = user.storeName;
        token.onboardingComplete = user.onboardingComplete;
      }

      // Re-read from DB when session is updated (e.g., after onboarding completes)
      if (trigger === "update" && token.storeId) {
        const store = await prisma.store.findUnique({
          where: { id: token.storeId as string },
          select: { onboardingComplete: true },
        });
        if (store) {
          token.onboardingComplete = store.onboardingComplete;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.storeId = token.storeId;
        session.user.storeName = token.storeName;
        session.user.onboardingComplete = token.onboardingComplete;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};

const originalHandler = NextAuth(authOptions);

async function handler(req: Request, context: any) {
  // Only rate limit POST requests (login attempts)
  if (req.method === "POST") {
    const ip = getIpFromRequest(req);
    const { allowed, remaining, resetAt } = checkRateLimit(ip, "auth");
    
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { 
          status: 429,
          headers: {
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(resetAt),
          }
        }
      );
    }
  }

  return originalHandler(req, context);
}

export { handler as GET, handler as POST };

