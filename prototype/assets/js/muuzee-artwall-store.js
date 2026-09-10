/*
  Muuzee ArtWall Prototype Store

  Purpose:
  - Prototype-only persistence that mimics future DB-backed ArtWall state.
  - Keep editor and consumer pages on one shared storage contract.
  - Store exhibition membership/order by ID, not duplicated exhibition data.

  Production note:
  Replace the storage adapter with API/DB calls while keeping the consumer
  contract (get / patch / save / selectItems / applyPresentation).
*/
(() => {
  "use strict";

  const KEY =
    "muuzee:artwall-settings";

  /*
    Prototype-only resolver cache.
    Canonical ArtWall state remains ID-only in KEY above.
    This stands in for the future DB/API exhibition lookup.
  */
  const PROTOTYPE_CATALOG_KEY =
    "muuzee:artwall-prototype-catalog:v1";

  const SCHEMA_VERSION =
    1;

  const palette = {
    default: "",
    blue: "#eef4f7",
    pink: "#f8eef1",
    green: "#eef4ed",
    yellow: "#faf5df",
    beige: "#fbfaf6"
  };

  const clone =
    value => JSON.parse(
      JSON.stringify(
        value
      )
    );

  const readRaw =
    () => {
      try {
        const value =
          JSON.parse(
            localStorage.getItem(
              KEY
            ) || "null"
          );

        return (
          value
          && typeof value === "object"
          && !Array.isArray(value)
        )
          ? value
          : {};
      } catch (_) {
        return {};
      }
    };

  const asIds =
    value => (
      Array.isArray(value)
        ? value
            .map(String)
            .filter(Boolean)
        : []
    );

  const unique =
    values => [
      ...new Set(
        values
      )
    ];

  const normalize =
    raw => {
      const source =
        raw
        && typeof raw === "object"
          ? raw
          : {};

      /*
        Only state saved through this shared store is considered committed
        cross-page prototype state. This avoids reviving stale legacy
        3-column settings from earlier ArtWall experiments.
      */
      const committed =
        Number(
          source.schemaVersion
        ) === SCHEMA_VERSION;

      const exhibitionOrder =
        committed
          ? asIds(
              source.exhibitionOrder
              ?? source.prototypeOrder
            )
          : [];

      const hiddenExhibitionIds =
        committed
          ? unique([
              ...asIds(
                source.hiddenExhibitionIds
              ),
              ...asIds(
                source.hiddenPrototypeItems
              )
            ])
          : [];

      return {
        schemaVersion:
          committed
            ? SCHEMA_VERSION
            : 0,

        title:
          committed
            ? String(
                source.title
                ?? ""
              )
            : "",

        comment:
          committed
            ? String(
                source.comment
                ?? ""
              )
            : "",

        background:
          committed
          && Object.prototype.hasOwnProperty.call(
            palette,
            source.background
          )
            ? source.background
            : "default",

        showIcon:
          committed
            ? source.showIcon
              !== false
            : true,

        columns:
          committed
          && Number(
            source.columns
          ) === 3
            ? 3
            : 4,

        

        wallHeightMode:
          committed
          && source.wallHeightMode === "expanded"
            ? "expanded"
            : "standard",exhibitionOrder,

        hiddenExhibitionIds,

        savedAt:
          committed
            ? String(
                source.savedAt
                ?? ""
              )
            : ""
      };
    };

  /* prototype-catalog-resolution:start */
  const readPrototypeCatalog =
    () => {
      try {
        const raw =
          JSON.parse(
            localStorage.getItem(
              PROTOTYPE_CATALOG_KEY
            ) || "{}"
          );

        return (
          raw
          && typeof raw === "object"
          && !Array.isArray(raw)
        )
          ? raw
          : {};
      } catch (_) {
        return {};
      }
    };

  const writePrototypeCatalog =
    catalog => {
      const value =
        catalog
        && typeof catalog === "object"
        && !Array.isArray(catalog)
          ? catalog
          : {};

      localStorage.setItem(
        PROTOTYPE_CATALOG_KEY,
        JSON.stringify(value)
      );

      return value;
    };

  const absoluteToPageRelative =
    value => {
      const source =
        String(value || "");

      if (!source) {
        return "";
      }

      try {
        const url =
          new URL(
            source,
            window.location.href
          );

        if (
          url.origin
          !== window.location.origin
        ) {
          return source;
        }

        const prototypeMarker =
          "/prototype/";

        const markerIndex =
          url.pathname.indexOf(
            prototypeMarker
          );

        if (
          markerIndex >= 0
        ) {
          return (
            "."
            + url.pathname.slice(
              markerIndex
              + "/prototype".length
            )
            + url.search
            + url.hash
          );
        }

        return (
          url.pathname
          + url.search
          + url.hash
        );
      } catch (_) {
        return source;
      }
    };

  const capturePrototypeCatalog =
    root => {
      const grid =
        root
        || document.querySelector(
          "[data-mypage-wall-grid]"
        );

      if (!grid) {
        return readPrototypeCatalog();
      }

      const current =
        readPrototypeCatalog();

      /*
        Prefer IDs already attached to tiles.
        If an older editor tile has no explicit data-exhibition-id,
        fall back to the currently persisted order at the same index.
        This makes old live-* prototype tiles resolvable too.
      */
      const raw =
        readRaw();

      const persistedOrder =
        Array.isArray(
          raw.exhibitionOrder
        )
          ? raw.exhibitionOrder
              .map(String)
          : [];

      const nodes =
        Array.from(
          grid.children
        );

      for (
        let index = 0;
        index < nodes.length;
        index += 1
      ) {
        const node =
          nodes[index];

        const image =
          node.querySelector?.(
            "img"
          );

        if (!image) {
          continue;
        }

        const explicitId =
          node.dataset?.exhibitionId
          || node
            .querySelector?.(
              "[data-exhibition-id]"
            )
            ?.dataset
            ?.exhibitionId
          || "";

        const id =
          String(
            explicitId
            || persistedOrder[index]
            || ""
          );

        if (!id) {
          continue;
        }

        const anchor =
          node.matches?.("a")
            ? node
            : node.querySelector?.(
                "a[href]"
              );

        current[id] = {
          id,
          title:
            String(
              image.alt
              || node.dataset?.title
              || id
            ),
          src:
            absoluteToPageRelative(
              image.currentSrc
              || image.src
              || ""
            ),
          href:
            absoluteToPageRelative(
              anchor?.href
              || "./exhibitions.html"
            )
        };
      }

      return writePrototypeCatalog(
        current
      );
    };

  const prototypeCatalogItems =
    () => Object.values(
      readPrototypeCatalog()
    )
      .map(
        normalizeItem
      )
      .filter(Boolean);
  /* prototype-catalog-resolution:end */

  const dispatch =
    state => {
      window.dispatchEvent(
        new CustomEvent(
          "muuzee:artwall-store-change",
          {
            detail:
              clone(
                state
              )
          }
        )
      );
    };

  const writeMerged =
    patch => {
      /*
        Cache visible prototype exhibition presentation data separately.
        The canonical ArtWall state still stores IDs only.
      */
      capturePrototypeCatalog();

      const current =
        readRaw();

      const next = {
        ...current,
        ...patch,
        schemaVersion:
          SCHEMA_VERSION,
        savedAt:
          new Date()
            .toISOString()
      };

      localStorage.setItem(
        KEY,
        JSON.stringify(
          next
        )
      );

      const normalized =
        normalize(
          next
        );

      dispatch(
        normalized
      );

      return normalized;
    };

  const get =
    () => normalize(
      readRaw()
    );

  const getRaw =
    () => clone(
      readRaw()
    );

  const patch =
    values =>
      writeMerged(
        values
        && typeof values === "object"
          ? values
          : {}
      );

  const save =
    state =>
      writeMerged(
        state
        && typeof state === "object"
          ? state
          : {}
      );

  const reset =
    () => {
      localStorage.removeItem(
        KEY
      );

      localStorage.removeItem(
        PROTOTYPE_CATALOG_KEY
      );

      const state =
        normalize(
          {}
        );

      dispatch(
        state
      );

      return state;
    };

  const idOf =
    item => String(
      item?.id
      ?? item?.exhibitionId
      ?? item?.exhibition_id
      ?? item?.slug
      ?? ""
    );

  const srcOf =
    item => (
      [
        item?.src,
        item?.image,
        item?.imageUrl,
        item?.image_url,
        item?.primaryImage,
        item?.primary_image,
        item?.heroImage,
        item?.hero_image,
        item?.thumbnail,
        item?.thumbnailUrl,
        item?.thumbnail_url,
        item?.images?.[0]?.url,
        item?.images?.[0]
      ].find(
        value =>
          typeof value === "string"
          && value
      )
      || ""
    );

  const titleOf =
    item => String(
      item?.title
      ?? item?.name
      ?? item?.title_ja
      ?? item?.titleJa
      ?? ""
    );

  const normalizeItem =
    item => {
      const id =
        idOf(
          item
        );

      if (!id) {
        return null;
      }

      return {
        ...item,
        id,
        title:
          titleOf(
            item
          ),
        src:
          srcOf(
            item
          ),
        href:
          item?.href
          || `./exhibition.html?id=${encodeURIComponent(id)}`
      };
    };

  const dummyItems =
    () => (
      Array.isArray(
        window.MuuzeeArtWallDummyExhibitions
      )
        ? window.MuuzeeArtWallDummyExhibitions
            .map(
              (
                item,
                index
              ) => normalizeItem({
                ...item,
                id:
                  `dummy-${index + 1}`,
                src:
                  item?.image
                  || item?.src
                  || "",
                href:
                  item?.href
                  || "./exhibitions.html"
              })
            )
            .filter(Boolean)
        : []
    );

  /*
    Consumer behavior:
    - no committed prototype state -> keep page default items
    - committed exhibitionOrder -> that order is the ArtWall membership
    - unresolved prototype-only IDs are skipped safely
  */
  const selectItems =
    baseItems => {
      const base =
        Array.isArray(baseItems)
          ? baseItems
              .map(
                normalizeItem
              )
              .filter(Boolean)
          : [];

      const state =
        get();

      if (
        state.schemaVersion
        !== SCHEMA_VERSION
        || !state.exhibitionOrder.length
      ) {
        return base;
      }

      const all =
        [
          ...base,
          ...dummyItems(),
          ...prototypeCatalogItems()
        ];

      const byId =
        new Map();

      for (
        const item
        of all
      ) {
        if (
          item?.id
          && !byId.has(
            item.id
          )
        ) {
          byId.set(
            item.id,
            item
          );
        }
      }

      const hidden =
        new Set(
          state.hiddenExhibitionIds
        );

      return state.exhibitionOrder
        .filter(
          id =>
            !hidden.has(
              id
            )
        )
        .map(
          id =>
            byId.get(
              id
            )
        )
        .filter(Boolean);
    };

  const hexToRgb =
    hex => {
      const value =
        String(
          hex || ""
        )
          .replace(
            "#",
            ""
          )
          .trim();

      if (
        !/^[0-9a-f]{6}$/i
          .test(
            value
          )
      ) {
        return null;
      }

      return {
        r:
          parseInt(
            value.slice(
              0,
              2
            ),
            16
          ),
        g:
          parseInt(
            value.slice(
              2,
              4
            ),
            16
          ),
        b:
          parseInt(
            value.slice(
              4,
              6
            ),
            16
          )
      };
    };

  const recolorGradient =
    (
      gradient,
      color
    ) => {
      const rgb =
        hexToRgb(
          color
        );

      if (
        !rgb
        || !gradient
        || gradient === "none"
      ) {
        return gradient;
      }

      return gradient.replace(
        /rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)/gi,
        (
          _match,
          _r,
          _g,
          _b,
          alpha
        ) => {
          const a =
            alpha == null
              ? 1
              : Number(
                  alpha
                );

          if (
            a >= 1
          ) {
            return (
              `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
            );
          }

          return (
            `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`
          );
        }
      );
    };

  const applyPresentation =
    root => {
      const wall =
        root
        || document.querySelector(
          ".artwall"
        );

      if (!wall) {
        return get();
      }

      const state =
        get();

      if (
        state.schemaVersion
        !== SCHEMA_VERSION
      ) {
        return state;
      }

      const title =
        wall.querySelector(
          ".artwall-owner-title"
        );

      const comment =
        wall.querySelector(
          ".artwall-copy > p"
        );

      const icon =
        wall.querySelector(
          ".artwall-user-avatar"
        );

      const fade =
        wall.querySelector(
          ".wall-fade"
        );

      if (
        title
        && state.title
      ) {
        title.textContent =
          state.title;
      }

            if (comment) {
        const value =
          String(
            state.comment
            ?? ""
          );

        const hasComment =
          value.trim().length > 0;

        comment.textContent =
          value;

        comment.hidden =
          !hasComment;

        comment.style.display =
          hasComment
            ? ""
            : "none";
      }

            if (icon) {
        icon.hidden =
          !state.showIcon;

        icon.dataset
          .muuzeeAvatarCollapsed =
            state.showIcon
              ? "false"
              : "true";

        icon.style.removeProperty(
          "visibility"
        );

        icon.style.removeProperty(
          "pointer-events"
        );

        icon.style.removeProperty(
          "display"
        );

        const image =
          icon.querySelector(
            "img"
          );

        if (image) {
          image.hidden = false;
          image.style.removeProperty(
            "visibility"
          );
          image.style.removeProperty(
            "pointer-events"
          );
          image.style.removeProperty(
            "display"
          );
        }
      }

      const color =
        palette[
          state.background
        ] || "";

      if (color) {
        wall.style.setProperty(
          "background",
          color,
          "important"
        );

        if (fade) {
          const original =
            fade.dataset
              .artwallOriginalGradient
            || getComputedStyle(
                fade
              ).backgroundImage
            || "";

          if (
            !fade.dataset
              .artwallOriginalGradient
          ) {
            fade.dataset
              .artwallOriginalGradient =
                original;
          }

          const recolored =
            recolorGradient(
              original,
              color
            );

          if (
            recolored
            && recolored
              !== "none"
          ) {
            fade.style.setProperty(
              "background-image",
              recolored,
              "important"
            );
          }
        }
      } else {
        wall.style.removeProperty(
          "background"
        );

        if (
          fade
          && fade.dataset
            .artwallOriginalGradient
        ) {
          fade.style.setProperty(
            "background-image",
            fade.dataset
              .artwallOriginalGradient,
            "important"
          );
        } else {
          fade?.style
            .removeProperty(
              "background-image"
            );
        }
      }

      return state;
    };

  window.MuuzeeArtWallStore = {
    key:
      KEY,
    schemaVersion:
      SCHEMA_VERSION,
    get,
    getRaw,
    save,
    patch,
    reset,
    selectItems,
    applyPresentation,
    capturePrototypeCatalog,
    readPrototypeCatalog
  };

  document.documentElement
    .dataset
    .artwallStore =
      "v20260907-01";
})();
