import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicExhibitionDetail, type PublicExhibitionOccurrenceDTO } from "@/lib/public/exhibition-detail";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

function formatDate(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
}

function dateRange(occurrence: PublicExhibitionOccurrenceDTO) {
  const start = formatDate(occurrence.startDate);
  const end = formatDate(occurrence.endDate);
  if (start && end) return `${start} — ${end}`;
  return start ?? end ?? "会期情報を準備中";
}

function venueLocation(occurrence: PublicExhibitionOccurrenceDTO) {
  const { venue } = occurrence;
  return [venue.prefecture, venue.city, venue.address].filter(Boolean).join(" · ");
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const exhibition = await getPublicExhibitionDetail(slug);
    if (!exhibition) return { title: "展覧会が見つかりません | Muuzee" };
    return {
      title: `${exhibition.title} | Muuzee`,
      description: exhibition.description?.slice(0, 150) ?? `${exhibition.title}の展覧会情報`,
    };
  } catch {
    return { title: "展覧会 | Muuzee" };
  }
}

export default async function ExhibitionDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const exhibition = await getPublicExhibitionDetail(slug);
  if (!exhibition) notFound();

  const firstOccurrence = exhibition.occurrences[0] ?? null;

  return (
    <main className={styles.page}>
      <div className={styles.brandBar} aria-label="Muuzee">
        <span className={styles.brand}>Muuzee</span>
        <span className={styles.brandMessage}>Discover art. Broaden your world.</span>
      </div>

      <section className={styles.hero} aria-label="展覧会メイン画像">
        {exhibition.hero ? (
          <figure className={styles.heroFigure}>
            <img src={exhibition.hero.url} alt={exhibition.title} />
            {exhibition.hero.credit ? <figcaption>{exhibition.hero.credit}</figcaption> : null}
          </figure>
        ) : (
          <div className={styles.heroFallback} role="img" aria-label={`${exhibition.title}の画像は準備中です`}>
            <span>MUUZEE</span>
          </div>
        )}
      </section>

      <article className={styles.sheet}>
        <div className={styles.container}>
          <header className={styles.titleBlock}>
            <div className={styles.pills}>
              {exhibition.exhibitionType ? <span>{exhibition.exhibitionType}</span> : null}
              {exhibition.tags.slice(0, 3).map((tag) => <span key={tag.id}>{tag.name}</span>)}
            </div>
            <h1>{exhibition.title}</h1>
            {exhibition.titleEn ? <p className={styles.titleEn}>{exhibition.titleEn}</p> : null}
            {firstOccurrence ? <p className={styles.primaryVenue}>{firstOccurrence.venue.name}</p> : null}
          </header>

          <div className={styles.leadGrid}>
            <section aria-labelledby="about-heading">
              <p className={styles.kicker}>About</p>
              <h2 id="about-heading">展覧会について</h2>
              {exhibition.description ? (
                <p className={styles.description}>{exhibition.description}</p>
              ) : (
                <p className={styles.quietState}>展覧会の紹介文は現在準備中です。</p>
              )}
              {exhibition.officialUrl ? (
                <a className={styles.textLink} href={exhibition.officialUrl} target="_blank" rel="noreferrer">
                  公式サイトを見る ↗
                </a>
              ) : null}
            </section>

            <aside className={styles.infoCard} aria-label="開催概要">
              <dl>
                <div><dt>会期</dt><dd>{firstOccurrence ? dateRange(firstOccurrence) : "準備中"}</dd></div>
                <div><dt>会場</dt><dd>{firstOccurrence?.venue.name ?? "準備中"}</dd></div>
                <div><dt>所在地</dt><dd>{firstOccurrence ? venueLocation(firstOccurrence) || "準備中" : "準備中"}</dd></div>
              </dl>
              {firstOccurrence?.ticketUrl ? (
                <a className={styles.primaryLink} href={firstOccurrence.ticketUrl} target="_blank" rel="noreferrer">チケット情報 ↗</a>
              ) : null}
            </aside>
          </div>

          <section className={styles.section} aria-labelledby="venues-heading">
            <div className={styles.sectionHead}><div><p className={styles.kicker}>Venue & Schedule</p><h2 id="venues-heading">会場・開催日程</h2></div></div>
            {exhibition.occurrences.length ? (
              <div className={styles.occurrenceGrid}>
                {exhibition.occurrences.map((occurrence) => (
                  <article className={styles.occurrenceCard} key={occurrence.id}>
                    <p className={styles.occurrenceDate}>{dateRange(occurrence)}</p>
                    <h3>{occurrence.venue.name}</h3>
                    <p>{venueLocation(occurrence) || "所在地情報を準備中"}</p>
                    {occurrence.openingHours ? <p>開館時間：{occurrence.openingHours}</p> : null}
                    {occurrence.closedDays ? <p>休館：{occurrence.closedDays}</p> : null}
                    {occurrence.ticketUrl ? <a className={styles.textLink} href={occurrence.ticketUrl} target="_blank" rel="noreferrer">チケット情報 ↗</a> : null}
                  </article>
                ))}
              </div>
            ) : <p className={styles.quietState}>公開できる会場・開催日程情報は現在準備中です。</p>}
          </section>

          <section className={styles.section} aria-labelledby="artists-heading">
            <div className={styles.sectionHead}><div><p className={styles.kicker}>Artists</p><h2 id="artists-heading">参加アーティスト</h2></div></div>
            {exhibition.artists.length ? (
              <div className={styles.artistList}>
                {exhibition.artists.map((artist) => (
                  <article className={styles.artistRow} key={artist.id}>
                    {artist.image ? <img className={styles.artistImage} src={artist.image.url} alt="" /> : <div className={styles.artistFallback} aria-hidden="true">{artist.name.slice(0, 1)}</div>}
                    <div className={styles.artistCopy}>
                      <h3>{artist.name}</h3>
                      <p>{[artist.nameEn, artist.role, artist.nationalityCountryCode].filter(Boolean).join(" · ")}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className={styles.quietState}>公開できる参加アーティスト情報は現在準備中です。</p>}
          </section>
        </div>
      </article>
    </main>
  );
}
