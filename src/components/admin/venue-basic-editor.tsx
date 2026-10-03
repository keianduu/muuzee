"use client";

import { useRef, useState } from "react";
import type { VenueRow } from "@/lib/admin/types";
import { COUNTRY_OPTIONS, JP_PREFECTURES, REGIONS_BY_COUNTRY, countryOption, countryOptionLabel, subdivisionModeForCountry } from "@/lib/admin/geo-master";
import { AdminFieldLabel } from "./admin-field-label";

const VENUE_TYPES = [
  ["museum", "美術館・博物館"],
  ["gallery", "ギャラリー"],
  ["art_space", "アートスペース"],
  ["commercial_space", "商業施設"],
  ["other", "その他"],
] as const;

type FormValues = {
  name: string;
  name_en: string;
  venue_type: string;
  country_code: string;
  region: string;
  postal_code: string;
  prefecture: string;
  city: string;
  address: string;
  latitude: string;
  longitude: string;
  official_url: string;
  inception_year: string;
  description: string;
  access_text: string;
  opening_hours_text: string;
  closed_days_text: string;
  opening_note: string;
};

function initialValues(venue: VenueRow): FormValues {
  return {
    name: venue.name || "",
    name_en: venue.name_en || "",
    venue_type: venue.venue_type || "other",
    country_code: venue.country_code || "JP",
    region: venue.region || "",
    postal_code: venue.postal_code || "",
    prefecture: venue.prefecture || "",
    city: venue.city || "",
    address: venue.address || "",
    latitude: venue.latitude == null ? "" : String(venue.latitude),
    longitude: venue.longitude == null ? "" : String(venue.longitude),
    official_url: venue.official_url || "",
    inception_year: venue.inception_year == null ? "" : String(venue.inception_year),
    description: venue.description || "",
    access_text: venue.access_text || "",
    opening_hours_text: venue.opening_hours_text || "",
    closed_days_text: venue.closed_days_text || "",
    opening_note: venue.opening_note || "",
  };
}
export function VenueBasicEditor({ venue, busy, onSave }: { venue: VenueRow; busy: boolean; onSave: (values: Record<string, string>) => Promise<void> }) {
  const [values, setValues] = useState(() => initialValues(venue));
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoMessage, setGeoMessage] = useState("");
  const [coordinateSourceHint, setCoordinateSourceHint] = useState("");
  const [coordinatePrecisionHint, setCoordinatePrecisionHint] = useState("");
  const lastPreviewAddress = useRef("");
  const mode = subdivisionModeForCountry(values.country_code);
  const currentCountry = countryOption(values.country_code);
  const regionOptions = REGIONS_BY_COUNTRY[values.country_code] || [];
  const mapUrl = values.latitude && values.longitude ? `https://www.google.com/maps?q=${encodeURIComponent(`${values.latitude},${values.longitude}`)}` : null;

  function update(key: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function updateCoordinate(key: "latitude" | "longitude", value: string) {
    update(key, value);
    setCoordinateSourceHint("manual");
    setCoordinatePrecisionHint("exact");
  }

  async function previewAddress(force = false) {
    const normalized = `${values.country_code}:${values.address.trim()}`;
    if (!values.address.trim() || values.country_code !== "JP" || (!force && normalized === lastPreviewAddress.current)) return;
    lastPreviewAddress.current = normalized;
    setGeoBusy(true); setGeoMessage("");
    try {
      const response = await fetch("/api/admin/venues/address-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ countryCode: values.country_code, address: values.address }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "住所から位置情報を取得できませんでした。");
      setValues((current) => ({ ...current, prefecture: body.prefecture || current.prefecture, city: body.city || current.city, latitude: String(body.latitude), longitude: String(body.longitude) }));
      setCoordinateSourceHint("geolonia");
      setCoordinatePrecisionHint(body.precision || "town");
      setGeoMessage(`${body.prefecture || ""}${body.city || ""} / ${body.matchedLocality || ""} を取得しました。保存前に確認できます。`);
    } catch (error) {
      setGeoMessage(error instanceof Error ? error.message : "住所から位置情報を取得できませんでした。");
    } finally { setGeoBusy(false); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave({ ...values, coordinate_source_hint: coordinateSourceHint, coordinate_precision_hint: coordinatePrecisionHint });
  }

  return <form className="card venue-basic-form" onSubmit={submit}>
    <h2>基本情報</h2>
    <div className="venue-basic-fields">
      <div className="field"><AdminFieldLabel htmlFor="venue-name" label="名称" fieldKey="name"/><input id="venue-name" required value={values.name} onChange={(event) => update("name", event.target.value)}/></div>
      <div className="field"><AdminFieldLabel htmlFor="venue-name-en" label="英語名" fieldKey="name_en"/><input id="venue-name-en" value={values.name_en} onChange={(event) => update("name_en", event.target.value)}/></div>
      <fieldset className="field venue-type-field"><legend><span className="admin-field-label-main">会場種別</span><span className="admin-field-label-key">venue_type</span></legend><div className="venue-radio-grid">{VENUE_TYPES.map(([value, label]) => <label key={value}><input type="radio" name="venue_type" value={value} checked={values.venue_type === value} onChange={() => update("venue_type", value)}/><span>{label}</span></label>)}</div></fieldset>
      <div className="field"><AdminFieldLabel htmlFor="venue-country" label="国" fieldKey="country_code"/><select id="venue-country" value={values.country_code} onChange={(event) => update("country_code", event.target.value)}>{!currentCountry && values.country_code && <option value={values.country_code}>{`未登録国: ${values.country_code}`}</option>}{COUNTRY_OPTIONS.map((option) => <option value={option.code} key={option.code}>{countryOptionLabel(option)}</option>)}</select></div>
      <div className="field"><AdminFieldLabel htmlFor="venue-address" label="住所" fieldKey="address"/><input id="venue-address" value={values.address} onChange={(event) => update("address", event.target.value)} onBlur={() => previewAddress(false)}/><div className="field-support-row"><button type="button" className="button secondary" disabled={geoBusy || values.country_code !== "JP" || !values.address.trim()} onClick={() => previewAddress(true)}>{geoBusy ? "取得中…" : "住所から位置情報を取得"}</button></div>{geoMessage && <small className="muted" role="status">{geoMessage}</small>}</div>
      {mode === "jp" ? <>
        <input type="hidden" name="region" value={values.region}/>
        <div className="field"><AdminFieldLabel htmlFor="venue-postal" label="郵便番号" fieldKey="postal_code"/><input id="venue-postal" value={values.postal_code} onChange={(event) => update("postal_code", event.target.value)}/></div>
        <div className="field"><AdminFieldLabel htmlFor="venue-prefecture" label="都道府県" fieldKey="prefecture"/><select id="venue-prefecture" value={values.prefecture} onChange={(event) => update("prefecture", event.target.value)}><option value="">選択してください</option>{JP_PREFECTURES.map((prefecture) => <option key={prefecture}>{prefecture}</option>)}</select></div>
        <div className="field"><AdminFieldLabel htmlFor="venue-city" label="市区町村" fieldKey="city"/><input id="venue-city" value={values.city} onChange={(event) => update("city", event.target.value)}/></div>
      </> : <>
        <input type="hidden" name="postal_code" value={values.postal_code}/><input type="hidden" name="prefecture" value={values.prefecture}/><input type="hidden" name="city" value={values.city}/>
        <div className="field"><AdminFieldLabel htmlFor="venue-region" label="地域" fieldKey="region"/>{regionOptions.length ? <select id="venue-region" value={values.region} onChange={(event) => update("region", event.target.value)}><option value="">選択してください</option>{regionOptions.map((region) => <option key={region}>{region}</option>)}</select> : <input id="venue-region" value={values.region} onChange={(event) => update("region", event.target.value)}/>}</div>
      </>}
      <div className="venue-coordinate-group"><div className="field"><AdminFieldLabel htmlFor="venue-latitude" label="緯度" fieldKey="latitude"/><input id="venue-latitude" type="number" step="any" value={values.latitude} onChange={(event) => updateCoordinate("latitude", event.target.value)}/></div><div className="field"><AdminFieldLabel htmlFor="venue-longitude" label="経度" fieldKey="longitude"/><input id="venue-longitude" type="number" step="any" value={values.longitude} onChange={(event) => updateCoordinate("longitude", event.target.value)}/></div></div>
      {mapUrl && <a className="button secondary venue-map-link" href={mapUrl} target="_blank" rel="noreferrer">Google Mapsで確認 ↗</a>}
      <div className="field"><AdminFieldLabel htmlFor="venue-official-url" label="公式URL" fieldKey="official_url"/><input id="venue-official-url" type="url" value={values.official_url} onChange={(event) => update("official_url", event.target.value)}/></div>
      <div className="field"><AdminFieldLabel htmlFor="venue-inception-year" label="開館年" fieldKey="inception_year"/><input id="venue-inception-year" type="number" value={values.inception_year} onChange={(event) => update("inception_year", event.target.value)}/></div>
      <div className="field"><AdminFieldLabel htmlFor="venue-description" label="概要" fieldKey="description"/><textarea id="venue-description" value={values.description} onChange={(event) => update("description", event.target.value)}/></div>
      <div className="field"><AdminFieldLabel htmlFor="venue-access" label="アクセス" fieldKey="access_text"/><textarea id="venue-access" value={values.access_text} onChange={(event) => update("access_text", event.target.value)}/></div>
      <div className="field"><AdminFieldLabel htmlFor="venue-hours" label="開館時間" fieldKey="opening_hours_text"/><textarea id="venue-hours" value={values.opening_hours_text} onChange={(event) => update("opening_hours_text", event.target.value)}/></div>
      <div className="field"><AdminFieldLabel htmlFor="venue-closed" label="休館日" fieldKey="closed_days_text"/><textarea id="venue-closed" value={values.closed_days_text} onChange={(event) => update("closed_days_text", event.target.value)}/></div>
      <div className="field"><AdminFieldLabel htmlFor="venue-opening-note" label="開館補足" fieldKey="opening_note"/><textarea id="venue-opening-note" value={values.opening_note} onChange={(event) => update("opening_note", event.target.value)}/></div>
    </div>
    <div className="actions"><button className="button" disabled={busy}>保存</button></div>
  </form>;
}
