export const MASTER_IMAGE_STATES = ["未取得", "画像なし", "候補あり", "利用不可", "利用可能"] as const;
export type MasterImageState = (typeof MASTER_IMAGE_STATES)[number];

export const VENUE_POSITION_STATES = ["取得不可", "候補あり", "確認済み"] as const;
export type VenuePositionState = (typeof VENUE_POSITION_STATES)[number];

function nestedImageCandidates(row: Record<string, unknown>) {
  return ((row.source_records || []) as Array<Record<string, unknown>>).flatMap((source) =>
    (source.source_image_candidates || []) as Array<Record<string, unknown>>,
  );
}

export function masterImageState(row: Record<string, unknown>): MasterImageState {
  const assets = (row.media_assets || []) as Array<Record<string, unknown>>;
  const candidates = nestedImageCandidates(row);

  if (assets.some((asset) => asset.rights_status === "approved")) return "利用可能";

  const unresolvedAsset = assets.some((asset) => asset.rights_status !== "approved" && asset.rights_status !== "rejected");
  const unresolvedCandidate = candidates.some((candidate) =>
    candidate.is_active !== false && candidate.review_status !== "rejected" && candidate.rights_status !== "rejected",
  );
  if (unresolvedAsset || unresolvedCandidate) return "候補あり";

  const rejectedEvidence = assets.some((asset) => asset.rights_status === "rejected")
    || candidates.some((candidate) => candidate.review_status === "rejected" || candidate.rights_status === "rejected")
    || row.image_search_status === "image_candidate_rejected";
  if (rejectedEvidence) return "利用不可";

  if (row.image_search_status === "no_image_found" || row.image_search_status === "no_image_candidate") return "画像なし";
  return "未取得";
}

export function venuePositionState(row: Record<string, unknown>): VenuePositionState {
  if (row.latitude != null && row.longitude != null) return "確認済み";
  if (
    row.coordinate_candidate_latitude != null
    && row.coordinate_candidate_longitude != null
    && row.coordinate_status !== "rejected"
  ) return "候補あり";
  return "取得不可";
}
