type CurrentCoordinates = {
  latitude: number | null;
  longitude: number | null;
  coordinate_source: string | null;
  coordinate_precision: string | null;
  coordinate_candidate_latitude: number | null;
  coordinate_candidate_longitude: number | null;
};

type CoordinateInput = {
  latitude: number | null;
  longitude: number | null;
  sourceHint?: unknown;
  precisionHint?: unknown;
};

export function coordinateUpdateValues(current: CurrentCoordinates, input: CoordinateInput) {
  const currentLatitude = current.latitude == null ? null : Number(current.latitude);
  const currentLongitude = current.longitude == null ? null : Number(current.longitude);
  const changed = currentLatitude !== input.latitude || currentLongitude !== input.longitude;
  if (!changed) return {};

  if (input.latitude == null || input.longitude == null) {
    return {
      coordinate_source: null,
      coordinate_precision: null,
      coordinate_status: current.coordinate_candidate_latitude != null && current.coordinate_candidate_longitude != null ? "candidate" : "missing",
    };
  }

  if (input.sourceHint === "geolonia") {
    return {
      coordinate_source: "geolonia",
      coordinate_precision: typeof input.precisionHint === "string" && input.precisionHint ? input.precisionHint : "town",
      coordinate_status: "approved",
      coordinate_candidate_decided_at: new Date().toISOString(),
    };
  }

  return {
    coordinate_source: "manual",
    coordinate_precision: "exact",
    coordinate_status: "manual",
    coordinate_candidate_decided_at: new Date().toISOString(),
  };
}
