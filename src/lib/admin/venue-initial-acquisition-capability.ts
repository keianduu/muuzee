import "server-only";

export const VENUE_INITIAL_ACQUISITION_DISABLED = {
  code: "venue_initial_acquisition_disabled",
  error: "Venue initial acquisition is not available in this environment.",
} as const;

export function isVenueInitialAcquisitionEnabled(input: {
  hosted?: boolean;
  configuredValue?: string;
} = {}) {
  const hosted = input.hosted ?? process.env.VERCEL === "1";
  const configuredValue = input.configuredValue ?? process.env.VENUE_INITIAL_ACQUISITION_ENABLED;

  if (configuredValue === "true") return true;
  if (configuredValue === "false") return false;
  return !hosted;
}
