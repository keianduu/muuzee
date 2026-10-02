import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { assertHttpUrl, nullableText, validUuid } from "@/lib/admin/http";
import { slugify } from "@/lib/admin/slug";
import { normalizeVenueIdentity } from "@/lib/art-commons/mapper";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createImageResearchPrompt } from "@/lib/admin/image-research-prompt";
import { evaluatePublication } from "@/lib/admin/publication";
import { firstRelation, getExhibition } from "@/lib/admin/queries";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; if (!validUuid(id)) throw new Error("Invalid exhibition ID");
    const result = await getExhibition(id);
    if (result.error) throw new Error(result.error);
    if (!result.data) return NextResponse.json({ error: result.configured ? "展覧会が見つかりません。" : "Supabase環境変数が未設定です。" }, { status: result.configured ? 404 : 503 });
    const exhibition = result.data;
    const occurrence = exhibition.exhibition_occurrences?.[0] || null;
    const venue = firstRelation(occurrence?.venues);
    const primary = exhibition.media_assets?.find((asset) => asset.is_primary) || null;
    const publication = evaluatePublication({ title: exhibition.title, venueId: occurrence?.venue_id, startDate: occurrence?.start_date, endDate: occurrence?.end_date, primaryImage: primary ? { id: primary.id, rightsStatus: primary.rights_status } : null });
    const prompt = createImageResearchPrompt({ title: exhibition.title, venue: venue?.name || null, startDate: occurrence?.start_date || null, endDate: occurrence?.end_date || null, officialUrl: exhibition.official_url });
    return NextResponse.json({ exhibition, occurrence, venue, prompt, requirements: publication.requirements, canPublish: publication.canPublish });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Detail fetch failed" }, { status: 400 }); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; if (!validUuid(id)) throw new Error("Invalid exhibition ID");
    const body = await request.json(); const title = nullableText(body.title); if (!title) throw new Error("Titleは必須です。");
    const officialUrl = nullableText(body.official_url); const ticketUrl = nullableText(body.ticket_url); assertHttpUrl(officialUrl, "Official URL"); assertHttpUrl(ticketUrl, "Ticket URL");
    const db = createSupabaseAdminClient();
    const { error: exhibitionError } = await db.from("exhibitions").update({ title, title_en: nullableText(body.title_en), description: nullableText(body.description), exhibition_type: nullableText(body.exhibition_type), official_url: officialUrl }).eq("id", id);
    if (exhibitionError) throw exhibitionError;
    const { data: occurrence, error: occurrenceError } = await db.from("exhibition_occurrences").select("id, venue_id").eq("exhibition_id", id).limit(1).single(); if (occurrenceError) throw occurrenceError;
    const venueName = nullableText(body.venue_name); if (!venueName) throw new Error("Venueは必須です。"); const venueAddress = nullableText(body.venue_address);
    const normalizedName = normalizeVenueIdentity(venueName); const normalizedAddress = normalizeVenueIdentity(venueAddress) || null;
    const { data: currentVenue, error: currentVenueError } = await db.from("venues").select("name,address,normalized_name,normalized_address").eq("id", occurrence.venue_id).single(); if (currentVenueError) throw currentVenueError;
    const currentNormalizedName = currentVenue.normalized_name || normalizeVenueIdentity(currentVenue.name);
    const currentNormalizedAddress = currentVenue.normalized_address || normalizeVenueIdentity(currentVenue.address) || null;
    let venueId = occurrence.venue_id;
    if (currentNormalizedName !== normalizedName || currentNormalizedAddress !== normalizedAddress) {
      let matchQuery = db.from("venues").select("id").eq("normalized_name", normalizedName); matchQuery = normalizedAddress ? matchQuery.eq("normalized_address", normalizedAddress) : matchQuery.is("normalized_address", null);
      const { data: matched, error: matchError } = await matchQuery.limit(2); if (matchError) throw matchError;
      if (matched?.length === 1) venueId = matched[0].id;
      else { const { data: created, error: createError } = await db.from("venues").insert({ slug: `${slugify(venueName)}-${randomUUID().slice(0, 8)}`, name: venueName, address: venueAddress, normalized_name: normalizedName, normalized_address: normalizedAddress, venue_type: "other" }).select("id").single(); if (createError) throw createError; venueId = created.id; }
    }
    const { error: dateError } = await db.from("exhibition_occurrences").update({ venue_id: venueId, start_date: nullableText(body.start_date), end_date: nullableText(body.end_date), opening_hours_text: nullableText(body.opening_hours_text), closed_days_text: nullableText(body.closed_days_text), ticket_url: ticketUrl }).eq("id", occurrence.id); if (dateError) throw dateError;
    revalidatePath("/admin"); revalidatePath("/admin/exhibitions"); revalidatePath(`/admin/exhibitions/${id}`);
    return NextResponse.json({ message: "展覧会情報を保存しました。" });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Save failed" }, { status: 400 }); }
}
