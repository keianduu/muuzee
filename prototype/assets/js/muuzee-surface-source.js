/* Muuzee Discovery Surface — curated/derived resolver boundary */
(() => {
  "use strict";

  const ENTITY_LOADERS = {
    exhibitions:() => window.MuuzeeDataSource?.loadExhibitions?.() ?? window.MuuzeeExhibitionCatalog ?? [],
    artists:() => window.MuuzeeDataSource?.loadArtists?.() ?? window.MuuzeeArtistCatalog ?? [],
    museums:() => window.MuuzeeDataSource?.loadMuseums?.() ?? window.MuuzeeMuseumCatalog ?? []
  };

  const resolvers = Object.create(null);

  const asArray = value => Array.isArray(value) ? value : [];
  const idOf = item => item?.id == null ? "" : String(item.id);
  const idsOf = value => asArray(value).map(String).filter(Boolean);
  const limitArray = (items,limit) => {
    const max = Number(limit);
    return Number.isFinite(max) && max >= 0 ? items.slice(0,max) : items;
  };

  async function loadEntity(entity){
    const loader = ENTITY_LOADERS[entity];
    if(typeof loader !== "function") return [];
    const items = await loader();
    return asArray(items);
  }

  function getConfig(group,key){
    const config = window.MuuzeeSurfaceConfig?.[group]?.[key];
    if(!config || typeof config !== "object") return null;
    return {
      ...config,
      ...(Array.isArray(config.ids) ? {ids:[...config.ids]} : {})
    };
  }

  async function resolveCurated(config){
    const ids = idsOf(config.ids);
    if(!ids.length) return [];

    const items = await loadEntity(config.entity);
    const byId = new Map(items.map(item => [idOf(item),item]).filter(([id]) => id));
    return limitArray(ids.map(id => byId.get(id)).filter(Boolean),config.limit);
  }

  function sameVenueExhibitions({config,context,entities}){
    const currentId = String(context.exhibitionId ?? context.currentExhibition?.id ?? "");
    const venueId = String(context.venueId ?? context.currentExhibition?.venueId ?? "");
    if(!venueId) return [];

    return limitArray(
      entities.exhibitions.filter(item => idOf(item) !== currentId && String(item?.venueId ?? "") === venueId),
      config.limit
    );
  }

  function artistCurrentExhibitions({config,context,entities}){
    const artistId = String(context.artistId ?? context.currentArtist?.id ?? "");
    if(!artistId) return [];

    const allowedStatuses = new Set(["now","upcoming"]);
    return limitArray(
      entities.exhibitions.filter(item => idsOf(item?.artistIds).includes(artistId) && allowedStatuses.has(item?.status)),
      config.limit
    );
  }

  function relatedArtists({config,context,entities}){
    const artistId = String(context.artistId ?? context.currentArtist?.id ?? "");
    if(!artistId) return [];

    const current = entities.artists.find(item => idOf(item) === artistId);
    if(!current) return [];

    const currentTags = new Set(idsOf(current.tagIds));
    const coExhibitionCounts = new Map();

    entities.exhibitions.forEach(exhibition => {
      const artistIds = idsOf(exhibition?.artistIds);
      if(!artistIds.includes(artistId)) return;
      artistIds.forEach(id => {
        if(id === artistId) return;
        coExhibitionCounts.set(id,(coExhibitionCounts.get(id) || 0) + 1);
      });
    });

    const ranked = entities.artists
      .filter(item => idOf(item) && idOf(item) !== artistId)
      .map(item => {
        const sharedTags = idsOf(item.tagIds).filter(tag => currentTags.has(tag)).length;
        const coExhibitions = coExhibitionCounts.get(idOf(item)) || 0;
        return {item,score:sharedTags + (coExhibitions * 2)};
      })
      .filter(entry => entry.score > 0)
      .sort((a,b) => b.score - a.score || idOf(a.item).localeCompare(idOf(b.item)));

    return limitArray(ranked.map(entry => entry.item),config.limit);
  }

  function venueExhibitions({config,context,entities}){
    const venueId = String(context.venueId ?? context.currentMuseum?.id ?? "");
    if(!venueId) return {ongoing:[],upcoming:[]};

    const matches = entities.exhibitions.filter(item => String(item?.venueId ?? "") === venueId);
    return {
      ongoing:limitArray(matches.filter(item => item?.status === "now"),config.limit),
      upcoming:limitArray(matches.filter(item => item?.status === "upcoming"),config.limit)
    };
  }

  resolvers.sameVenueExhibitions = sameVenueExhibitions;
  resolvers.artistCurrentExhibitions = artistCurrentExhibitions;
  resolvers.relatedArtists = relatedArtists;
  resolvers.venueExhibitions = venueExhibitions;

  async function resolveDerived(config,context){
    const resolver = resolvers[config.resolver];
    if(typeof resolver !== "function") return [];

    const entityNames = new Set([config.entity]);
    if(config.resolver === "relatedArtists") entityNames.add("exhibitions");
    if(config.resolver === "artistCurrentExhibitions") entityNames.add("artists");

    const entities = {};
    await Promise.all([...entityNames].map(async entity => {
      entities[entity] = await loadEntity(entity);
    }));

    return resolver({config,context:context || {},entities,loadEntity});
  }

  async function load(group,key,context={}){
    const config = getConfig(group,key);
    if(!config) return [];

    if(config.mode === "curated") return resolveCurated(config);
    if(config.mode === "derived" || config.mode === "ranked") return resolveDerived(config,context);
    return [];
  }

  function registerResolver(name,resolver){
    if(!name || typeof resolver !== "function") return false;
    resolvers[String(name)] = resolver;
    return true;
  }

  window.MuuzeeSurfaceSource = {
    getConfig,
    load,
    loadHome(){
      return Promise.all([
        load("home","recommendedExhibitions"),
        load("home","featuredArtists"),
        load("home","popularMuseums")
      ]).then(([recommendedExhibitions,featuredArtists,popularMuseums]) => ({
        recommendedExhibitions,
        featuredArtists,
        popularMuseums
      }));
    },
    registerResolver
  };
})();
