import "server-only";

export const ADMIN_ROLE = "admin" as const;
export const ADMIN_PERMISSION = "admin:access" as const;

export type AdminAccessResult =
  | { status: "allowed"; permission: typeof ADMIN_PERMISSION }
  | { status: "unauthenticated" }
  | { status: "forbidden" };

export type AdminPathKind = "page" | "api" | "public";

const PUBLIC_ADMIN_PATHS = new Set([
  "/admin/login",
  "/admin/access-denied",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizePathname(pathname: string) {
  let normalized = pathname.split("?", 1)[0] || "/";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const decoded = decodeURIComponent(normalized);
      if (decoded === normalized) break;
      normalized = decoded;
    } catch {
      break;
    }
  }

  normalized = normalized.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  if (normalized.length > 1) normalized = normalized.replace(/\/+$/, "");
  return normalized;
}

function isPathWithin(pathname: string, root: string) {
  return pathname === root || pathname.startsWith(`${root}/`);
}

export function classifyAdminPath(pathname: string): AdminPathKind {
  const normalized = normalizePathname(pathname);
  if (PUBLIC_ADMIN_PATHS.has(normalized)) return "public";
  if (isPathWithin(normalized, "/api/admin")) return "api";
  if (isPathWithin(normalized, "/admin")) return "page";
  return "public";
}

export function authorizeAdminClaims(claims: unknown): AdminAccessResult {
  if (!isRecord(claims) || typeof claims.sub !== "string" || !claims.sub) {
    return { status: "unauthenticated" };
  }

  const appMetadata = claims.app_metadata;
  if (!isRecord(appMetadata) || appMetadata.muuzee_role !== ADMIN_ROLE) {
    return { status: "forbidden" };
  }

  return { status: "allowed", permission: ADMIN_PERMISSION };
}
