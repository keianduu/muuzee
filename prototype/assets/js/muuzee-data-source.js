/* Muuzee User Front Data Source — fixture/API adapter boundary */
(() => {
  "use strict";

  const FIXTURE_SOURCE = "fixtures";
  const entities = new Set(["exhibitions","artists","museums"]);

  const adapters = {
    exhibitions:{
      [FIXTURE_SOURCE]:() => window.MuuzeeExhibitionCatalog || []
    },
    artists:{
      [FIXTURE_SOURCE]:() => window.MuuzeeArtistCatalog || []
    },
    museums:{
      [FIXTURE_SOURCE]:() => window.MuuzeeMuseumCatalog || []
    }
  };

  function configFor(entity){
    const config = window.MuuzeeDataConfig?.[entity];
    return config && typeof config === "object" ? config : {source:FIXTURE_SOURCE};
  }

  function sourceFor(entity){
    return String(configFor(entity).source || FIXTURE_SOURCE);
  }

  async function load(entity){
    const registry = adapters[entity];
    if(!registry) return [];

    const source = sourceFor(entity);
    const adapter = registry[source] || registry[FIXTURE_SOURCE];
    if(typeof adapter !== "function") return [];

    const items = await adapter(configFor(entity));
    return Array.isArray(items) ? items : [];
  }

  function registerAdapter(entity,name,adapter){
    if(!entities.has(entity) || !name || typeof adapter !== "function") return false;
    adapters[entity][String(name)] = adapter;
    return true;
  }

  window.MuuzeeDataSource = {
    getConfig(entity){ return {...configFor(entity)}; },
    getSource:sourceFor,
    loadExhibitions(){ return load("exhibitions"); },
    loadArtists(){ return load("artists"); },
    loadMuseums(){ return load("museums"); },
    registerAdapter
  };
})();
