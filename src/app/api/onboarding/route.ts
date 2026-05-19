import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { eventStore } from "@/lib/services/eventStore";

export const dynamic = "force-dynamic";

interface OnboardingBody {
  // Step 1 – Shop
  shopName: string;
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  // Step 2 – Admin user
  username: string;
  password: string;
  name: string;
}

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(req: Request) {
  // Only allowed when no users exist yet
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    return badRequest("Onboarding already completed.");
  }

  let body: OnboardingBody;
  try {
    body = (await req.json()) as OnboardingBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  // ── Step 1 – Shop validation ──────────────────────────────────────────────
  if (!body.shopName || body.shopName.trim().length < 2) {
    return badRequest("Shop name must be at least 2 characters.");
  }

  // ── Step 2 – Admin user validation ───────────────────────────────────────
  if (!body.username || body.username.trim().length < 3) {
    return badRequest("Username must be at least 3 characters.");
  }
  if (!body.password || body.password.length < 6) {
    return badRequest("Password must be at least 6 characters.");
  }
  if (!body.name || body.name.trim().length < 2) {
    return badRequest("Admin name must be at least 2 characters.");
  }

  try {
    const trimmedUsername = body.username.trim();
    const existingUser = await prisma.user.findUnique({
      where: { username: trimmedUsername },
    });
    if (existingUser) {
      return badRequest("Username already taken.");
    }

    // ── ACID transaction ───────────────────────────────────────────────────
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the store (shop)
      const store = await tx.store.create({
        data: {
          name: body.shopName.trim(),
          address: body.address?.trim() || null,
          phone: body.phone?.trim() || null,
          email: body.email?.trim() || null,
          taxId: body.taxId?.trim() || null,
        },
      });

      // 2. Clone the store ID as branchId so `default` branch references match
      //    the Store (avoids FK violation requiring an existing Branch row).
      const branch = await tx.branch.create({
        data: {
          name: "Default",
          storeId: store.id,
          // keep the branch id equal to the store id so upstream code
          // that does `branchId = store.id` always resolves.
          id: store.id,
        },
      });

      // 3. Create the admin user
      const hashed = await bcrypt.hash(body.password, 12);
      const user = await tx.user.create({
        data: {
          username: trimmedUsername,
          password: hashed,
          name: body.name.trim(),
          role: "ADMIN",
          storeId: store.id,
          branchId: branch.id,
        },
        select: { id: true },
      });

      // 4. Fire an audit event
      await eventStore.append(
        {
          aggregateType: "Store",
          aggregateId: store.id,
          type: "CREATED",
          payload: {
            name: store.name,
            createdBy: user.id,
            via: "onboarding",
          },
          userId: user.id,
          storeId: store.id,
        },
        tx
      );

      return { storeId: store.id, userId: user.id };
    });

    return NextResponse.json({
      ok: true,
      message: "Onboarding complete. Please sign in.",
      data: result,
    });
  } catch (err) {
    console.error("[onboarding] unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to complete onboarding. Please try again." },
      { status: 500 }
    );
  }
}
