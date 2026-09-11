/*
  Muuzee Shared ArtWall Component

  Responsibilities:
  - resolve ArtWall data from MuuzeeArtWallDataSource
  - apply MuuzeeArtWallStore presentation / membership
  - resolve thumbnail + known aspect ratio
  - render the shared masonry DOM
  - own responsive/store-driven rerenders
  - expose a render-ready promise for consumers such as My Art export

  Page-specific files should mount this component rather than implementing
  their own ArtWall rendering logic.
*/
(() => {
  "use strict";

  const mounted =
    new WeakMap();

  const DEFAULT_IMAGE_TIMEOUT =
    12000;

  const asElement =
    value => {
      if(
        value instanceof Element
      ){
        return value;
      }

      if(
        typeof value
        === "string"
      ){
        return document.querySelector(
          value
        );
      }

      return null;
    };

  const normalizeFallbackItems =
    value => {
      const source =
        typeof value
        === "function"
          ? value()
          : value;

      if(
        !Array.isArray(
          source
        )
      ){
        return [];
      }

      return source.filter(
        item =>
          item
          && typeof item
            === "object"
      );
    };

  const waitForImage =
    (
      image,
      timeoutMs
    ) =>
      new Promise(
        resolve => {
          if(
            image.complete
            && image.naturalWidth > 0
          ){
            resolve(
              true
            );

            return;
          }

          let settled =
            false;

          const finish =
            success => {
              if(settled){
                return;
              }

              settled =
                true;

              clearTimeout(
                timer
              );

              image.removeEventListener(
                "load",
                loaded
              );

              image.removeEventListener(
                "error",
                failed
              );

              resolve(
                success
              );
            };

          const loaded =
            () =>
              finish(
                image.naturalWidth > 0
              );

          const failed =
            () =>
              finish(
                false
              );

          const timer =
            setTimeout(
              () =>
                finish(
                  image.complete
                  && image.naturalWidth > 0
                ),
              timeoutMs
            );

          image.addEventListener(
            "load",
            loaded,
            {
              once:true
            }
          );

          image.addEventListener(
            "error",
            failed,
            {
              once:true
            }
          );
        }
      );

  const waitForGridImages =
    async (
      grid,
      timeoutMs
    ) => {
      const images =
        Array.from(
          grid.querySelectorAll(
            "img"
          )
        );

      const results =
        await Promise.all(
          images.map(
            image =>
              waitForImage(
                image,
                timeoutMs
              )
          )
        );

      return {
        complete:
          images.length > 0
          && results.every(
            Boolean
          ),

        count:
          images.length,

        failed:
          results.filter(
            value =>
              !value
          ).length
      };
    };

  const createWallItem =
    (
      item,
      index,
      options
    ) => {
      const link =
        document.createElement(
          "a"
        );

      link.className =
        options.itemClass
        || "wall-item";

      link.href =
        item.href
        || item.url
        || options.fallbackHref
        || "./exhibitions.html";

      if(item.id){
        link.dataset
          .exhibitionId =
            String(
              item.id
            );
      }

      link.setAttribute(
        "aria-label",
        item.title
        || options.itemAriaLabel
        || "Exhibition"
      );

      const image =
        document.createElement(
          "img"
        );

      image.src =
        item.artwallSrc
        || item.src
        || item.image
        || "";

      image.alt =
        item.title
        || "";

      const allEager =
        options.imageLoading
        === "eager";

      image.loading =
        allEager
          ? "eager"
          : (
              index
              < options.eagerCount
                ? "eager"
                : "lazy"
            );

      image.decoding =
        "async";

      try {
        image.fetchPriority =
          index
          < options.highPriorityCount
            ? "high"
            : "auto";
      } catch(_){
        // Optional browser hint.
      }

      link.appendChild(
        image
      );

      return link;
    };

  /* artwall-document-url:start */
  const resolveDocumentUrl = value => {
    let source = String(value || "").trim();
    if (!source) return "";

    if (source.startsWith("/assets/")) {
      source = `.${source}`;
    }

    if (/^(?:data:|blob:|https?:)/i.test(source)) {
      return source;
    }

    try {
      return new URL(source,document.baseURI).href;
    } catch (_) {
      return source;
    }
  };
  /* artwall-document-url:end */

  const resolveItems =
    (
      options,
      settings
    ) => {
      const store =
        window.MuuzeeArtWallStore
        || null;

      const dataSource =
        window.MuuzeeArtWallDataSource
        || null;

      const fallback =
        normalizeFallbackItems(
          options.fallbackItems
        );

      const all =
        dataSource
          ?.getSeenItems?.()
        || dataSource
          ?.getAllItems?.()
        || fallback;

      const committed =
        Number(
          settings?.schemaVersion
        )
        === Number(
          store?.schemaVersion
          ?? 1
        )
        && Array.isArray(
          settings?.exhibitionOrder
        )
        && settings.exhibitionOrder
          .length > 0;

      const selected =
        committed
          ? (
              store
                ?.selectItems?.(
                  all
                )
              || all
            )
          : (
              dataSource
                ?.getInitialItems?.()
              || fallback
            );

      const maxItems =
        Number(
          options.maxItems
        )
        || Number(
          dataSource
            ?.config
            ?.maxItems
        )
        || 30;

      return selected
        .slice(
          0,
          maxItems
        )
        .map(
          item => {
            const imageData =
              window.Muuzee
                ?.getArtWallImageData?.(
                  item.src
                  || item.image
                  || ""
                );

            return {
              ...item,

              artwallSrc:
                resolveDocumentUrl(
                  imageData?.thumb
                  || item.src
                  || item.image
                  || ""
                ),

              artwallRatio:
                Number(
                  imageData?.ratio
                )
                || null
            };
          }
        );
    };

  const mount =
    rawOptions => {
      const options = {
        context:"default",
        imageLoading:"progressive",
        eagerCount:4,
        highPriorityCount:4,
        waitForImages:false,
        imageTimeout:
          DEFAULT_IMAGE_TIMEOUT,
        observeResize:true,
        observeStore:true,
        syncExhibitionStat:true,
        autoRender:true,
        fallbackHref:
          "./exhibitions.html",
        ...rawOptions
      };

      const grid =
        asElement(
          options.grid
        );

      if(!grid){
        return null;
      }

      const existing =
        mounted.get(
          grid
        );

      if(existing){
        existing.destroy();
      }

      const wall =
        asElement(
          options.wall
        )
        || grid.closest(
          ".artwall"
        );

      if(!wall){
        return null;
      }

      const store =
        window.MuuzeeArtWallStore
        || null;

      let renderToken =
        0;

      let resizeTimer =
        0;

      let destroyed =
        false;

      let lastGridWidth =
        Math.round(
          grid.clientWidth
          || 0
        );

      const instance = {
        context:
          options.context,

        grid,

        wall,

        ready:
          Promise.resolve({
            complete:false,
            count:0,
            failed:0,
            source:
              options.context
          }),

        render:null,
        destroy:null
      };

      const render =
        async () => {
          if(destroyed){
            return {
              complete:false,
              count:0,
              failed:0,
              source:
                options.context
            };
          }

          const token =
            ++renderToken;

          const settings =
            store
              ?.get?.()
            || {
              schemaVersion:0,
              columns:4
            };

          const items =
            resolveItems(
              options,
              settings
            );

          store
            ?.applyPresentation?.(
              wall
            );

          if(
            options.syncExhibitionStat
          ){
            const exhibitionStat =
              wall.querySelector(
                ".stats .stat:first-child strong"
              );

            if(exhibitionStat){
              exhibitionStat.textContent =
                String(
                  items.length
                );
            }
          }

          if(
            !window.Muuzee
              ?.layoutMasonry
          ){
            return {
              complete:false,
              count:0,
              failed:0,
              source:
                options.context
            };
          }

          await window.Muuzee
            .layoutMasonry({
              grid,

              items,

              getSrc:
                item =>
                  item.artwallSrc,

              getRatio:
                item =>
                  item.artwallRatio,

              columns:
                Number(
                  settings.columns
                ) === 3
                  ? 3
                  : 4,

              gapDesktop:
                Number(
                  options.gapDesktop
                )
                || 8,

              gapMobile:
                Number(
                  options.gapMobile
                )
                || 4,

              renderItem:
                (
                  item,
                  _geometry,
                  index
                ) => {
                  if(
                    destroyed
                    || token
                      !== renderToken
                  ){
                    return null;
                  }

                  return createWallItem(
                    item,
                    index,
                    options
                  );
                }
            });

          if(
            destroyed
            || token
              !== renderToken
          ){
            return {
              complete:false,
              count:0,
              failed:0,
              source:
                options.context
            };
          }

          const result =
            options.waitForImages
              ? await waitForGridImages(
                  grid,
                  options.imageTimeout
                )
              : {
                  complete:true,
                  count:
                    items.length,
                  failed:0
                };

          const detail = {
            ...result,
            source:
              options.context,
            items:
              items.length
          };

          if(
            !destroyed
            && token
              === renderToken
          ){
            window.dispatchEvent(
              new CustomEvent(
                "muuzee:artwall-ready",
                {
                  detail
                }
              )
            );

            options.onReady
              ?.(
                detail
              );
          }

          return detail;
        };

      const startRender =
        () => {
          const promise =
            render();

          instance.ready =
            promise;

          if(
            options.publishReadyAs
          ){
            window[
              options.publishReadyAs
            ] = promise;
          }

          return promise;
        };

      const scheduleRender =
        () => {
          clearTimeout(
            resizeTimer
          );

          resizeTimer =
            setTimeout(
              startRender,
              120
            );
        };

      const handleResize =
        () => {
          const nextWidth =
            Math.round(
              grid.clientWidth
              || 0
            );

          if(
            !nextWidth
            || (
              lastGridWidth
              && Math.abs(
                nextWidth
                - lastGridWidth
              ) < 2
            )
          ){
            return;
          }

          lastGridWidth =
            nextWidth;

          scheduleRender();
        };

      const handleStoreChange =
        () => {
          scheduleRender();
        };

      if(
        options.observeResize
      ){
        window.addEventListener(
          "resize",
          handleResize
        );
      }

      if(
        options.observeStore
      ){
        window.addEventListener(
          "muuzee:artwall-store-change",
          handleStoreChange
        );
      }

      instance.render =
        startRender;

      instance.destroy =
        () => {
          if(destroyed){
            return;
          }

          destroyed =
            true;

          ++renderToken;

          clearTimeout(
            resizeTimer
          );

          window.removeEventListener(
            "resize",
            handleResize
          );

          window.removeEventListener(
            "muuzee:artwall-store-change",
            handleStoreChange
          );

          if(
            mounted.get(
              grid
            ) === instance
          ){
            mounted.delete(
              grid
            );
          }
        };

      mounted.set(
        grid,
        instance
      );

      if(
        options.autoRender
      ){
        startRender();
      }

      return instance;
    };

  window.MuuzeeArtWall = {
    mount
  };
})();
