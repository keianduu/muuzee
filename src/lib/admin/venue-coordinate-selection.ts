export const VENUE_COORDINATE_SELECTED_EVENT = "muuzee:venue-coordinate-selected";

export type VenueCoordinateSelection = {
  venueId: string;
  latitude: number;
  longitude: number;
  source: string;
  precision: string;
};

export function applyVenueCoordinateSelection<T extends { latitude: string; longitude: string }>(
  current: T,
  selection: Pick<VenueCoordinateSelection, "latitude" | "longitude">,
) {
  return {
    ...current,
    latitude: String(selection.latitude),
    longitude: String(selection.longitude),
  };
}

export function isVenueCoordinateSelection(value: unknown): value is VenueCoordinateSelection {
  if (!value || typeof value !== "object") return false;
  const detail = value as Partial<VenueCoordinateSelection>;
  return typeof detail.venueId === "string"
    && typeof detail.latitude === "number"
    && Number.isFinite(detail.latitude)
    && typeof detail.longitude === "number"
    && Number.isFinite(detail.longitude)
    && typeof detail.source === "string"
    && typeof detail.precision === "string";
}
