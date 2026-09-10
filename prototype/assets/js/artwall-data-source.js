(() => {
  "use strict";

  const config = window.MuuzeeArtWallDataConfig || {
    schemaVersion:1,
    initialLimit:16,
    maxItems:30,
    adapter:"prototype"
  };

  const asArray = value => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      return value.items || value.exhibitions || value.data || value.records || [];
    }
    return [];
  };

  const normalize = (item,index,namespace) => {
    if (!item || typeof item !== "object") return null;

    const id = String(
      item.id ?? item.exhibitionId ?? item.exhibition_id ?? item.slug ?? `${namespace}-${index+1}`
    );

    const src = [
      item.src,item.image,item.imageUrl,item.image_url,
      item.primaryImage,item.primary_image,item.heroImage,item.hero_image
    ].find(value => typeof value === "string" && value) || "";

    if (!src) return null;

    return {
      ...item,
      id,
      title:String(item.title ?? item.name ?? item.title_ja ?? `展示会 ${index+1}`),
      src,
      href:item.href || item.url || (namespace === "catalog"
        ? `./exhibition.html?id=${encodeURIComponent(id)}`
        : "./exhibitions.html"),
      artwallDataSource:namespace
    };
  };

  const normalizeSource = (source,namespace) =>
    asArray(source).map((item,index) => normalize(item,index,namespace)).filter(Boolean);

  const getAllItems = () => {
    const catalog = normalizeSource(window.MuuzeeExhibitionCatalog,"catalog");
    const dummy = normalizeSource(window.MuuzeeArtWallDummyExhibitions,"prototype-dummy");
    const seeds = normalizeSource(window.MuuzeeArtWallReorderSeeds,"prototype-seed");

    const byId = new Map();
    [...catalog,...dummy,...seeds].forEach(item => {
      if (!byId.has(item.id)) byId.set(item.id,item);
    });

    return Array.from(byId.values());
  };

  const getInitialItems = ({limit} = {}) => {
    const requested = Number(limit);
    const size = Number.isFinite(requested) && requested > 0
      ? requested
      : Number(config.initialLimit) || 16;

    return getAllItems().slice(0,size);
  };

  const getByIds = ids => {
    const order = Array.isArray(ids) ? ids.map(String) : [];
    const byId = new Map(getAllItems().map(item => [item.id,item]));
    return order.map(id => byId.get(id)).filter(Boolean);
  };

  window.MuuzeeArtWallDataSource = {
    config,
    getAllItems,
    getInitialItems,
    getByIds
  };
})();
