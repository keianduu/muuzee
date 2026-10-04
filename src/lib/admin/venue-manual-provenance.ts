import type { SupabaseClient } from "@supabase/supabase-js";

export const VENUE_EDITABLE_FIELDS = ["name", "name_en", "venue_type", "country_code", "region", "postal_code", "prefecture", "city", "address", "official_url", "inception_year", "description", "access_text", "opening_hours_text", "closed_days_text", "opening_note", "latitude", "longitude"] as const;

function comparable(value: unknown) {
  return value == null || value === "" ? null : typeof value === "number" ? value : String(value);
}

export function changedVenueValues(current: Record<string, unknown>, next: Record<string, unknown>) {
  return Object.fromEntries(VENUE_EDITABLE_FIELDS.filter((field) => comparable(current[field]) !== comparable(next[field])).map((field) => [field, next[field]]));
}

export function venueFieldSource(field: string, hints: Record<string, unknown>) {
  const hint = hints[field];
  if (hint === "geolonia" && ["prefecture", "city", "latitude", "longitude"].includes(field)) return "geolonia";
  if (hint === "japan_post" && ["postal_code", "prefecture", "city", "address"].includes(field)) return "japan_post";
  return "manual";
}

export async function recordVenueEditProvenance(db: SupabaseClient, venueId: string, changed: Record<string, unknown>, hints: Record<string, unknown>) {
  for (const [field, value] of Object.entries(changed)) {
    const { error: clearError } = await db.from("venue_field_sources").update({ is_current: false }).eq("venue_id", venueId).eq("field_name", field).eq("is_current", true);
    if (clearError) throw clearError;
    const source = venueFieldSource(field, hints);
    const { error } = await db.from("venue_field_sources").insert({
      venue_id: venueId, field_name: field, source, source_url: null, value_snapshot: value,
      generated_by_ai: false, review_status: source === "manual" ? "approved" : "applied", is_current: true,
    });
    if (error) throw error;
  }
}
