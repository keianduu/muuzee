import * as cheerio from "cheerio";
import { fetchText } from "@/lib/external/fetch-text";

export type ArtistIdentity = {
  name: string;
  nameEn?: string | null;
  aliases?: string[];
  birthYear?: number | null;
  deathYear?: number | null;
  birthPlace?: string | null;
};

export type ApjArtistRecord = ArtistIdentity & {
  id: string;
  url: string;
  ulanId: string | null;
  wikidataId: string | null;
  nationalityRaw: string | null;
};

export function normalizeArtistName(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[\s・･,，.．'’`´\-‐‑‒–—―_()（）]/g, "");
}

function year(value: string | undefined | null) {
  const match = value?.match(/(?:^|\D)(1[0-9]{3}|20[0-9]{2})(?:\D|$)/);
  return match ? Number(match[1]) : null;
}

export function matchApjArtistCandidates(target: ArtistIdentity, candidates: ApjArtistRecord[]) {
  const targetNames = new Set([target.name, target.nameEn, ...(target.aliases || [])].filter(Boolean).map((value) => normalizeArtistName(String(value))));
  const exact = candidates.filter((candidate) => [candidate.name, candidate.nameEn, ...(candidate.aliases || [])]
    .filter(Boolean).some((value) => targetNames.has(normalizeArtistName(String(value)))));
  const dated = exact.filter((candidate) => {
    const birthMatches = !target.birthYear || !candidate.birthYear || target.birthYear === candidate.birthYear;
    const deathMatches = !target.deathYear || !candidate.deathYear || target.deathYear === candidate.deathYear;
    return birthMatches && deathMatches;
  });
  const eligible = dated.length ? dated : exact;
  return eligible.length === 1
    ? { status: "exact" as const, candidate: eligible[0], candidates: eligible }
    : eligible.length > 1
      ? { status: "ambiguous" as const, candidate: null, candidates: eligible }
      : { status: "not_found" as const, candidate: null, candidates: [] };
}

export function parseApjArtistPage(html: string, id: string): ApjArtistRecord {
  const $ = cheerio.load(html);
  const body = $("body").text().replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");
  const heading = $("h1").first().text().trim();
  const datePair = body.match(/(1[0-9]{3}|20[0-9]{2})(?:-\d{2}-\d{2})?[\s|]+(1[0-9]{3}|20[0-9]{2})(?:-\d{2}-\d{2})?/);
  const ulan = body.match(/ULAN ID\s*([0-9]{7,12})/i)?.[1] || null;
  const wikidata = body.match(/Wikidata ID\s*(Q\d+)/i)?.[1] || null;
  const nameEn = $("h1").first().nextAll().filter((_, element) => /^[A-Z][A-Za-zÀ-ž'’., \-]+$/.test($(element).text().trim())).first().text().trim() || null;
  const namesSection = body.match(/(?:Names|作家名)([\s\S]*?)(?:Date of birth|生年月日|Birth place|生地)/i)?.[1] || "";
  const aliases = namesSection.split(/\n/).map((value) => value.replace(/^\s*[•*-]\s*/, "").trim()).filter((value) => value && value !== heading);
  const nationality = body.match(/(?:Nationality|国籍)\s*[:：]?\s*([^\n]+)/i)?.[1]?.trim() || null;
  return {
    id, url: `https://artplatform.go.jp/artists/${id}`, name: heading, nameEn,
    aliases: [...new Set(aliases)], birthYear: datePair ? Number(datePair[1]) : year(body.match(/Date of birth\s*([^\n]+)/i)?.[1]),
    deathYear: datePair ? Number(datePair[2]) : year(body.match(/Date of death\s*([^\n]+)/i)?.[1]),
    birthPlace: body.match(/(?:Birth place|生地\/結成地)\s*([^\n]+)/i)?.[1]?.trim() || null,
    ulanId: ulan, wikidataId: wikidata, nationalityRaw: nationality,
  };
}

export async function fetchApjArtist(id: string, fetcher: typeof fetch = fetch) {
  if (!/^A\d+$/.test(id)) throw new Error("Invalid APJ artist ID");
  const url = `https://artplatform.go.jp/artists/${id}`;
  if (fetcher === fetch) return parseApjArtistPage(await fetchText(url), id);
  const response = await fetcher(url, { headers: { Accept: "text/html", "User-Agent": "MuuzeeTargetedArtistEnrichment/1.0" } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`APJ ${response.status}`);
  return parseApjArtistPage(await response.text(), id);
}
