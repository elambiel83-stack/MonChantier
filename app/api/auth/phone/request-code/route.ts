import { NextResponse } from "next/server";
import { createPhoneOtp } from "@/lib/phoneAuth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = (body?.phone || "").toString();

    if (!phone) {
      return NextResponse.json({ message: "Phone number is required" }, { status: 400 });
    }

    const { code, expiresAt, phone: normalizedPhone } = await createPhoneOtp(phone);

    return NextResponse.json({
      ok: true,
      phone: normalizedPhone,
      expiresAt,
      devCode: process.env.NODE_ENV === "development" ? code : undefined,
      message:
        process.env.NODE_ENV === "development"
          ? `Code OTP généré (dev): ${code}`
          : "Code OTP envoyé",
    });
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
}
