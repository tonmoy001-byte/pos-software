import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getToken, encode } from "next-auth/jwt";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "next-auth.session-token";

interface OnboardingBody {
  step1: {
    logo?: string;
    address?: string;
    currency?: string;
    language?: string;
  };
  step2: {
    branchName?: string;
    storeAddress?: string;
  };
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.storeId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const storeId = session.user.storeId;
    let body: OnboardingBody;
    try {
      body = (await req.json()) as OnboardingBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { step1, step2 } = body;

    // Update Store
    const storeUpdateData: Record<string, unknown> = {
      onboardingComplete: true,
    };

    if (step2?.storeAddress) {
      storeUpdateData.address = step2.storeAddress.trim();
    } else if (step1?.address) {
      storeUpdateData.address = step1.address.trim();
    }

    if (step1?.currency || step1?.language) {
      const footerData: Record<string, string> = {};
      if (step1.currency) footerData.currency = step1.currency;
      if (step1.language) footerData.language = step1.language;
      storeUpdateData.invoiceFooter = JSON.stringify(footerData);
    }

    if (step1?.logo) {
      storeUpdateData.logo = step1.logo;
    }

    await prisma.store.update({
      where: { id: storeId },
      data: storeUpdateData,
    });

    if (step2?.branchName) {
      try {
        await prisma.branch.update({
          where: { id: storeId },
          data: { name: step2.branchName.trim() },
        });
      } catch {
        // Branch doesn't exist — skip
      }
    }

    // Update JWT token with onboardingComplete = true
    const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
    let token: any = await getToken({ req: req as any, secret });
    if (token) {
      token.onboardingComplete = true;
    } else {
      token = { onboardingComplete: true };
    }
    const newTokenValue = await encode({ token, secret: secret || "" });

    const response = NextResponse.json({
      success: true,
      message: "Setup complete",
    });

    response.cookies.set(COOKIE_NAME, newTokenValue, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (err) {
    console.error("[onboarding] unexpected error:", err);
    return NextResponse.json({ error: "Failed to complete setup. Please try again." }, { status: 500 });
  }
}