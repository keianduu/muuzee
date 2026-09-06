export type WikipediaArtistProfile = {
  nationalityCountryCode: string | null;
  nationalityRaw: string | null;
  nameEn: string | null;
  aliases: string[];
  birthYear: number | null;
  deathYear: number | null;
  birthPlace: string | null;
  explicitNationality: boolean;
};

const NATIONALITY_CODES: Record<string, string> = {
  japan: "JP", japanese: "JP", jpn: "JP", 日本: "JP", 日本国: "JP",
  france: "FR", french: "FR", fra: "FR", フランス: "FR",
  germany: "DE", german: "DE", deu: "DE", ドイツ: "DE",
  italy: "IT", italian: "IT", ita: "IT", イタリア: "IT",
  spain: "ES", spanish: "ES", esp: "ES", スペイン: "ES",
  netherlands: "NL", dutch: "NL", nld: "NL", オランダ: "NL",
  belgium: "BE", belgian: "BE", bel: "BE", ベルギー: "BE",
  switzerland: "CH", swiss: "CH", che: "CH", スイス: "CH",
  austria: "AT", austrian: "AT", aut: "AT", オーストリア: "AT",
  "united kingdom": "GB", british: "GB", england: "GB", english: "GB", gbr: "GB", イギリス: "GB", 英国: "GB",
  "united states": "US", american: "US", usa: "US", アメリカ: "US", アメリカ合衆国: "US",
  china: "CN", chinese: "CN", chn: "CN", 中国: "CN",
  korea: "KR", korean: "KR", kor: "KR", 韓国: "KR", 大韓民国: "KR",
  russia: "RU", russian: "RU", rus: "RU", ロシア: "RU",
  australia: "AU", australian: "AU", aus: "AU", オーストラリア: "AU",
  canada: "CA", canadian: "CA", can: "CA", カナダ: "CA",
  mexico: "MX", mexican: "MX", mex: "MX", メキシコ: "MX",
  brazil: "BR", brazilian: "BR", bra: "BR", ブラジル: "BR",
};

function splitTopLevel(value: string, separator: string) {
  const parts: string[] = []; let start = 0; let braces = 0; let brackets = 0;
  for (let i = 0; i < value.length; i += 1) {
    const pair = value.slice(i, i + 2);
    if (pair === "{{") { braces += 1; i += 1; continue; }
    if (pair === "}}") { braces = Math.max(0, braces - 1); i += 1; continue; }
    if (pair === "[[") { brackets += 1; i += 1; continue; }
    if (pair === "]]" ) { brackets = Math.max(0, brackets - 1); i += 1; continue; }
    if (value[i] === separator && braces === 0 && brackets === 0) { parts.push(value.slice(start, i)); start = i + 1; }
  }
  parts.push(value.slice(start)); return parts;
}

function topLevelTemplates(wikitext: string) {
  const rows: string[] = []; let start = -1; let depth = 0;
  for (let i = 0; i < wikitext.length - 1; i += 1) {
    const pair = wikitext.slice(i, i + 2);
    if (pair === "{{") { if (!depth) start = i; depth += 1; i += 1; }
    else if (pair === "}}" && depth) { depth -= 1; i += 1; if (!depth && start >= 0) { rows.push(wikitext.slice(start + 2, i - 1)); start = -1; } }
  }
  return rows;
}

function normalizedKey(value: string) { return value.normalize("NFKC").toLowerCase().replace(/[\s_-]/g, ""); }

function parameters(template: string) {
  const parts = splitTopLevel(template, "|"); const values = new Map<string, string>();
  for (const part of parts.slice(1)) { const equal = splitTopLevel(part, "="); if (equal.length > 1) values.set(normalizedKey(equal.shift()!.trim()), equal.join("=").trim()); }
  return { name: normalizedKey(parts[0] || ""), values };
}

export function cleanWikipediaArtistValue(value: string | null | undefined) {
  if (!value) return null;
  let text = value.replace(/<!--[\s\S]*?-->/g, "").replace(/<ref\b[^>]*\/>/gi, "").replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "").replace(/<br\s*\/?>/gi, " ");
  text = text.replace(/\{\{(?:lang|nowrap|small|仮リンク|ill)\|[^|{}]+\|([^{}|]+)(?:\|[^{}]*)?\}\}/gi, "$1");
  text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, "$1");
  text = text.replace(/\{\{[^{}]+\}\}/g, " ").replace(/<[^>]+>/g, " ").replace(/'{2,}/g, "").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&");
  return text.replace(/\s+/g, " ").trim() || null;
}

function pick(values: Map<string, string>, keys: string[]) {
  for (const key of keys) { const value = values.get(normalizedKey(key)); if (value?.trim()) return value.trim(); }
  return null;
}

function explicitNationality(raw: string | null) {
  if (!raw) return null;
  const tokens = [raw, ...[...raw.matchAll(/\{\{\s*([^|{}]+).*?\}\}/g)].map((match) => match[1]), ...(cleanWikipediaArtistValue(raw)?.split(/[／/,;、・]|\band\b/i) || [])];
  const codes = [...new Set(tokens.map((token) => NATIONALITY_CODES[token.normalize("NFKC").replace(/[\[\]{}]/g, "").trim().toLowerCase()]).filter(Boolean))];
  return codes.length === 1 ? codes[0] : null;
}

function year(value: string | null, position: "first" | "max" = "first") {
  if (!value) return null;
  const matches = [...value.matchAll(/(?:^|[^0-9])(1[0-9]{3}|20[0-9]{2})(?=[^0-9]|$)/g)];
  const match = position === "max" ? matches.sort((a, b) => Number(b[1]) - Number(a[1]))[0] : matches[0];
  return match ? Number(match[1]) : null;
}

export function extractWikipediaArtistProfile(wikitext: string, language: "ja" | "en"): WikipediaArtistProfile {
  const candidate = topLevelTemplates(wikitext).map(parameters).map((row) => ({ ...row, score: /infobox|基礎情報|人物/.test(row.name) ? 2 : 0 })).sort((a, b) => b.score - a.score)[0];
  if (!candidate || candidate.score < 2) return { nationalityCountryCode: null, nationalityRaw: null, nameEn: null, aliases: [], birthYear: null, deathYear: null, birthPlace: null, explicitNationality: false };
  const nationalityRaw = pick(candidate.values, ["国籍", "nationality"]);
  const aliasRaw = pick(candidate.values, ["別名", "別称", "other_names", "other name", "alias"]);
  const aliases = (cleanWikipediaArtistValue(aliasRaw)?.split(/[／/,;、]|<br\s*\/?>/i) || []).map((value) => value.trim()).filter(Boolean);
  return {
    nationalityCountryCode: explicitNationality(nationalityRaw),
    nationalityRaw: cleanWikipediaArtistValue(nationalityRaw),
    nameEn: language === "en" ? cleanWikipediaArtistValue(pick(candidate.values, ["name"])) : cleanWikipediaArtistValue(pick(candidate.values, ["name_en", "英語名"])),
    aliases: [...new Set(aliases)],
    birthYear: year(pick(candidate.values, ["birth_date", "生年月日", "誕生日", "生年"])),
    deathYear: year(pick(candidate.values, ["death_date", "没年月日", "死没日", "没年"]), "max"),
    birthPlace: cleanWikipediaArtistValue(pick(candidate.values, ["birth_place", "出生地", "生地"])),
    explicitNationality: Boolean(nationalityRaw),
  };
}
