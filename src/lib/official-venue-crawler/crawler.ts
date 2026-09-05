import { lookup } from "node:dns/promises";
import { setTimeout as delay } from "node:timers/promises";
import { discoveryScore, extractOfficialPage, resolveCandidates } from "./extractor";
import { robotsDecision } from "./robots";
import type { CrawlVenueInput, FieldCandidate, OfficialCrawlField, OfficialCrawlResult } from "./types";

export const MAX_PAGES_PER_VENUE = 6;
export const MAX_CRAWL_MS_PER_VENUE = 45_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const DEFAULT_DELAY_MS = 600;
const USER_AGENT = "MuuzeeOfficialVenueCrawler/0.1 (+https://github.com/keianduu/muuzee)";

type PageResponse = { url: URL; html: string };
export type CrawlDependencies = {
  fetchHtml?: (url: URL) => Promise<PageResponse>;
  fetchRobots?: (url: URL) => Promise<string>;
  wait?: (ms: number) => Promise<unknown>;
  now?: () => Date;
};

function isPrivateAddress(address: string) {
  if (address === "::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:")) return true;
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
}

export function sameOfficialDomain(left: URL, right: URL) {
  const normalize = (hostname: string) => hostname.toLowerCase().replace(/^www\./, "");
  return normalize(left.hostname) === normalize(right.hostname);
}

export function withinOfficialSection(root: URL, candidate: URL) {
  if (!sameOfficialDomain(root, candidate)) return false;
  const rootSegments = root.pathname.split("/").filter(Boolean);
  if (!rootSegments.length) return true;
  const rootPrefix = `/${rootSegments.join("/")}/`;
  const candidatePath = candidate.pathname.endsWith("/") ? candidate.pathname : `${candidate.pathname}/`;
  if (candidatePath.startsWith(rootPrefix)) return true;
  return /^\/(?:access|visit|visitor|information|guide|about)(?:\/|$)/i.test(candidate.pathname);
}

async function assertPublicWebUrl(url: URL) {
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("unsupported_url");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    lookup(url.hostname, { all: true }),
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error("dns_timeout"), { name: "AbortError" })), 5_000); }),
  ]).finally(() => { if (timer) clearTimeout(timer); });
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) throw new Error("private_address");
}

async function beforeDeadline<T>(operation: () => Promise<T>, deadline: number) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw Object.assign(new Error("venue_timeout"), { name: "AbortError" });
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    operation(),
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error("venue_timeout"), { name: "AbortError" })), remaining); }),
  ]).finally(() => { if (timer) clearTimeout(timer); });
}

async function boundedTextFetch(url: URL, contentTypes: RegExp, accept: string, redirects = 0): Promise<PageResponse> {
  await assertPublicWebUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: accept },
      redirect: "manual",
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error(`HTTP ${response.status}`);
      if (redirects >= 4) throw new Error("too_many_redirects");
      const redirected = new URL(location, url);
      if (!sameOfficialDomain(url, redirected)) throw new Error("external_redirect");
      return boundedTextFetch(redirected, contentTypes, accept, redirects + 1);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    if (!contentTypes.test(contentType)) throw new Error("unsupported_content_type");
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > MAX_RESPONSE_BYTES) throw new Error("response_too_large");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > MAX_RESPONSE_BYTES) throw new Error("response_too_large");
    const headerCharset = contentType.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1];
    const asciiHead = bytes.subarray(0, 4096).toString("ascii");
    const metaCharset = asciiHead.match(/charset\s*=\s*["']?([^;"'\s/>]+)/i)?.[1];
    const declaredCharset = (headerCharset || metaCharset || "utf-8").toLowerCase().replace(/^shift[_-]?jis$/, "shift_jis").replace(/^sjis$/, "shift_jis");
    let html: string;
    try { html = new TextDecoder(declaredCharset).decode(bytes); } catch { html = bytes.toString("utf8"); }
    return { url: new URL(response.url || url), html };
  } finally { clearTimeout(timer); }
}

export async function retryOnce<T>(operation: () => Promise<T>, wait: (ms: number) => Promise<unknown> = delay) {
  try { return await operation(); } catch (error) {
    if (error instanceof Error && ["external_redirect", "too_many_redirects", "unsupported_content_type", "response_too_large", "private_address"].includes(error.message)) throw error;
    await wait(400);
    return operation();
  }
}

export function fetchOfficialHtml(url: URL) {
  return boundedTextFetch(url, /text\/html|application\/xhtml\+xml/i, "text/html,application/xhtml+xml");
}

async function fetchRobotsDefault(url: URL) {
  try { return (await boundedTextFetch(new URL("/robots.txt", url), /text\/plain|text\/html|application\/octet-stream/i, "text/plain,*/*;q=0.1")).html; } catch (error) {
    if (error instanceof Error && /HTTP 404/.test(error.message)) return "";
    throw error;
  }
}

function mergeCandidates(target: Partial<Record<OfficialCrawlField, FieldCandidate[]>>, incoming: Partial<Record<OfficialCrawlField, FieldCandidate[]>>) {
  for (const [field, items] of Object.entries(incoming) as Array<[OfficialCrawlField, FieldCandidate[]]>) {
    const current = target[field] || [];
    for (const item of items) if (!current.some((entry) => entry.value === item.value)) current.push(item);
    target[field] = current;
  }
}

function emptyResult(venue: CrawlVenueInput, status: OfficialCrawlResult["crawl_status"], now: Date, notes: string): OfficialCrawlResult {
  return {
    venue_id: venue.id, name: venue.name, official_url: venue.official_url || "", crawl_source_url: null,
    crawl_status: status, crawled_at: now.toISOString(), address: "", postal_code: "", opening_hours_text: "",
    closed_days_text: "", access_text: "", description: "", description_source_url: "", description_source_text: "",
    official_source_text: "",
    phone: "", address_source_url: "", postal_code_source_url: "", opening_hours_source_url: "",
    closed_days_source_url: "", access_source_url: "", ambiguous_fields: {}, discovered_urls: [], notes,
  };
}

export async function crawlOfficialVenue(venue: CrawlVenueInput, dependencies: CrawlDependencies = {}): Promise<OfficialCrawlResult> {
  const now = (dependencies.now || (() => new Date()))();
  const deadline = Date.now() + MAX_CRAWL_MS_PER_VENUE;
  if (!venue.official_url) return emptyResult(venue, "no_official_url", now, "Official URL is missing.");
  let root: URL;
  try { root = new URL(venue.official_url); } catch { return emptyResult(venue, "fetch_failed", now, "Official URL is invalid."); }
  const fetchHtml = dependencies.fetchHtml || fetchOfficialHtml;
  const fetchRobots = dependencies.fetchRobots || fetchRobotsDefault;
  const wait = dependencies.wait || delay;

  let robots = "";
  try { robots = await beforeDeadline(() => retryOnce(() => fetchRobots(root), wait), deadline); } catch (error) {
    return emptyResult(venue, error instanceof Error && error.name === "AbortError" ? "timeout" : "fetch_failed", now, `robots.txt: ${error instanceof Error ? error.message : "fetch failed"}`);
  }
  const rootDecision = robotsDecision(robots, root);
  if (!rootDecision.allowed) return emptyResult(venue, "robots_blocked", now, "robots.txt blocks the official URL.");

  const queue = [root];
  const requestedUrls = new Set<string>();
  const visited = new Set<string>();
  const fieldCandidates: Partial<Record<OfficialCrawlField, FieldCandidate[]>> = {};
  const discoveredUrls: string[] = [];
  let descriptionSourceText = "";
  let descriptionSourceUrl = "";
  const officialSourceSections: string[] = [];
  let phone = "";
  let failure = "";

  while (queue.length && requestedUrls.size < MAX_PAGES_PER_VENUE) {
    const requested = queue.shift()!;
    const requestedKey = requested.toString();
    if (requestedUrls.has(requestedKey) || visited.has(requestedKey)) continue;
    requestedUrls.add(requestedKey);
    const decision = robotsDecision(robots, requested);
    if (!decision.allowed) continue;
    if (visited.size) await wait(Math.max(DEFAULT_DELAY_MS, decision.crawlDelayMs));
    try {
      const page = await beforeDeadline(() => retryOnce(() => fetchHtml(requested), wait), deadline);
      if (!sameOfficialDomain(root, page.url)) throw new Error("external_redirect");
      visited.add(page.url.toString());
      if (!discoveredUrls.includes(page.url.toString())) discoveredUrls.push(page.url.toString());
      const extracted = extractOfficialPage(page.html, page.url.toString());
      if (extracted.officialSourceText) {
        officialSourceSections.push(`[Source URL: ${page.url.toString()}]\n${extracted.officialSourceText}`);
      }
      mergeCandidates(fieldCandidates, extracted.candidates);
      if (!phone && extracted.phone) phone = extracted.phone;
      if (!descriptionSourceText && extracted.descriptionSourceText) {
        descriptionSourceText = extracted.descriptionSourceText;
        descriptionSourceUrl = page.url.toString();
      }
      const nextLinks = extracted.links
        .map((link) => ({ ...link, parsed: new URL(link.url), score: discoveryScore(link) }))
        .filter((link) => link.score > 0 && withinOfficialSection(root, link.parsed) && !visited.has(link.parsed.toString()) && !requestedUrls.has(link.parsed.toString()))
        .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
      for (const link of nextLinks) if (!queue.some((item) => item.toString() === link.parsed.toString())) queue.push(link.parsed);
    } catch (error) {
      failure = error instanceof Error ? error.message : "fetch failed";
      if (!visited.size) {
        const status = error instanceof Error && (error.name === "AbortError" || /timeout/i.test(error.message)) ? "timeout" : "fetch_failed";
        return emptyResult(venue, status, now, failure);
      }
    }
  }

  const { values, sourceUrls, ambiguous } = resolveCandidates(fieldCandidates);
  const foundCount = Object.keys(values).length + (descriptionSourceText ? 1 : 0);
  const status = foundCount === 0 ? "no_relevant_page" : Object.keys(ambiguous).length || foundCount < 5 ? "partial" : "success";
  const notes = [failure, ...Object.entries(ambiguous).map(([field, options]) => `${field}: multiple official values (${options.join(" | ")})`)].filter(Boolean).join("; ");
  return {
    venue_id: venue.id, name: venue.name, official_url: root.toString(), crawl_source_url: discoveredUrls[0] || root.toString(),
    crawl_status: status, crawled_at: now.toISOString(), address: values.address || "", postal_code: values.postal_code || "",
    opening_hours_text: values.opening_hours_text || "", closed_days_text: values.closed_days_text || "", access_text: values.access_text || "",
    description: "", description_source_url: descriptionSourceUrl, description_source_text: descriptionSourceText, phone,
    official_source_text: officialSourceSections.join("\n\n").slice(0, 16000),
    address_source_url: sourceUrls.address || "", postal_code_source_url: sourceUrls.postal_code || "",
    opening_hours_source_url: sourceUrls.opening_hours_text || "", closed_days_source_url: sourceUrls.closed_days_text || "",
    access_source_url: sourceUrls.access_text || "", ambiguous_fields: ambiguous, discovered_urls: discoveredUrls, notes,
  };
}
