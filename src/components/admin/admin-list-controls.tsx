"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  binaryListValue,
  canonicalizeExhibitionScheduleQuery,
  listFilterQuery,
  normalizeExhibitionSchedule,
  normalizePublicationStatus,
  publicationTabQuery,
  splitListValue,
  workListViewQuery,
  type AdminListEntity,
  type PublicationListStatus,
  type WorkListView,
} from "@/lib/admin/master-list-state";

const PUBLICATION_TABS: Array<{ value: PublicationListStatus; label: string }> = [
  { value: "published", label: "公開" },
  { value: "unpublished", label: "非公開" },
  { value: "archived", label: "アーカイブ" },
];

const VENUE_TYPES = [
  ["museum", "美術館"],
  ["gallery", "ギャラリー"],
  ["art_space", "アートスペース"],
  ["commercial_space", "商業施設"],
  ["other", "その他"],
] as const;

function navigate(router: ReturnType<typeof useRouter>, pathname: string, query: string) {
  router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
}

function initialBinary(value?: string) {
  if (value === "present") return { present: true, missing: false };
  if (value === "missing") return { present: false, missing: true };
  return { present: true, missing: true };
}

function BinaryCheckboxes({ legend, value, onChange }: {
  legend: string;
  value: { present: boolean; missing: boolean };
  onChange: (next: { present: boolean; missing: boolean }) => void;
}) {
  return <fieldset className="admin-filter-group">
    <legend>{legend}</legend>
    <label className="admin-filter-check"><input type="checkbox" checked={value.present} onChange={(event) => onChange({ ...value, present: event.target.checked })}/>あり</label>
    <label className="admin-filter-check"><input type="checkbox" checked={value.missing} onChange={(event) => onChange({ ...value, missing: event.target.checked })}/>なし</label>
  </fieldset>;
}

export function AdminPublicationTabs({ entity, status }: { entity: AdminListEntity; status?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selected = normalizePublicationStatus(status);
  const currentQuery = entity === "exhibitions"
    ? canonicalizeExhibitionScheduleQuery(searchParams.toString())
    : searchParams.toString();

  return <div className="admin-publication-tabs" role="tablist" aria-label="公開状態">
    {PUBLICATION_TABS.map((tab) => <button
      key={tab.value}
      type="button"
      role="tab"
      aria-selected={selected === tab.value}
      className={selected === tab.value ? "is-active" : undefined}
      onClick={() => navigate(router, pathname, publicationTabQuery(currentQuery, tab.value))}
    >{tab.label}</button>)}
  </div>;
}

export function AdminWorkViewTabs({ view }: { view: WorkListView }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return <div className="master-view-tabs" role="tablist" aria-label="Worksデータ区分">
    {([['adopted', '採用済み'], ['candidates', '作品候補']] as const).map(([value, label]) => <button
      type="button"
      role="tab"
      id={`works-${value}-tab`}
      aria-controls={`works-${value}-panel`}
      aria-selected={view === value}
      className={view === value ? "is-active" : undefined}
      key={value}
      onClick={() => navigate(router, pathname, workListViewQuery(searchParams.toString(), value))}
    >{label}</button>)}
  </div>;
}

export function AdminListControls({ entity, params }: { entity: AdminListEntity; params: Record<string, string> }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const qRef = useRef<HTMLInputElement>(null);
  const detailSelected = Boolean(searchParams.get("selected"));
  const searchParamsKey = searchParams.toString();

  const [keyword, setKeyword] = useState(params.q ?? "");
  const [venueTypes, setVenueTypes] = useState(() => splitListValue(params.type));
  const [image, setImage] = useState(() => initialBinary(params.image));
  const [coordinates, setCoordinates] = useState(() => initialBinary(params.coordinates));
  const [artistRelation, setArtistRelation] = useState(() => initialBinary(params.artistRelation));
  const [holdingRelation, setHoldingRelation] = useState(() => initialBinary(params.holdingRelation));
  const [presentation, setPresentation] = useState(params.presentation ?? "");
  const [schedule, setSchedule] = useState(() => normalizeExhibitionSchedule(params.schedule));

  useEffect(() => {
    if (open) return;
    const current = new URLSearchParams(searchParamsKey);
    setKeyword(current.get("q") ?? "");
    setVenueTypes(splitListValue(current.get("type")));
    setImage(initialBinary(current.get("image") ?? undefined));
    setCoordinates(initialBinary(current.get("coordinates") ?? undefined));
    setArtistRelation(initialBinary(current.get("artistRelation") ?? undefined));
    setHoldingRelation(initialBinary(current.get("holdingRelation") ?? undefined));
    setPresentation(current.get("presentation") ?? "");
    setSchedule(normalizeExhibitionSchedule(current.get("schedule")));
  }, [open, searchParamsKey]);

  useEffect(() => {
    if (detailSelected) setOpen(false);
  }, [detailSelected]);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add("is-list-filter-drawer-open");
    window.requestAnimationFrame(() => qRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("is-list-filter-drawer-open");
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const apply = (event: FormEvent) => {
    event.preventDefault();
    const query = listFilterQuery(searchParams.toString(), entity, {
      q: keyword,
      type: venueTypes,
      image: binaryListValue(image.present, image.missing),
      coordinates: binaryListValue(coordinates.present, coordinates.missing),
      artistRelation: binaryListValue(artistRelation.present, artistRelation.missing),
      holdingRelation: binaryListValue(holdingRelation.present, holdingRelation.missing),
      presentation,
      schedule,
    });
    navigate(router, pathname, query);
    close();
  };

  const reset = () => {
    setKeyword("");
    setVenueTypes([]);
    setImage({ present: true, missing: true });
    setCoordinates({ present: true, missing: true });
    setArtistRelation({ present: true, missing: true });
    setHoldingRelation({ present: true, missing: true });
    setPresentation("");
    setSchedule("current_upcoming");
    navigate(router, pathname, listFilterQuery(searchParams.toString(), entity));
    close();
  };

  const toggleVenueType = (value: string, checked: boolean) => {
    setVenueTypes((current) => checked ? [...new Set([...current, value])] : current.filter((item) => item !== value));
  };

  return <>
    <AdminPublicationTabs entity={entity} status={params.status}/>
    {!detailSelected && <button
      ref={triggerRef}
      className="admin-list-filter-trigger"
      type="button"
      aria-label="検索・絞り込み"
      aria-expanded={open}
      aria-controls="admin-list-filter-drawer"
      onClick={() => setOpen(true)}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="m16 16 4 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
      <span>検索・絞り込み</span>
    </button>}
    {open && <div className="admin-list-filter-layer">
      <button className="admin-list-filter-backdrop" type="button" aria-label="検索・絞り込みを閉じる" onClick={() => close()}/>
      <aside ref={drawerRef} id="admin-list-filter-drawer" className="admin-list-filter-drawer" role="dialog" aria-modal="true" aria-labelledby="admin-list-filter-title">
        <header className="admin-list-filter-head">
          <div><p className="eyebrow">LIST UTILITY</p><h2 id="admin-list-filter-title">検索・絞り込み</h2></div>
          <button className="drawer-close" type="button" aria-label="閉じる" onClick={() => close()}>×</button>
        </header>
        <form className="admin-list-filter-form" onSubmit={apply}>
          <div className="admin-list-filter-body">
            <div className="field"><label htmlFor="admin-filter-q">キーワード</label><input ref={qRef} id="admin-filter-q" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="名前・タイトルで検索"/></div>
            {entity === "venues" && <fieldset className="admin-filter-group admin-filter-group-stack">
              <legend>Venue Type（会場種別）</legend>
              {VENUE_TYPES.map(([value, label]) => <label className="admin-filter-check" key={value}><input type="checkbox" checked={venueTypes.includes(value)} onChange={(event) => toggleVenueType(value, event.target.checked)}/>{label}</label>)}
            </fieldset>}
            <BinaryCheckboxes legend="Image（画像）" value={image} onChange={setImage}/>
            {entity === "venues" && <BinaryCheckboxes legend="Coordinates（座標）" value={coordinates} onChange={setCoordinates}/>}
            {entity === "works" && <>
              <BinaryCheckboxes legend="Artist relation" value={artistRelation} onChange={setArtistRelation}/>
              <BinaryCheckboxes legend="Holding relation" value={holdingRelation} onChange={setHoldingRelation}/>
              <div className="field"><label htmlFor="admin-filter-presentation">Presentation</label><select id="admin-filter-presentation" value={presentation} onChange={(event) => setPresentation(event.target.value)}><option value="">すべて</option><option value="permanent">Permanent</option><option value="currently_displayed">Currently displayed</option></select></div>
            </>}
            {entity === "exhibitions" && <div className="field"><label htmlFor="admin-filter-schedule">開催期間</label><select id="admin-filter-schedule" value={schedule} onChange={(event) => setSchedule(normalizeExhibitionSchedule(event.target.value))}><option value="current_upcoming">開催中・開催予定</option><option value="past">終了</option><option value="unknown">会期不明</option><option value="all">すべて</option></select></div>}
          </div>
          <footer className="admin-list-filter-footer"><button className="button secondary" type="button" onClick={reset}>リセット</button><button className="button" type="submit">適用</button></footer>
        </form>
      </aside>
    </div>}
  </>;
}
