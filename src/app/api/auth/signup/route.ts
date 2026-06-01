import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { eventStore } from "@/lib/services/eventStore";
import { checkRateLimit } from "@/lib/services/rateLimiter";

export const dynamic = "force-dynamic";

const signupSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  businessName: z.string().min(2, "Business name must be at least 2 characters"),
  businessType: z.string().min(1, "Business type is required"),
  mobileNumber: z.string().min(11, "Mobile number must be at least 11 characters"),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const rateLimit = checkRateLimit(`signup:${ip}`, "auth");
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { fullName, email, password, businessName, businessType, mobileNumber } = parsed.data;

    // Check email uniqueness across all stores
    const existingUser = await prisma.user.findFirst({
      where: { store: { email: email.trim() } },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 400 }
      );
    }

    const username = `user_${Math.random().toString(36).slice(2, 8)}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create store
      const store = await tx.store.create({
        data: {
          name: businessName.trim(),
          phone: mobileNumber.trim(),
          email: email.trim(),
          status: "pending_approval",
          description: businessType,
          onboardingComplete: false,
        },
      });

      // 2. Create default branch (id = store.id)
      const branch = await tx.branch.create({
        data: {
          id: store.id,
          name: "Main Branch",
          storeId: store.id,
        },
      });

      // 3. Create admin user
      const hashed = await bcrypt.hash(password, 12);
      const user = await tx.user.create({
        data: {
          username,
          password: hashed,
          name: fullName.trim(),
          role: "ADMIN",
          storeId: store.id,
          branchId: branch.id,
        },
        select: { id: true },
      });

      // 4. Get or create free plan
      let plan = await tx.plan.findUnique({ where: { name: "free" } });
      if (!plan) {
        plan = await tx.plan.create({
          data: {
            name: "free",
            displayName: "Free Trial",
            maxProducts: 100,
            maxUsers: 3,
            maxBranches: 1,
            features: JSON.stringify(["pos", "inventory", "customers", "reports"]),
          },
        });
      }

      // 5. Create subscription (14-day trial)
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      await tx.subscription.create({
        data: {
          storeId: store.id,
          planId: plan.id,
          status: "trial",
          trialEndsAt,
        },
      });

      // 6. Fire audit event
      await eventStore.append(
        {
          aggregateType: "Store",
          aggregateId: store.id,
          type: "CREATED",
          payload: {
            name: store.name,
            businessType,
            createdBy: user.id,
            via: "signup",
          },
          userId: user.id,
          storeId: store.id,
        },
        tx
      );

      return { storeId: store.id, userId: user.id, username };
    });

    return NextResponse.json({
      success: true,
      message: "Account created. Please sign in.",
      data: result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create account";
    if (message.includes("already exists") || message.includes("at least")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[signup] unexpected error:", err);
    return NextResponse.json({ error: "Failed to create account. Please try again." }, { status: 500 });
  }
}
