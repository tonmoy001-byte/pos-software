import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const onboardingSchema = z.object({
  businessType: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { businessType, address, phone } = onboardingSchema.parse(body);

    await prisma.store.update({
      where: { id: session.user.storeId },
      data: {
        businessType,
        address,
        phone,
        onboardingComplete: true,
      },
    });

    return NextResponse.json({ message: "Onboarding successful" });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Onboarding error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
