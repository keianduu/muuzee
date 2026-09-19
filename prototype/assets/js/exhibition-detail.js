/* Muuzee Exhibition Detail — shared data binding for prototype detail */
(async () => {
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

  const resolver = window.MuuzeeMapPlaceResolver;
  const discovery = window.MuuzeeMapDiscovery;
  const mapMount = document.querySelector("[data-exhibition-venue-map]");
  const fallback = document.querySelector("[data-exhibition-venue-map-fallback]");

  if(!resolver || !mapMount || !fallback) return;
  await resolver.ready();

  const place = resolver.resolveVenue(item.venueId,{extraActions:["map"]});
  const fallbackPlace = place || {
    name:item.venue,
    sub:[item.city,item.area].filter(Boolean).join("・"),
    mapHref:resolver.externalMapHref({name:item.venue})
  };

  const showFallback = () => {
    mapMount.hidden = true;
    fallback.hidden = false;
    fallback.querySelector("[data-exhibition-venue-name]").textContent = fallbackPlace.name || "会場情報";
    fallback.querySelector("[data-exhibition-venue-address]").textContent = fallbackPlace.sub || "所在地を確認してください。";
    fallback.querySelector("[data-exhibition-venue-map-link]").href = fallbackPlace.mapHref;
  };

  if(!place || !discovery?.mountPlace || !discovery.mountPlace({mount:mapMount,item:place})){
    showFallback();
  }
})().catch(error => console.error("Muuzee exhibition detail failed",error));
