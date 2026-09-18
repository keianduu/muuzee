/* Muuzee Exhibition Detail — shared data binding for prototype detail */
(() => {
  "use strict";

  const catalog = window.MuuzeeExhibitionCatalog || [];
  if(!catalog.length) return;

  const params = new URLSearchParams(location.search);
  const requested = params.get("id");
  const item = catalog.find(exhibition => exhibition.id === requested) || catalog[0];

  document.title = `${item.title} | Muuzee`;
  window.MuuzeeBreadcrumb?.get("[data-muuzee-breadcrumb]")?.setCurrentLabel(item.title);

  const hero = document.querySelector(".exhibition-hero img");
  const title = document.querySelector(".exhibition-sheet-title");
  const venue = document.querySelector(".exhibition-sheet-venue");
  const meta = [...document.querySelectorAll(".exhibition-sheet-meta .muuzee-pill")];
  const lead = document.querySelector(".lead-grid p");
  const mapTitle = document.querySelector(".map-copy h3");
  const mapLocation = document.querySelector(".map-copy p");

  if(hero){
    hero.src = item.src;
    hero.alt = item.title;
  }

  if(title) title.textContent = item.title;
  if(venue) venue.textContent = item.venue;

  if(meta[0]) meta[0].textContent = item.category;
  if(meta[1]){
    meta[1].textContent = item.statusLabel;
    meta[1].classList.toggle("muuzee-pill--status",item.status === "now");
    meta[1].classList.toggle("muuzee-pill--neutral",item.status !== "now");
  }

  if(lead) lead.textContent = item.description;
  if(mapTitle) mapTitle.textContent = item.venue;
  if(mapLocation) mapLocation.textContent = `${item.city}・${item.area}`;
})();
