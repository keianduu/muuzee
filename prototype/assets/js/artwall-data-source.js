(() => {
  "use strict";

  const config = window.MuuzeeArtWallDataConfig || {
    schemaVersion:2,
    adapter:"prototype",
    seen:{
      queryParam:"seenCount",
      defaultCount:30,
      maxCount:100,
      pageSize:20
    },
    initialLimit:30,
    maxItems:100
  };

  const asArray = value => {
    if (Array.isArray(value)) return value;

    if (
      value
      && typeof value === "object"
    ) {
      return (
        value.items
        || value.exhibitions
        || value.data
        || value.records
        || []
      );
    }

    return [];
  };

  const normalizeAssetPath = value => {
    const source =
      String(
        value
        || ""
      ).trim();

    if (!source) return "";

    return source.startsWith("/assets/")
      ? `.${source}`
      : source;
  };

  const normalize = (
    item,
    index,
    namespace
  ) => {
    if (
      !item
      || typeof item !== "object"
    ) {
      return null;
    }

    const id =
      String(
        item.id
        ?? item.exhibitionId
        ?? item.exhibition_id
        ?? item.slug
        ?? `${namespace}-${index + 1}`
      );

    const rawSrc =
      [
        item.src,
        item.image,
        item.imageUrl,
        item.image_url,
        item.primaryImage,
        item.primary_image,
        item.heroImage,
        item.hero_image
      ].find(
        value =>
          typeof value === "string"
          && value
      )
      || "";

    const src =
      normalizeAssetPath(
        rawSrc
      );

    if (
      !src
      || src.startsWith("data:image/")
    ) {
      return null;
    }

    return {
      ...item,
      id,
      title:
        String(
          item.title
          ?? item.name
          ?? item.title_ja
          ?? `展示会 ${index + 1}`
        ),
      src,
      image:src,
      href:
        item.href
        || item.url
        || `./exhibition.html?id=${encodeURIComponent(id)}`,
      artwallDataSource:
        namespace
    };
  };

  const normalizeSource = (
    source,
    namespace
  ) =>
    asArray(source)
      .map(
        (
          item,
          index
        ) =>
          normalize(
            item,
            index,
            namespace
          )
      )
      .filter(Boolean);

  const seenConfig =
    config.seen
    || {};

  const clampSeenCount =
    value => {
      const max =
        Number(
          seenConfig.maxCount
        )
        || 100;

      const fallback =
        Number(
          seenConfig.defaultCount
        );

      const parsed =
        Number(value);

      const count =
        Number.isFinite(parsed)
          ? Math.floor(parsed)
          : (
              Number.isFinite(fallback)
                ? Math.floor(fallback)
                : 30
            );

      return Math.min(
        max,
        Math.max(
          0,
          count
        )
      );
    };

  const getSeenCount =
    () => {
      const param =
        String(
          seenConfig.queryParam
          || "seenCount"
        );

      const params =
        new URLSearchParams(
          location.search
        );

      return params.has(param)
        ? clampSeenCount(
            params.get(param)
          )
        : clampSeenCount(
            seenConfig.defaultCount
          );
    };

  const getFixtureItems =
    () =>
      normalizeSource(
        window.MuuzeeArtWallSeenFixtures,
        "prototype-fixture"
      );

  const getSeenItems =
    (
      {count} = {}
    ) => {
      const requested =
        count == null
          ? getSeenCount()
          : clampSeenCount(count);

      const fixtures =
        getFixtureItems();

      if (fixtures.length) {
        return fixtures.slice(
          0,
          requested
        );
      }

      return normalizeSource(
        window.MuuzeeExhibitionCatalog,
        "catalog"
      ).slice(
        0,
        requested
      );
    };

  const getAllItems =
    () => {
      const catalog =
        normalizeSource(
          window.MuuzeeExhibitionCatalog,
          "catalog"
        );

      const fixtures =
        getFixtureItems();

      const byId =
        new Map();

      [
        ...catalog,
        ...fixtures
      ].forEach(
        item => {
          if (
            !byId.has(item.id)
          ) {
            byId.set(
              item.id,
              item
            );
          }
        }
      );

      return Array.from(
        byId.values()
      );
    };

  const getInitialItems =
    (
      {limit} = {}
    ) => {
      if (limit != null) {
        return getSeenItems({
          count:limit
        });
      }

      return getSeenItems();
    };

  const getByIds =
    ids => {
      const order =
        Array.isArray(ids)
          ? ids.map(String)
          : [];

      const byId =
        new Map(
          getAllItems()
            .map(
              item => [
                item.id,
                item
              ]
            )
        );

      return order
        .map(
          id =>
            byId.get(id)
        )
        .filter(Boolean);
    };

  const isHomeArtWall =
    context =>
      context?.context
      === "home";

  const waitForAuth =
    async () => {
      if (
        !window.MuuzeeAuth
        && document.readyState === "loading"
      ) {
        await new Promise(
          resolve => {
            document.addEventListener(
              "DOMContentLoaded",
              resolve,
              {once:true}
            );
          }
        );
      }

      const auth =
        window.MuuzeeAuth
        || null;

      if (auth?.ready) {
        await auth.ready;
      }

      return auth;
    };

  const getGuestPreviewItems =
    async context => {
      if (
        !isHomeArtWall(
          context
        )
      ) {
        return null;
      }

      const auth =
        await waitForAuth();

      if (
        auth?.isLoggedIn?.()
      ) {
        return null;
      }

      try {
        const resolved =
          await window.MuuzeeSurfaceSource
            ?.resolve?.(
              "home",
              "guestArtWall"
            );

        const items =
          normalizeSource(
            resolved?.items,
            "guest-surface"
          );

        if (items.length) {
          return items;
        }
      } catch (_) {
        // Fall through to the synchronous prototype config fallback.
      }

      const surfaceConfig =
        window.MuuzeeSurfaceSource
          ?.getConfig?.(
            "home",
            "guestArtWall"
          )
        || window.MuuzeeSurfaceConfig
          ?.home
          ?.guestArtWall
        || null;

      const configured =
        getByIds(
          surfaceConfig?.ids
        );

      if (configured.length) {
        const limit =
          Number(
            surfaceConfig?.limit
          );

        return Number.isFinite(limit)
          && limit >= 0
          ? configured.slice(
              0,
              limit
            )
          : configured;
      }

      return getAllItems().slice(
        0,
        Number(
          config.initialLimit
        )
        || 30
      );
    };

  window.MuuzeeArtWallDataSource = {
    config,
    getSeenCount,
    getSeenItems,
    getAllItems,
    getInitialItems,
    getByIds,
    getGuestPreviewItems
  };
})();
