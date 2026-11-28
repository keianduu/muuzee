const RECORD_LIST_KEYS = ["envs", "environmentVariables", "variables", "records", "data"];

function recordsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") {
    throw new Error("Vercel CLI returned an unsupported metadata schema.");
  }

  const presentKeys = RECORD_LIST_KEYS.filter((key) => Object.hasOwn(payload, key));
  if (presentKeys.length !== 1 || !Array.isArray(payload[presentKeys[0]])) {
    throw new Error("Vercel CLI returned an unsupported metadata schema.");
  }
  return payload[presentKeys[0]];
}

function optionalString(value, fieldName) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Vercel CLI returned an invalid ${fieldName} field.`);
  }
  return value;
}

function safeTarget(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0)) {
    return value;
  }
  throw new Error("Vercel CLI returned an invalid target field.");
}

export function sanitizeVercelEnvMetadata(payload) {
  return recordsFromPayload(payload).map((record) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new Error("Vercel CLI returned an invalid environment metadata record.");
    }

    const id = optionalString(record.id, "id");
    const recordKey = optionalString(record.key, "key");
    const recordName = optionalString(record.name, "name");
    if (recordKey && recordName && recordKey !== recordName) {
      throw new Error("Vercel CLI returned conflicting environment metadata names.");
    }
    const key = recordKey || recordName;
    if (!key) throw new Error("Vercel CLI returned an environment metadata record without a key.");

    return {
      id,
      key,
      type: optionalString(record.type, "type"),
      target: safeTarget(record.target),
      gitBranch: optionalString(record.gitBranch, "gitBranch"),
      configured: true,
    };
  });
}

export function assertExpectedVercelEnvMetadata(records, expectedKeys) {
  if (!Array.isArray(records) || !Array.isArray(expectedKeys) || expectedKeys.length === 0) {
    throw new Error("At least one expected Vercel environment metadata key is required.");
  }
  const presentKeys = new Set(records.map((record) => record.key));
  if (expectedKeys.some((key) => !presentKeys.has(key))) {
    throw new Error("Expected Vercel environment metadata was not present.");
  }
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
