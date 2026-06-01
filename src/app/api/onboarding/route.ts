import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

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

    // Set address: prefer step2.storeAddress, fallback to step1.address
    if (step2?.storeAddress) {
      storeUpdateData.address = step2.storeAddress.trim();
    } else if (step1?.address) {
      storeUpdateData.address = step1.address.trim();
    }

    // Store currency and language in invoiceFooter as JSON
    if (step1?.currency || step1?.language) {
      const footerData: Record<string, string> = {};
      if (step1.currency) footerData.currency = step1.currency;
      if (step1.language) footerData.language = step1.language;
      storeUpdateData.invoiceFooter = JSON.stringify(footerData);
    }

    // Store logo if provided
    if (step1?.logo) {
      storeUpdateData.logo = step1.logo;
    }

    await prisma.store.update({
      where: { id: storeId },
      data: storeUpdateData,
    });

    // Update Branch: find the default branch (where id = storeId)
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

    return NextResponse.json({
      success: true,
      message: "Setup complete",
    });
  } catch (err) {
    console.error("[onboarding] unexpected error:", err);
    return NextResponse.json({ error: "Failed to complete setup. Please try again." }, { status: 500 });
  }
}