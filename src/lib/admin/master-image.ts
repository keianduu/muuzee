import { interpretCommonsLicense } from "@/lib/wikimedia-commons/license-profile";

export function masterImageQuality(row: Record<string, unknown>) {
  const assets = (row.media_assets || []) as Array<Record<string, unknown>>;
  const candidates = ((row.source_records || []) as Array<Record<string, unknown>>).flatMap((source) =>
    ((source.source_image_candidates || []) as Array<Record<string, unknown>>).filter((candidate) => candidate.is_active !== false && candidate.review_status !== "rejected" && candidate.rights_status !== "rejected"),
  );
  const primary = assets.find((asset) => asset.is_primary === true);
  const approvedPrimary = Boolean(primary && primary.rights_status === "approved");
  return { assets, candidates, primary, approvedPrimary, rightsNeedsReview: Boolean(primary && primary.rights_status !== "approved") };
}

export function masterImageStatus(row: Record<string, unknown>) {
  const quality = masterImageQuality(row);
  if (quality.primary) return quality.approvedPrimary ? "Primaryあり / Rights確認済み" : "Primaryあり / Rights未確認";
  if (quality.candidates.length > 1) return "複数Candidate / 選択必要";
  return "画像なし";
}

export function imageDiscoverySourceLabel(source: unknown) {
  if (source === "wikidata_p18") return "Wikidata P18";
  if (source === "commons_category") return "Wikimedia Commons";
  if (source === "wikipedia_article") return "Wikipedia";
  return "取得経路不明";
}

export function candidateLicenseProfile(candidate: Record<string, unknown>) {
  return interpretCommonsLicense(typeof candidate.license_short_name === "string" ? candidate.license_short_name : null);
}
