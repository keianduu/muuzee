const RECORD_LIST_KEYS = ["envs", "environmentVariables", "variables", "records", "data"];

function recordsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  for (const key of RECORD_LIST_KEYS) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

function stringOrNull(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function safeTarget(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
  return null;
}

export function sanitizeVercelEnvMetadata(payload) {
  return recordsFromPayload(payload).map((record) => {
    const id = stringOrNull(record?.id);
    const key = stringOrNull(record?.key) || stringOrNull(record?.name);
    return {
      id,
      key,
      type: stringOrNull(record?.type),
      target: safeTarget(record?.target),
      gitBranch: stringOrNull(record?.gitBranch),
      configured: Boolean(key),
    };
  });
}

export function parseVercelEnvListJson(stdout) {
  const value = String(stdout || "").trim();
  if (!value) throw new Error("Vercel CLI returned no JSON metadata.");
  let payload;
  try {
    payload = JSON.parse(value);
  } catch {
    throw new Error("Vercel CLI returned invalid JSON metadata.");
  }
  return sanitizeVercelEnvMetadata(payload);
}
