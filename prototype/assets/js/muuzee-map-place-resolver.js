/* Muuzee Map Place Resolver — stable IDs to normalized map places */
(() => {
  "use strict";

  const config = window.MuuzeeMapConfig;
  if(!config) return;

  let museums = [];

  const asArray = value => Array.isArray(value) ? value : [];
  const isUnsplash = value => /\/\/images\.unsplash\.com\//i.test(String(value || ""));
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;

  function externalMapHref({address,lat,lng,name}){
    const query = address || (
      Number.isFinite(lat) && Number.isFinite(lng)
        ? `${lat},${lng}`
        : name
    );
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || "")}`;
  }

  function action(label,href,tone,{external=false} = {}){
    return {
      label,
      href,
      tone,
      ...(external ? {target:"_blank",rel:"noopener noreferrer"} : {})
    };
  }

  function museumImage(item){
    const override = config.media.museum[item.id];
    if(override) return override;
    return item.image && !isUnsplash(item.image)
      ? item.image
      : config.media.neutral;
  }

  function museumMeta(item){
    return [item.prefecture || item.country,item.city || item.location]
      .filter(Boolean)
      .join(" · ");
  }

  function normalizeMuseum(item,{context="discovery"} = {}){
    if(!item) return null;
    const lat = finite(item.lat);
    const lng = finite(item.lng);
    const detailHref = `./museum.html?id=${encodeURIComponent(item.id)}`;
    const mapHref = externalMapHref({address:item.address,lat,lng,name:item.name});
    const actions = context === "venue-detail"
      ? [
          action(config.actions.map.label,mapHref,config.actions.map.tone,{external:true}),
          action(config.actions.museum.label,detailHref,config.actions.museum.tone)
        ]
      : [action(config.actions.museum.label,detailHref,config.actions.museum.tone)];

    return {
      id:item.id,
      kind:"museum",
      name:item.name,
      lat,
      lng,
      image:museumImage(item),
      meta:museumMeta(item),
      sub:item.category || "",
      saveType:"museum",
      saveId:item.id,
      detailHref,
      mapHref,
      actions,
      scope:item.scope,
      region:item.region,
      city:item.city,
      country:item.country
    };
  }

  function normalizeExhibition(item){
    if(!item) return null;
    const lat = finite(item.lat);
    const lng = finite(item.lng);
    const detailHref = item.href || `./exhibition.html?id=${encodeURIComponent(item.id)}`;
    return {
      id:item.id,
      kind:"exhibition",
      name:item.title,
      lat,
      lng,
      image:item.src || config.media.neutral,
      meta:[item.statusLabel,item.expressionCategory].filter(Boolean).join(" · "),
      sub:[item.venue,item.date].filter(Boolean).join(" · "),
      saveType:"exhibition",
      saveId:item.id,
      detailHref,
      mapHref:externalMapHref({lat,lng,name:item.venue || item.title}),
      actions:[action(config.actions.exhibition.label,detailHref,config.actions.exhibition.tone)],
      status:item.status,
      expressionCategory:item.expressionCategory
    };
  }

  function normalizeVenue(place){
    const lat = finite(place.lat);
    const lng = finite(place.lng);
    const mapHref = externalMapHref({address:place.address,lat,lng,name:place.name});
    return {
      id:place.entityId,
      kind:"venue",
      name:place.name,
      lat,
      lng,
      image:config.media.neutral,
      meta:place.meta || "Venue",
      sub:place.address || place.sub || "",
      saveType:null,
      saveId:null,
      detailHref:null,
      mapHref,
      actions:[action(config.actions.map.label,mapHref,config.actions.map.tone,{external:true})]
    };
  }

  async function ready(){
    museums = window.MuuzeeDataSource?.loadMuseums
      ? asArray(await window.MuuzeeDataSource.loadMuseums())
      : asArray(window.MuuzeeMuseumCatalog);
    return api;
  }

  function resolveVenue(venueId,{context="venue-detail"} = {}){
    const place = config.places[String(venueId || "")];
    if(!place) return null;
    if(place.source === "museum"){
      const museum = museums.find(item => String(item.id) === String(place.entityId));
      return normalizeMuseum(museum,{context});
    }
    return normalizeVenue(place);
  }

  function normalizeCollection(items,kind,options){
    return asArray(items)
      .map(item => kind === "museum"
        ? normalizeMuseum(item,options)
        : normalizeExhibition(item,options))
      .filter(Boolean);
  }

  const api = Object.freeze({
    ready,
    resolveVenue,
    normalizeMuseum,
    normalizeExhibition,
    normalizeCollection,
    externalMapHref
  });

  window.MuuzeeMapPlaceResolver = api;
})();
