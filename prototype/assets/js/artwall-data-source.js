(() => {
  "use strict";

  const config = window.MuuzeeArtWallDataConfig || {
    schemaVersion:1,
    initialLimit:16,
    maxItems:30,
    adapter:"prototype"
  };

  const normalizeAssetPath = value => {
    const source = String(value || "").trim();
    if (!source) return "";
    if (source.startsWith("/assets/")) return `.${source}`;
    return source;
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

    const rawSrc = [
      item.src,item.image,item.imageUrl,item.image_url,
      item.primaryImage,item.primary_image,item.heroImage,item.hero_image
    ].find(value => typeof value === "string" && value) || "";

    const src = normalizeAssetPath(rawSrc);

    if (!src || src.startsWith("data:image/")) return null;

    return {
      ...item,
      id,
      title:String(item.title ?? item.name ?? item.title_ja ?? `展示会 ${index+1}`),
      src,
      image:src,
      href:item.href || item.url || `./exhibition.html?id=${encodeURIComponent(id)}`,
      artwallDataSource:namespace
    };
  };

  const normalizeSource = (source,namespace) =>
    asArray(source).map((item,index) => normalize(item,index,namespace)).filter(Boolean);

  const getAllItems = () => {
    const catalog = normalizeSource(
      window.MuuzeeExhibitionCatalog,
      "catalog"
    );

    const fixtures = normalizeSource(
      window.MuuzeeArtWallSeenFixtures,
      "prototype-fixture"
    );

    const byId = new Map();

    [...catalog,...fixtures].forEach(item => {
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
