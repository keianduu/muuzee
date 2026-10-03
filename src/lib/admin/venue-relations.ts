export type VenueRelationKind = "holding" | "exhibition";
export type RelationVisibility = "public" | "hidden";

export function isVenueRelationKind(value: unknown): value is VenueRelationKind {
  return value === "holding" || value === "exhibition";
}
export function isRelationVisibility(value: unknown): value is RelationVisibility {
  return value === "public" || value === "hidden";
}

export function blocksPublishedOccurrenceDelete(input: {
  publicationStatus: string;
  activeVisibleCount: number;
  targetRelationStatus: string | null;
  targetVisibility: string | null;
}) {
  return input.publicationStatus === "published"
    && input.targetRelationStatus !== "stale"
    && input.targetVisibility !== "hidden"
    && input.activeVisibleCount <= 1;
}
