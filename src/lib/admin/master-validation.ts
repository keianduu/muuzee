import { assertHttpUrl, nullableText } from "./http";
import { MASTER_CONFIGS, type MasterEntity, type MasterField } from "./master-config";
import { workDisplayTitleJa } from "@/lib/work-title";

export type MasterValues = Record<string, string | number | boolean | string[] | null>;

function parseField(field: MasterField, value: unknown) {
  if (field.type === "boolean") {
    if (typeof value === "boolean") return value;
    if (value === "true" || value === "1" || value === "yes") return true;
    if (value === "false" || value === "0" || value === "no" || value === "") return false;
    throw new Error(`${field.label}はtrue/falseで入力してください。`);
  }
  if (field.type === "aliases") {
    if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
    return String(value || "").split("|").map((item) => item.trim()).filter(Boolean);
  }
  const text = nullableText(value);
  if (!text) return null;
  if (field.type === "number" || field.type === "year") {
    const number = Number(text);
    if (!Number.isFinite(number)) throw new Error(`${field.label}は数値で入力してください。`);
    if (field.type === "year" && (number < -10000 || number > 9999 || !Number.isInteger(number))) throw new Error(`${field.label}の範囲が不正です。`);
    return number;
  }
  if (field.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`${field.label}はYYYY-MM-DDで入力してください。`);
  if (field.type === "url") assertHttpUrl(text, field.label);
  if (field.options && !field.options.includes(text)) throw new Error(`${field.label}の値が不正です。`);
  return text;
}

export function normalizeMasterValues(entity: MasterEntity, input: Record<string, unknown>, options: { partial?: boolean } = {}) {
  const config = MASTER_CONFIGS[entity];
  const values: MasterValues = {};
  for (const field of config.fields) {
    if (options.partial && !(field.key in input)) continue;
    values[field.key] = parseField(field, input[field.key]);
  }
  const title = values[config.titleKey];
  if (!options.partial && entity !== "works" && (!title || typeof title !== "string")) throw new Error(`${config.label} ${config.titleKey}は必須です。`);
  if (!options.partial && entity === "works") {
    const displayTitle = workDisplayTitleJa(values);
    if (!displayTitle) throw new Error("Workは日本語タイトル・英語タイトル・原題・Legacy titleのいずれかが必須です。");
    if (!values.title) values.title = displayTitle;
  }
  if (entity === "venues") {
    if ((values.latitude == null) !== (values.longitude == null)) throw new Error("LatitudeとLongitudeは両方入力してください。");
    const country = values.country_code;
    if (country && (typeof country !== "string" || !/^[A-Za-z]{2}$/.test(country))) throw new Error("Country codeは2文字で入力してください。");
    if (typeof country === "string") values.country_code = country.toUpperCase();
  }
  if (entity === "artists") {
    for (const key of ["nationality_country_code", "birth_country_code"]) {
      const country = values[key];
      if (country && (typeof country !== "string" || !/^[A-Za-z]{2}$/.test(country))) throw new Error(`${key}は2文字で入力してください。`);
      if (typeof country === "string") values[key] = country.toUpperCase();
    }
  }
  if (entity === "works" && values.created_year_from != null && values.created_year_to != null && Number(values.created_year_from) > Number(values.created_year_to)) {
    throw new Error("Created year fromはto以前にしてください。");
  }
  return values;
}

export function valuesEqual(a: unknown, b: unknown) {
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a || []) === JSON.stringify(b || []);
  if (a == null && b == null) return true;
  return String(a) === String(b);
}
