const ADDRESS_KEYS = ["所在地", "住所", "location", "address"];

export type WikipediaSite = { language: "ja" | "en"; title: string };
export type WikipediaAddress = {
  address: string | null;
  rawAddress: string | null;
  sourceField: string | null;
  postalCode: string | null;
  notes: string[];
};

export function wikipediaSiteFromEntity(entity: { sitelinks?: Record<string, { title?: string }> } | null | undefined): WikipediaSite | null {
  const ja = entity?.sitelinks?.jawiki?.title;
  if (ja) return { language: "ja", title: ja };
  const en = entity?.sitelinks?.enwiki?.title;
  return en ? { language: "en", title: en } : null;
}

function splitTopLevel(value: string, separator: string) {
  const parts: string[] = [];
  let start = 0; let braces = 0; let brackets = 0;
  for (let index = 0; index < value.length; index += 1) {
    const pair = value.slice(index, index + 2);
    if (pair === "{{") { braces += 1; index += 1; continue; }
    if (pair === "}}") { braces = Math.max(0, braces - 1); index += 1; continue; }
    if (pair === "[[") { brackets += 1; index += 1; continue; }
    if (pair === "]]" ) { brackets = Math.max(0, brackets - 1); index += 1; continue; }
    if (value[index] === separator && braces === 0 && brackets === 0) { parts.push(value.slice(start, index)); start = index + 1; }
  }
  parts.push(value.slice(start));
  return parts;
}

function topLevelTemplates(wikitext: string) {
  const templates: string[] = [];
  let start = -1; let depth = 0;
  for (let index = 0; index < wikitext.length - 1; index += 1) {
    const pair = wikitext.slice(index, index + 2);
    if (pair === "{{") { if (depth === 0) start = index; depth += 1; index += 1; }
    else if (pair === "}}" && depth > 0) {
      depth -= 1; index += 1;
      if (depth === 0 && start >= 0) { templates.push(wikitext.slice(start + 2, index - 1)); start = -1; }
    }
  }
  return templates;
}

function normalizeKey(value: string) { return value.normalize("NFKC").toLowerCase().replace(/[\s_-]/g, ""); }

function templateParameters(template: string) {
  const parts = splitTopLevel(template, "|");
  const params = new Map<string, string>();
  for (const part of parts.slice(1)) {
    const equals = splitTopLevel(part, "=");
    if (equals.length < 2) continue;
    params.set(normalizeKey(equals.shift()!.trim()), equals.join("=").trim());
  }
  return { name: normalizeKey(parts[0] || ""), params };
}

function pickParameterEntry(params: Map<string, string>, keys: string[]) {
  for (const key of keys.map(normalizeKey)) {
    const value = params.get(key)?.trim();
    if (value) return { key, value };
  }
  return null;
}

function removeBalancedTemplates(value: string) {
  let output = ""; let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const pair = value.slice(index, index + 2);
    if (pair === "{{") { depth += 1; index += 1; continue; }
    if (pair === "}}" && depth > 0) { depth -= 1; index += 1; continue; }
    if (depth === 0) output += value[index];
  }
  return output;
}

export function cleanWikipediaAddress(value: string | null | undefined) {
  if (!value) return null;
  let text = value.replace(/<!--[\s\S]*?-->/g, "").replace(/<ref\b[^>]*\/>/gi, "").replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "").replace(/<br\s*\/?>/gi, " ");
  text = text.replace(/\{\{(?:lang|仮リンク|ill)\|[^|{}]+\|([^{}|]+)(?:\|[^{}]*)?\}\}/gi, "$1");
  text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, "$1");
  text = text.replace(/\[(https?:\/\/\S+)\s+([^\]]+)\]/g, "$2").replace(/\[(https?:\/\/[^\]]+)\]/g, "");
  text = removeBalancedTemplates(text).replace(/<[^>]+>/g, " ").replace(/'{2,}/g, "").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&");
  return text.replace(/\s+/g, " ").trim().replace(/^[・･,，、;；:\s]+/, "") || null;
}

function extractPostal(value: string | null) {
  const match = value?.normalize("NFKC").match(/(?:〒\s*)?(\d{3})[-ー－](\d{4})/);
  return match ? `${match[1]}-${match[2]}` : null;
}

export function extractWikipediaAddress(wikitext: string): WikipediaAddress {
  const candidates = topLevelTemplates(wikitext).map(templateParameters).map((template) => ({
    ...template,
    score: ADDRESS_KEYS.filter((key) => template.params.has(normalizeKey(key))).length + (/infobox|基礎情報|博物館|美術館/.test(template.name) ? 2 : 0),
  })).sort((left, right) => right.score - left.score);
  const infobox = candidates[0];
  if (!infobox || infobox.score < 2) return { address: null, rawAddress: null, sourceField: null, postalCode: null, notes: ["recognizable infobox/template not found"] };
  const addressEntry = pickParameterEntry(infobox.params, ADDRESS_KEYS);
  const rawAddress = addressEntry?.value || null;
  const address = cleanWikipediaAddress(rawAddress);
  const postalRaw = pickParameterEntry(infobox.params, ["郵便番号", "所在地郵便番号", "postal_code", "postal code", "postalcode"])?.value || null;
  return { address, rawAddress, sourceField: addressEntry?.key || null, postalCode: extractPostal(postalRaw) || extractPostal(rawAddress), notes: address ? [] : ["explicit address field not found"] };
}

export function isSafeAutomaticWikipediaAddress(address: string | null, language: string) {
  if (!address) return false;
  if (address.length > 200 || /\{\{|\}\}|\[\[|\]\]|\|/.test(address)) return false;
  return language === "ja" || /[\u3040-\u30ff\u3400-\u9fff]/.test(address);
}

export function hasMultipleLocationSignal(description: string | null | undefined) {
  return Boolean(description && /(?:および|及び|ならびに|並びに|複数の(?:所在地|拠点)|multiple locations?|locations? in .+ and )/i.test(description));
}

export function decideWikipediaAddressApplication(input: { currentAddress: string | null; currentSource?: string | null; incomingAddress: string | null }) {
  if (!input.incomingAddress) return "missing" as const;
  if (!input.currentAddress?.trim()) return "apply" as const;
  const normalize = (value: string) => value.normalize("NFKC").replace(/[\s〒,，、。・･―ー−－-]/g, "").toLowerCase();
  if (normalize(input.currentAddress) === normalize(input.incomingAddress)) return "unchanged" as const;
  return "conflict" as const;
}

export function wikipediaProvenanceRow(input: { venueId: string; sourceRecordId: string; articleUrl: string; address: string }) {
  return {
    venue_id: input.venueId,
    field_name: "address",
    source: "wikipedia",
    source_url: input.articleUrl,
    source_record_id: input.sourceRecordId,
    value_snapshot: input.address,
    generated_by_ai: false,
    review_status: "applied",
    is_current: true,
  };
}
