import { NextResponse } from "next/server";
import { createJapanPostPostalProvider } from "@/lib/postal/japan-post";
import {
  PostalAddressNotFoundError,
  PostalProviderUnavailableError,
  PostalValidationError,
  lookupPostalAddress,
} from "@/lib/postal/postal";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const countryCode = typeof body.countryCode === "string" ? body.countryCode.trim().toUpperCase() : "";
    const postalCode = typeof body.postalCode === "string" ? body.postalCode : "";
    if (countryCode !== "JP") throw new PostalValidationError("郵便番号検索は日本の住所のみ対応しています。");
    return NextResponse.json(await lookupPostalAddress(postalCode, createJapanPostPostalProvider()));
  } catch (error) {
    if (error instanceof PostalProviderUnavailableError) {
      return NextResponse.json({ code: "postal_provider_unavailable", error: error.message }, { status: 503 });
    }
    if (error instanceof PostalAddressNotFoundError) {
      return NextResponse.json({ code: "postal_address_not_found", error: error.message }, { status: 404 });
    }
    if (error instanceof PostalValidationError) {
      return NextResponse.json({ code: "postal_validation_error", error: error.message }, { status: 400 });
    }
    return NextResponse.json({ code: "postal_provider_error", error: error instanceof Error ? error.message : "Postal lookup failed" }, { status: 502 });
  }
}
