import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { assertHttpUrl, nullableText, validUuid } from "@/lib/admin/http";
import { normalizeVenueIdentity } from "@/lib/art-commons/mapper";
import { coordinateUpdateValues } from "@/lib/admin/venue-update";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { changedVenueValues, recordVenueEditProvenance } from "@/lib/admin/venue-manual-provenance";

function nullableNumber(value: unknown) { if (value == null || value === "") return null; const number = Number(value); if (!Number.isFinite(number)) throw new Error("Invalid coordinate"); return number; }

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; if (!validUuid(id)) throw new Error("Invalid venue ID"); const body = await request.json(); const name = nullableText(body.name); if (!name) throw new Error("Nameは必須です。"); const db = createSupabaseAdminClient();
    const officialUrl = nullableText(body.official_url); assertHttpUrl(officialUrl, "Official URL"); const latitude = nullableNumber(body.latitude); const longitude = nullableNumber(body.longitude); if ((latitude == null) !== (longitude == null)) throw new Error("LatitudeとLongitudeは両方入力してください。");
    const { data: current, error: currentError } = await db.from("venues").select("*").eq("id", id).single(); if (currentError || !current) throw currentError || new Error("Venue not found");
    const values: Record<string, unknown> = {
      name,
      name_en: nullableText(body.name_en),
      venue_type: nullableText(body.venue_type) || "other",
      country_code: nullableText(body.country_code),
      region: nullableText(body.region),
      postal_code: nullableText(body.postal_code),
      prefecture: nullableText(body.prefecture),
      city: nullableText(body.city),
      address: nullableText(body.address),
      official_url: officialUrl,
      inception_year: nullableNumber(body.inception_year),
      description: nullableText(body.description),
      access_text: nullableText(body.access_text),
      opening_hours_text: nullableText(body.opening_hours_text),
      closed_days_text: nullableText(body.closed_days_text),
      opening_note: nullableText(body.opening_note),
      normalized_name: normalizeVenueIdentity(name),
      normalized_address: normalizeVenueIdentity(nullableText(body.address)) || null,
      latitude,
      longitude,
      ...coordinateUpdateValues(current, {
        latitude,
        longitude,
        sourceHint: body.coordinate_source_hint,
        precisionHint: body.coordinate_precision_hint,
      }),
    };
    const changed = changedVenueValues(current as Record<string, unknown>, values);
    const { error } = await db.from("venues").update(values).eq("id", id); if (error) throw error;
    await recordVenueEditProvenance(db, id, changed, body.field_source_hints && typeof body.field_source_hints === "object" ? body.field_source_hints : {});
    revalidatePath("/admin/venues"); revalidatePath(`/admin/venues/${id}`); return NextResponse.json({ message: "Venue情報を保存しました。" });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Save failed" }, { status: 400 }); }
}
