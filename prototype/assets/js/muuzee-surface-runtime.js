/* Muuzee Discovery Surface — prototype DOM consumers */
(() => {
  "use strict";

  const source = window.MuuzeeSurfaceSource;
  if(!source) return;

  const esc = value => String(value ?? "").replace(/[&<>"']/g,char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));

  const posterCard = item => `
    <a class="poster-card" data-save-type="exhibition" data-save-id="${esc(item.id)}" href="${esc(item.href || `./exhibition.html?id=${encodeURIComponent(item.id)}`)}">
      <div class="poster-stage"><img src="${esc(item.src || "")}" alt="${esc(item.title)}" loading="lazy"></div>
      <div class="poster-status muuzee-pill ${item.status === "now" ? "muuzee-pill--status" : "muuzee-pill--neutral"}">${esc(item.statusLabel || "")}</div>
      <h3>${esc(item.title)}</h3>
      <p>${esc(item.venue || "")}</p>
      <p class="date">${esc(item.date || "")}</p>
    </a>
  `;

  const artistCard = item => {
    const image = item.image || item.img || "";
    const meta = item.country || (item.category || []).slice(0,1).join("");
    return `
      <a class="artist" data-save-type="artist" data-save-id="${esc(item.name)}" href="./artist.html?name=${encodeURIComponent(item.name)}">
        <img src="${esc(image)}" alt="${esc(item.name)}" loading="lazy" style="object-position:${esc(item.position || "center")}">
        <strong>${esc(item.name)}</strong>
        <span>${esc(meta)}</span>
      </a>
    `;
  };

  const museumCard = item => {
    const place = item.scope === "jp"
      ? [item.prefecture,item.location].filter(Boolean).join(" · ")
      : [item.city,item.country].filter(Boolean).join(" · ");
    return `
      <a class="museum-card" data-save-type="museum" data-save-id="${esc(item.id)}" href="./museum.html?id=${encodeURIComponent(item.id)}">
        <span class="museum-thumb" aria-hidden="true" style="background-image:url('${esc(item.image || "")}');background-size:cover;background-position:center"></span>
        <span><strong>${esc(item.name)}</strong><p>${esc(place)}</p></span>
      </a>
    `;
  };

  const relatedArtistCard = item => `
    <a class="related-artist" data-save-type="artist" data-save-id="${esc(item.name)}" href="./artist.html?name=${encodeURIComponent(item.name)}">
      <img src="${esc(item.image || item.img || "")}" alt="${esc(item.name)}" loading="lazy" style="object-position:${esc(item.position || "center")}">
      <strong>${esc(item.name)}</strong>
      <span>${esc((item.category || []).slice(0,2).join(" / "))}</span>
    </a>
  `;

  const exhibitionCatalog = () => window.MuuzeeExhibitionCatalog || [];
  const artistCatalog = () => window.MuuzeeArtistCatalog || [];
  const museumCatalog = () => window.MuuzeeMuseumCatalog || [];

  function currentExhibition(){
    const catalog = exhibitionCatalog();
    const id = new URLSearchParams(location.search).get("id");
    return catalog.find(item => item.id === id) || catalog[0] || null;
  }

  function currentArtist(){
    const catalog = artistCatalog();
    const name = new URLSearchParams(location.search).get("name");
    return catalog.find(item => item.name === name) || catalog[0] || null;
  }

  function currentMuseum(){
    const catalog = museumCatalog();
    const id = new URLSearchParams(location.search).get("id");
    return catalog.find(item => item.id === id) || catalog[0] || null;
  }

  async function renderHome(){
    const artistRail = document.querySelector(".artist-rail");
    const museumList = document.querySelector(".museum-list");
    const posterRail = document.querySelector(".main-surface .poster-rail") || document.querySelector(".poster-rail");
    if(!artistRail || !museumList || !posterRail) return false;

    const [recommended,featured,popular] = await Promise.all([
      source.resolve("home","recommendedExhibitions"),
      source.resolve("home","featuredArtists"),
      source.resolve("home","popularMuseums")
    ]);

    posterRail.innerHTML = recommended.items.map(posterCard).join("");
    artistRail.innerHTML = featured.items.map(artistCard).join("");
    museumList.innerHTML = popular.items.map(museumCard).join("");
    return true;
  }

  function bindExhibitionSummary(item){
    document.title = `${item.title} | Muuzee`;
    const hero = document.querySelector(".exhibition-hero img");
    const title = document.querySelector(".exhibition-sheet-title");
    const venue = document.querySelector(".exhibition-sheet-venue");
    const meta = [...document.querySelectorAll(".exhibition-sheet-meta .muuzee-pill")];
    const lead = document.querySelector(".lead-grid p");
    const mapTitle = document.querySelector(".map-copy h3");
    const mapLocation = document.querySelector(".map-copy p");

    if(hero){ hero.src = item.src || ""; hero.alt = item.title; }
    if(title) title.textContent = item.title;
    if(venue) venue.textContent = item.venue || "";
    if(meta[0]) meta[0].textContent = item.category || "";
    if(meta[1]){
      meta[1].textContent = item.statusLabel || "";
      meta[1].classList.toggle("muuzee-pill--status",item.status === "now");
      meta[1].classList.toggle("muuzee-pill--neutral",item.status !== "now");
    }
    if(lead) lead.textContent = item.description || "";
    if(mapTitle) mapTitle.textContent = item.venue || "";
    if(mapLocation) mapLocation.textContent = [item.city,item.area].filter(Boolean).join("・");
  }

  function renderExhibitionArtists(item){
    const root = document.querySelector("[data-exhibition-artists]");
    const toggle = document.querySelector("[data-exhibition-artists-toggle]");
    if(!root) return;

    const artists = (item.artistIds || [])
      .map(id => artistCatalog().find(artist => artist.id === id))
      .filter(Boolean);
    const savedKey = "muuzee:saved-artists";
    let saved = [];
    try{ saved = JSON.parse(localStorage.getItem(savedKey) || "[]"); }catch{}

    root.innerHTML = artists.map(artist => {
      const metadata = [
        (artist.category || []).slice(0,2).join(" / "),
        artist.place || artist.country || ""
      ].filter(Boolean);
      const isSaved = saved.includes(artist.name);
      return `
        <article class="exhibition-artist-row">
          <a class="exhibition-artist-main" href="./artist.html?name=${encodeURIComponent(artist.name)}">
            <img class="exhibition-artist-avatar" src="${esc(artist.image || artist.img || "")}" alt="${esc(artist.name)}" loading="lazy" style="object-position:${esc(artist.position || "center")}">
            <span class="exhibition-artist-copy"><strong>${esc(artist.name)}</strong><span class="exhibition-artist-meta">${metadata.map(value => `<span>${esc(value)}</span>`).join('<i aria-hidden="true">·</i>')}</span></span>
          </a>
          <button class="exhibition-artist-save${isSaved ? " is-saved" : ""}" type="button" data-save-artist="${esc(artist.name)}" aria-label="${esc(artist.name)}を保存" aria-pressed="${isSaved}">
            <svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4Z"></path></svg><span>${isSaved ? "保存済み" : "保存"}</span>
          </button>
        </article>
      `;
    }).join("");

    if(toggle) toggle.remove();
    root.onclick = event => {
      const button = event.target.closest("[data-save-artist]");
      if(!button) return;
      event.preventDefault();
      const name = button.dataset.saveArtist;
      let current = [];
      try{ current = JSON.parse(localStorage.getItem(savedKey) || "[]"); }catch{}
      const next = current.includes(name) ? current.filter(value => value !== name) : [...current,name];
      localStorage.setItem(savedKey,JSON.stringify(next));
      button.classList.toggle("is-saved",next.includes(name));
      button.setAttribute("aria-pressed",String(next.includes(name)));
      const label = button.querySelector("span");
      if(label) label.textContent = next.includes(name) ? "保存済み" : "保存";
    };
  }

  async function renderExhibitionDetail(){
    const item = currentExhibition();
    if(!item?.venueId) return false;

    bindExhibitionSummary(item);
    renderExhibitionArtists(item);

    const rail = document.querySelector(".exhibition-page .poster-rail, .detail-sheet .poster-rail, .poster-rail");
    if(!rail) return true;

    const result = await source.resolve("exhibitionDetail","sameVenueExhibitions",{
      exhibitionId:item.id,
      venueId:item.venueId
    });
    rail.innerHTML = result.items.map(posterCard).join("");
    return true;
  }

  async function renderArtistDetail(){
    const artist = currentArtist();
    if(!artist?.id) return false;
    const exhibitionsEl = document.querySelector("[data-current-exhibitions]");
    const relatedEl = document.querySelector("[data-related-artists]");
    if(!exhibitionsEl || !relatedEl) return false;

    const [currentExhibitions,relatedArtists] = await Promise.all([
      source.resolve("artistDetail","currentExhibitions",{artistId:artist.id}),
      source.resolve("artistDetail","relatedArtists",{artistId:artist.id})
    ]);
    exhibitionsEl.innerHTML = currentExhibitions.items.length
      ? currentExhibitions.items.map(posterCard).join("")
      : '<div class="artist-empty-copy">現在登録されている開催展覧会はありません。</div>';
    relatedEl.innerHTML = relatedArtists.items.length
      ? relatedArtists.items.map(relatedArtistCard).join("")
      : '<div class="artist-empty-copy">関連アーティストはまだ登録されていません。</div>';
    return true;
  }

  function monthLabel(key){
    const [year,month] = key.split("-").map(Number);
    return {year:String(year),month:new Intl.DateTimeFormat("ja-JP",{month:"short"}).format(new Date(year,month - 1,1))};
  }
  function monthsBetween(start,end){
    const values = [];
    const cursor = new Date(start.getFullYear(),start.getMonth(),1);
    const last = new Date(end.getFullYear(),end.getMonth(),1);
    while(cursor <= last){
      values.push(`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,"0")}`);
      cursor.setMonth(cursor.getMonth()+1);
    }
    return values;
  }
  function overlapsMonth(item,key){
    const [year,month] = key.split("-").map(Number);
    const monthStart = new Date(year,month - 1,1);
    const monthEnd = new Date(year,month,0,23,59,59);
    return new Date(item.start) <= monthEnd && new Date(item.end) >= monthStart;
  }

  function renderMuseumCalendar(items){
    const monthsEl = document.querySelector("[data-calendar-months]");
    const eventsEl = document.querySelector("[data-calendar-events]");
    if(!monthsEl || !eventsEl) return;
    if(!items.length){
      monthsEl.innerHTML = "";
      eventsEl.innerHTML = '<div class="museum-calendar-empty">現在登録されている展覧会Scheduleはありません。</div>';
      return;
    }

    const valid = items.filter(item => item.start && item.end);
    if(!valid.length){
      monthsEl.innerHTML = "";
      eventsEl.innerHTML = '<div class="museum-calendar-empty">日付情報のある展覧会Scheduleはありません。</div>';
      return;
    }
    const starts = valid.map(item => new Date(item.start));
    const ends = valid.map(item => new Date(item.end));
    const months = monthsBetween(
      new Date(Math.min(...starts.map(date => date.getTime()))),
      new Date(Math.max(...ends.map(date => date.getTime())))
    );
    let activeMonth = months.find(key => valid.some(item => overlapsMonth(item,key))) || months[0];

    const draw = () => {
      const matches = valid.filter(item => overlapsMonth(item,activeMonth));
      eventsEl.innerHTML = matches.length
        ? matches.map(item => `<a class="museum-calendar-event" href="${esc(item.href || `./exhibition.html?id=${encodeURIComponent(item.id)}`)}"><time>${esc(item.date)}</time><strong>${esc(item.title)}</strong><span>${esc(item.statusLabel)}</span></a>`).join("")
        : '<div class="museum-calendar-empty">この月に登録されている展覧会はありません。</div>';
      monthsEl.querySelectorAll("[data-month]").forEach(button => button.classList.toggle("is-active",button.dataset.month === activeMonth));
    };

    monthsEl.innerHTML = months.map(key => {
      const label = monthLabel(key);
      return `<button class="museum-month${key === activeMonth ? " is-active" : ""}" type="button" data-month="${key}"><small>${esc(label.year)}</small><strong>${esc(label.month)}</strong></button>`;
    }).join("");
    monthsEl.onclick = event => {
      const button = event.target.closest("[data-month]");
      if(!button) return;
      activeMonth = button.dataset.month;
      draw();
    };
    draw();
  }

  async function renderMuseumDetail(){
    const museum = currentMuseum();
    if(!museum?.id) return false;
    const rail = document.querySelector("[data-museum-exhibitions]");
    const empty = document.querySelector("[data-exhibitions-empty]");
    if(!rail) return false;

    const result = await source.resolve("museumDetail","exhibitions",{venueId:museum.id});
    rail.innerHTML = result.items.map(posterCard).join("");
    rail.hidden = result.items.length === 0;
    if(empty) empty.hidden = result.items.length !== 0;
    renderMuseumCalendar(result.items);
    return true;
  }

  async function init(){
    let rendered = false;
    if(document.querySelector(".main-surface") && document.querySelector(".artist-rail")) rendered = await renderHome();
    else if(document.querySelector("[data-current-exhibitions]") && document.querySelector("[data-related-artists]")) rendered = await renderArtistDetail();
    else if(document.querySelector("[data-museum-exhibitions]")) rendered = await renderMuseumDetail();
    else if(document.querySelector(".exhibition-hero")) rendered = await renderExhibitionDetail();

    window.MuuzeeSurfaceRuntimeReady = true;
    if(rendered){
      window.Muuzee?.saveControl?.scan?.();
      window.dispatchEvent(new CustomEvent("muuzee:surface-rendered"));
    }
  }

  init().catch(error => console.warn("Muuzee surface runtime failed",error));
})();
