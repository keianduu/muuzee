"use client";

import type { ExhibitionRow, OccurrenceRow, VenueRow } from "@/lib/admin/types";
import { AdminFieldLabel } from "./admin-field-label";

export function ExhibitionBasicEditor({ exhibition, occurrence, venue, busy, onSave }: {
  exhibition: ExhibitionRow;
  occurrence: OccurrenceRow | null;
  venue: VenueRow | null;
  busy: boolean;
  onSave: (form: FormData) => Promise<void>;
}) {
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave(new FormData(event.currentTarget));
  }

  return <form className="card exhibition-basic-form" onSubmit={submit}>
    <h2>基本情報</h2>
    <div className="form-grid">
      <div className="field full"><AdminFieldLabel htmlFor="exhibition-title" label="タイトル" fieldKey="title"/><input id="exhibition-title" name="title" required defaultValue={exhibition.title}/></div>
      <div className="field"><AdminFieldLabel htmlFor="exhibition-title-en" label="英語タイトル" fieldKey="title_en"/><input id="exhibition-title-en" name="title_en" defaultValue={exhibition.title_en || ""}/></div>
      <div className="field"><AdminFieldLabel htmlFor="exhibition-type" label="展示会種別" fieldKey="exhibition_type"/><input id="exhibition-type" name="exhibition_type" defaultValue={exhibition.exhibition_type || ""}/></div>
      <div className="field full"><AdminFieldLabel htmlFor="exhibition-description" label="概要" fieldKey="description"/><textarea id="exhibition-description" name="description" defaultValue={exhibition.description || ""}/></div>
      <div className="field full"><AdminFieldLabel htmlFor="exhibition-official-url" label="公式URL" fieldKey="official_url"/><input id="exhibition-official-url" name="official_url" type="url" defaultValue={exhibition.official_url || ""}/></div>
      <div className="field"><AdminFieldLabel htmlFor="exhibition-venue-name" label="会場" fieldKey="venue_name"/><input id="exhibition-venue-name" name="venue_name" required defaultValue={venue?.name || ""}/></div>
      <div className="field"><AdminFieldLabel htmlFor="exhibition-venue-address" label="住所" fieldKey="venue_address"/><input id="exhibition-venue-address" name="venue_address" defaultValue={venue?.address || ""}/></div>
      <div className="field"><AdminFieldLabel htmlFor="exhibition-start-date" label="開始日" fieldKey="start_date"/><input id="exhibition-start-date" name="start_date" type="date" defaultValue={occurrence?.start_date || ""}/></div>
      <div className="field"><AdminFieldLabel htmlFor="exhibition-end-date" label="終了日" fieldKey="end_date"/><input id="exhibition-end-date" name="end_date" type="date" defaultValue={occurrence?.end_date || ""}/></div>
      <div className="field"><AdminFieldLabel htmlFor="exhibition-opening-hours" label="開館時間" fieldKey="opening_hours_text"/><textarea id="exhibition-opening-hours" name="opening_hours_text" defaultValue={occurrence?.opening_hours_text || ""}/></div>
      <div className="field"><AdminFieldLabel htmlFor="exhibition-closed-days" label="休館日" fieldKey="closed_days_text"/><textarea id="exhibition-closed-days" name="closed_days_text" defaultValue={occurrence?.closed_days_text || ""}/></div>
      <div className="field full"><AdminFieldLabel htmlFor="exhibition-ticket-url" label="チケットURL" fieldKey="ticket_url"/><input id="exhibition-ticket-url" name="ticket_url" type="url" defaultValue={occurrence?.ticket_url || ""}/></div>
    </div>
    <div className="actions"><button className="button" disabled={busy}>保存</button></div>
  </form>;
}
