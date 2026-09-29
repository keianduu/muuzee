export const HOSTED_WIKIDATA_FULL_SYNC_ERROR = {
  code: "hosted_full_sync_not_supported",
  error: "Full Wikidata sync is not supported in the current hosted runtime. Run the existing LOCAL full-sync workflow or use a future background job.",
} as const;

export function shouldRejectHostedWikidataFullSync(mode: unknown, vercel = process.env.VERCEL) {
  return vercel === "1" && mode === "full";
}
