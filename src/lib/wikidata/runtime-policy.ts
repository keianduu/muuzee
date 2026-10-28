export const HOSTED_WIKIDATA_FULL_SYNC_ERROR = {
  code: "hosted_full_sync_not_supported",
  error: "Full Wikidata sync is not supported in the current hosted runtime. Run the existing LOCAL full-sync workflow or use a future background job.",
} as const;

export type WikidataRuntime = "local" | "hosted";

export const HOSTED_VENUE_IMPORT_BUDGET_MS = 215_000;
export const HOSTED_VENUE_IMPORT_FINALIZATION_MARGIN_MS = 20_000;
export const HOSTED_WIKIDATA_REQUEST_TIMEOUT_MS = 22_000;
export const HOSTED_WIKIDATA_DISCOVERY_ATTEMPTS = 2;
export const HOSTED_WIKIDATA_DISCOVERY_BACKOFF_MS = 1_000;
export const HOSTED_ABANDONED_RUN_AFTER_MS = 6 * 60_000;

export type VenueImportRuntimeBudget = {
  runtime: WikidataRuntime;
  deadlineAt: number | null;
  finalizationMarginMs: number;
};

export class VenueImportRuntimeBudgetExhaustedError extends Error {
  constructor() {
    super("Hosted import runtime budget reached; the run was finalized before the platform timeout.");
    this.name = "VenueImportRuntimeBudgetExhaustedError";
  }
}

export function wikidataRuntime(vercel = process.env.VERCEL): WikidataRuntime {
  return vercel === "1" ? "hosted" : "local";
}

export function createVenueImportRuntimeBudget(
  runtime: WikidataRuntime,
  now = Date.now(),
  budgetMs = HOSTED_VENUE_IMPORT_BUDGET_MS,
): VenueImportRuntimeBudget {
  return {
    runtime,
    deadlineAt: runtime === "hosted" ? now + budgetMs : null,
    finalizationMarginMs: runtime === "hosted" ? HOSTED_VENUE_IMPORT_FINALIZATION_MARGIN_MS : 0,
  };
}

export function venueImportShouldFinalize(budget: VenueImportRuntimeBudget, now = Date.now()) {
  return budget.deadlineAt != null && now >= budget.deadlineAt - budget.finalizationMarginMs;
}

export function assertVenueImportRuntimeBudget(budget: VenueImportRuntimeBudget, now = Date.now()) {
  if (venueImportShouldFinalize(budget, now)) throw new VenueImportRuntimeBudgetExhaustedError();
}

export function hostedRequestTimeoutMs(budget: VenueImportRuntimeBudget, now = Date.now()) {
  if (budget.deadlineAt == null) return undefined;
  return Math.max(1, Math.min(
    HOSTED_WIKIDATA_REQUEST_TIMEOUT_MS,
    budget.deadlineAt - budget.finalizationMarginMs - now,
  ));
}

export function shouldDeferVenueImageDiscovery(runtime: WikidataRuntime, mode: "count" | "full") {
  return runtime === "hosted" && mode === "count";
}

export function shouldRejectHostedWikidataFullSync(mode: unknown, vercel = process.env.VERCEL) {
  return vercel === "1" && mode === "full";
}
