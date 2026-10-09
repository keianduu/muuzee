export const MASTER_LIST_COLUMNS = {
  venues: ["会場", "種別", "座標", "関連", "更新"],
  artists: ["作家", "英語名", "国籍", "生没年", "関連", "更新"],
  works: ["作品", "作家", "制作年", "所蔵先", "更新"],
} as const;

export function venueCoordinateMapUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

export function formatVenueCoordinates(latitude: number, longitude: number) {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

export function venueCoordinatePresentation(latitude: unknown, longitude: unknown) {
  if (latitude == null || longitude == null) return null;
  const normalizedLatitude = Number(latitude);
  const normalizedLongitude = Number(longitude);
  if (!Number.isFinite(normalizedLatitude) || !Number.isFinite(normalizedLongitude)) return null;
  return {
    href: venueCoordinateMapUrl(normalizedLatitude, normalizedLongitude),
    label: formatVenueCoordinates(normalizedLatitude, normalizedLongitude),
  };
}
