/* Muuzee Personal Collection Renderers
   Reuses the exact card DOM/classes from Artists / Exhibitions / Museums
   and the exact work row DOM/classes from Artist Detail. */
(() => {
  "use strict";

  const esc = value => String(value ?? "").replace(/[&<>"']/g,char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));

  const primaryArtistMeta = artist => {
    const category = artist?.category?.[0] || "";
    const country = artist?.origin === "日本人" ? "日本" : (artist?.country || "");
    return [category,country].filter(Boolean).join(" · ");
  };

  const removeButton = (type,id,label,artist="") => `
    <button class="collection-remove-button" type="button"
      data-remove-type="${esc(type)}"
      data-remove-id="${esc(id)}"
      data-remove-label="${esc(label)}"
      ${artist ? `data-remove-artist="${esc(artist)}"` : ""}
      aria-label="${esc(label)}の保存を解除">
      <svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4Z"></path></svg>
    </button>`;

  function artistCard(artist,{removable=false} = {}){
    if(!artist) return "";

    const card = `
      <a class="artist-card" href="./artist.html?name=${encodeURIComponent(artist.name)}" aria-label="${esc(artist.name)}">
        <div class="artist-avatar">
          <img src="${esc(artist.image || artist.img || "")}" alt="" loading="lazy" style="object-position:${esc(artist.position || "center")}">
        </div>
        <strong>${esc(artist.name)}</strong>
        <span>${esc(primaryArtistMeta(artist))}</span>
      </a>`;

    if(!removable) return card;

    return `
      <div class="collection-item-wrap collection-item-wrap--artist">
        ${card}
        ${removeButton("artist",artist.name,artist.name)}
      </div>`;
  }

  function exhibitionCard(item,{removable=false} = {}){
    if(!item) return "";
    const card = window.MuuzeeExhibitionCard?.renderListCard(item) || "";

    if(!removable) return card;

    return `
      <div class="collection-item-wrap collection-item-wrap--exhibition">
        ${card}
        ${removeButton("exhibition",item.id,item.title)}
      </div>`;
  }

  function museumCard(museum,{removable=false} = {}){
    if(!museum) return "";

    const place = museum.scope === "jp"
      ? [museum.prefecture,museum.city,museum.location].filter(Boolean).join(" · ")
      : [museum.country,museum.city].filter(Boolean).join(" · ");

    const card = `
      <a class="museum-list-card" href="./museum.html?id=${encodeURIComponent(museum.id)}" data-museum-id="${esc(museum.id)}">
        <div class="museum-list-image">
          <img src="${esc(museum.image)}" alt="${esc(museum.name)}" loading="lazy">
        </div>
        <small>${esc(place)}</small>
        <h2>${esc(museum.name)}</h2>
        <p>${esc(museum.category)}</p>
      </a>`;

    if(!removable) return card;

    return `
      <div class="collection-item-wrap collection-item-wrap--museum">
        ${card}
        ${removeButton("museum",museum.id,museum.name)}
      </div>`;
  }

  function workRow(work,index,{removable=false,seen=false} = {}){
    if(!work) return "";

    const rightControl = removable
      ? `<button class="work-save is-saved" type="button"
          data-remove-type="work"
          data-remove-id="${esc(work.id || `${work.artist}::${work.title}`)}"
          data-remove-label="${esc(work.title)}"
          data-remove-artist="${esc(work.artist)}"
          aria-label="${esc(work.title)}の保存を解除">
          <svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4Z"></path></svg>
        </button>`
      : seen
        ? `<span class="collection-seen-mark" aria-label="見た">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="m8 12 2.6 2.6L16.5 9"></path></svg>
          </span>`
        : "";

    return `
      <article class="work-item">
        <div class="work-copy">
          <span class="work-number">${String(index + 1).padStart(2,"0")}</span>
          <h3 class="work-name">${esc(work.title)}</h3>
          <span class="work-year">${esc(work.year || work.artist || "")}</span>
        </div>
        ${rightControl}
      </article>`;
  }

  window.MuuzeeCollectionRenderers = {
    artistCard,
    exhibitionCard,
    museumCard,
    workRow
  };
})();
