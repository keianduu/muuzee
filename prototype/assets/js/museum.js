/* Muuzee Museum Detail — page-specific master / collection presentation */
(() => {
  "use strict";

  const catalog = window.MuuzeeMuseumCatalog || [];
  if(!catalog.length) return;

  const params = new URLSearchParams(location.search);
  const requestedId = params.get("id");
  const museum = catalog.find(item => item.id === requestedId) || catalog[0];
  const artistCatalog = window.MuuzeeArtistCatalog || [];

  const esc = value => String(value ?? "").replace(/[&<>"']/g,char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));

  const hero = document.querySelector("[data-museum-hero]");
  const detailHead = window.MuuzeeDetailHead?.mount("[data-muuzee-detail-head]");
  const descriptionEl = document.querySelector("[data-museum-description]");
  const addressEl = document.querySelector("[data-museum-address]");
  const accessEl = document.querySelector("[data-museum-access]");
  const hoursEl = document.querySelector("[data-museum-hours]");
  const closedEl = document.querySelector("[data-museum-closed]");
  const openingNoteEl = document.querySelector("[data-museum-opening-note]");
  const mapLink = document.querySelector("[data-map-link]");
  const worksEl = document.querySelector("[data-collection-works]");
  const worksEmpty = document.querySelector("[data-collection-empty]");
  const artistsEl = document.querySelector("[data-collection-artists]");
  const artistsEmpty = document.querySelector("[data-artists-empty]");

  document.title = `${museum.name} — Muuzee`;
  window.MuuzeeBreadcrumb?.get("[data-muuzee-breadcrumb]")?.setCurrentLabel(museum.name);

  if(hero){ hero.src = museum.image || ""; hero.alt = museum.name; }
  const locationText = museum.scope === "jp"
    ? [museum.prefecture,museum.city,museum.location].filter(Boolean).join(" · ")
    : [museum.city,museum.country].filter(Boolean).join(" · ");

  detailHead?.setTitle(museum.name);
  detailHead?.setSub(locationText);
  detailHead?.setMeta([{text:museum.category || ""}]);
  if(descriptionEl) descriptionEl.textContent = museum.description || "";
  if(addressEl) addressEl.textContent = museum.address || "";
  if(accessEl) accessEl.innerHTML = (museum.access || []).map(line => `<p>${esc(line)}</p>`).join("");
  if(hoursEl) hoursEl.textContent = museum.hours || "";
  if(closedEl) closedEl.textContent = museum.closed || "";
  if(openingNoteEl) openingNoteEl.textContent = museum.openingNote || "";

  if(mapLink){
    mapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(museum.address || museum.name)}`;
  }

  const works = museum.collectionWorks || [];
  if(worksEl){
    worksEl.innerHTML = works.map(work => `
      <article class="museum-work" data-save-type="work">
        <div class="museum-work-image"><img src="${esc(work.image)}" alt="${esc(work.title)}" loading="lazy"></div>
        <small>${esc(work.year || "")}</small><strong>${esc(work.title)}</strong><p>${esc(work.artist)}</p>
      </article>
    `).join("");
    worksEl.hidden = works.length === 0;
    if(worksEmpty){
      worksEmpty.hidden = works.length !== 0;
      worksEmpty.textContent = museum.collectionNote || "所蔵作品データは準備中です。";
    }
  }

  const artistNames = museum.artists || [];
  if(artistsEl){
    artistsEl.innerHTML = artistNames.map(name => {
      const artist = artistCatalog.find(item => item.name === name);
      const image = artist?.image || artist?.img || "";
      const imageMarkup = image
        ? `<div class="museum-artist-image"><img src="${esc(image)}" alt="${esc(name)}" loading="lazy" style="object-position:${esc(artist?.position || "center")}"></div>`
        : `<div class="museum-artist-image is-fallback">${esc(name.slice(0,1))}</div>`;
      return `<a class="museum-artist" data-save-type="artist" data-save-id="${esc(name)}" href="./artist.html?name=${encodeURIComponent(name)}">${imageMarkup}<strong>${esc(name)}</strong></a>`;
    }).join("");
    artistsEl.hidden = artistNames.length === 0;
    if(artistsEmpty){
      artistsEmpty.hidden = artistNames.length !== 0;
      artistsEmpty.textContent = museum.collectionNote || "所蔵Artistデータは準備中です。";
    }
  }

  function initMap(){
    const mapEl = document.querySelector("[data-museum-map]");
    if(!mapEl) return;
    if(typeof L === "undefined"){
      mapEl.innerHTML = '<div class="museum-quiet-empty">Map could not load.</div>';
      return;
    }

    const map = L.map(mapEl,{zoomControl:true,scrollWheelZoom:false,attributionControl:true})
      .setView([museum.lat,museum.lng],14);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",{
      subdomains:"abcd",maxZoom:20,attribution:"&copy; OpenStreetMap contributors &copy; CARTO"
    }).addTo(map);
    const icon = L.divIcon({
      className:"",html:'<div class="museum-map-marker"></div>',iconSize:[26,26],iconAnchor:[13,13]
    });
    L.marker([museum.lat,museum.lng],{icon}).addTo(map);
    requestAnimationFrame(() => map.invalidateSize({pan:false}));
    setTimeout(() => map.invalidateSize({pan:false}),180);
  }

  initMap();
  // Current / upcoming exhibitions and the calendar are owned by MuuzeeSurfaceRuntime.
})();
