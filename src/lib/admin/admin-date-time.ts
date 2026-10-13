const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatAdminDateTime(value: string | number | Date | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";

  const date = value instanceof Date
    ? new Date(value.getTime())
    : typeof value === "number"
      ? new Date(value)
      : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  return [
    jst.getUTCFullYear(),
    pad(jst.getUTCMonth() + 1),
    pad(jst.getUTCDate()),
  ].join("/") + ` ${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}:${pad(jst.getUTCSeconds())}`;
}
