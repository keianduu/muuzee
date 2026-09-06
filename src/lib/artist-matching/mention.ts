export type MatchableArtist = {
  id: string;
  name: string;
  name_en?: string | null;
  aliases?: string[] | null;
  birth_year?: number | null;
  qid?: string | null;
};

export type ArtistMention = {
  name: string;
  role: string | null;
  method: "structured_source" | "title_exact_master_name";
};

const STRUCTURED_KEYS = new Set(["artist", "artists", "artist_name", "artist_names", "creator", "creators"]);

export function normalizeArtistName(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[\s\u3000・･._\-–—'’"“”()（）［］\[\]]+/g, "");
}

function usable(value: string) {
  const normalized = normalizeArtistName(value);
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(normalized)
    ? normalized.length >= 3
    : normalized.length >= 5;
}

function stringValues(value: unknown): string[] {
  if (typeof value === "string") return value.split(/[;,／/]|\s+[×&]\s+/).map((item) => item.trim()).filter(usable);
  if (Array.isArray(value)) return value.flatMap(stringValues);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return stringValues(record.name ?? record.label ?? record.value);
  }
  return [];
}

export function extractStructuredArtistMentions(raw: unknown): ArtistMention[] {
  if (!raw || typeof raw !== "object") return [];
  const result: ArtistMention[] = [];
  const walk = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (STRUCTURED_KEYS.has(key.toLowerCase())) {
        for (const name of stringValues(child)) result.push({ name, role: key.toLowerCase().includes("creator") ? "creator" : null, method: "structured_source" });
      } else if (child && typeof child === "object") walk(child);
    }
  };
  walk(raw);
  return dedupeMentions(result);
}

export function extractKnownArtistsFromTitle(title: string, artists: MatchableArtist[]): ArtistMention[] {
  const haystack = normalizeArtistName(title);
  const candidates = artists.flatMap((artist) => [artist.name, artist.name_en || "", ...(artist.aliases || [])]
    .filter(usable).map((name) => ({ artist, name, normalized: normalizeArtistName(name) })))
    .filter((item) => haystack.includes(item.normalized))
    .sort((a, b) => b.normalized.length - a.normalized.length);
  const selected: typeof candidates = [];
  for (const candidate of candidates) {
    if (selected.some((item) => item.artist.id === candidate.artist.id || item.normalized.includes(candidate.normalized))) continue;
    selected.push(candidate);
  }
  return dedupeMentions(selected.map((item) => ({ name: item.name, role: null, method: "title_exact_master_name" as const })));
}

export function matchArtistMention(mention: string, artists: MatchableArtist[]) {
  const needle = normalizeArtistName(mention);
  const candidates = artists.filter((artist) => [artist.name, artist.name_en || "", ...(artist.aliases || [])]
    .some((name) => normalizeArtistName(name) === needle));
  return { status: candidates.length === 1 ? "matched" as const : candidates.length > 1 ? "ambiguous" as const : "unmatched" as const, candidates };
}

function dedupeMentions(mentions: ArtistMention[]) {
  const seen = new Set<string>();
  return mentions.filter((mention) => { const key = normalizeArtistName(mention.name); if (!key || seen.has(key)) return false; seen.add(key); return true; });
}
