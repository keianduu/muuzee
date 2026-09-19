/* Muuzee Museum Detail — page-specific master / collection presentation */
(() => {
  "use strict";

  const catalog = window.MuuzeeMuseumCatalog || [];
  if(!catalog.length) return;

  const params = new URLSearchParams(location.search);
  const requestedId = params.get("id");
  const museum = catalog.find(item => item.id === requestedId) || catalog[0];

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
  const artistsEl = document.querySelector("[data-collection-artists]");

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

  const collection = window.MuuzeeMuseumCollection?.resolve(museum.id) || {works:[],artists:[]};
  window.MuuzeeRelationTextList?.mount(worksEl,{
    items:collection.works.map(work => ({
      primary:work.displayTitle,
      secondary:work.artists.map(artist => artist.name).join(" / "),
      meta:work.yearText
    })),
    emptyText:"所蔵作品情報を確認中です。"
  });
  window.MuuzeeRelationTextList?.mount(artistsEl,{
    items:collection.artists.map(artist => ({
      primary:artist.displayName,
      meta:`${artist.workCount}作品`
    })),
    emptyText:museum.collectionNote || "所蔵Artist情報を確認中です。"
  });

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
