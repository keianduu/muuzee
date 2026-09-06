import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { venueAutoPrimaryMaintenance } from "@/lib/admin/venue-primary-image";

export async function GET() {
  try { return NextResponse.json(await venueAutoPrimaryMaintenance()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Dry run failed" }, { status: 400 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await venueAutoPrimaryMaintenance({ apply: true, limit: Number(body.limit) || undefined });
    revalidatePath("/admin/venues");
    return NextResponse.json({ ...result, message: `${result.applied}件をPrimary画像へ設定しました。Rights Statusは変更していません。` });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Auto primary failed" }, { status: 400 }); }
}
