import { NextResponse } from "next/server";
import { geocodeWithGeolonia, resolveAddressParts } from "@/lib/geolonia/client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const countryCode = typeof body.countryCode === "string" ? body.countryCode.trim().toUpperCase() : "";
    const address = typeof body.address === "string" ? body.address.trim() : "";
    if (countryCode !== "JP") throw new Error("現在、住所からの位置情報取得は日本国内のみ対応しています。");
    if (!address) throw new Error("住所を入力してください。");
    const parts = resolveAddressParts({ address });
    const result = await geocodeWithGeolonia({ address, prefecture: parts.prefecture, city: parts.city });
    if (!result) throw new Error("住所から位置情報を取得できませんでした。");
    return NextResponse.json({
      countryCode,
      prefecture: parts.prefecture,
      city: parts.city,
      latitude: result.latitude,
      longitude: result.longitude,
      precision: result.precision,
      matchedLocality: result.matchedLocality,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Address preview failed" }, { status: 400 });
  }
}
