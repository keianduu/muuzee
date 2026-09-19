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
  const detailHead = window.MuuzeeDetailHead?.mount("[data-muuzee-detail-head]");
  const lead = document.querySelector(".lead-grid p");
  const mapTitle = document.querySelector(".map-copy h3");
  const mapLocation = document.querySelector(".map-copy p");

  if(hero){
    hero.src = item.src;
    hero.alt = item.title;
  }

  detailHead?.setTitle(item.title);
  detailHead?.setSub(item.venue);
  detailHead?.setMeta([
    {text:item.category},
    {text:item.statusLabel,tone:item.status === "now" ? "status" : "neutral"}
  ]);

  if(lead) lead.textContent = item.description;
  if(mapTitle) mapTitle.textContent = item.venue;
  if(mapLocation) mapLocation.textContent = `${item.city}・${item.area}`;
})();
