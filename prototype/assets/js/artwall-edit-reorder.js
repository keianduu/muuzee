(() => {
  "use strict";

  const SETTINGS_KEY =
    "muuzee:artwall-settings";

  const SEEN_KEY =
    "muuzee:seen-items";

  /*
    ArtWall should have enough images from the first render,
    not only after opening the reorder popup.
  */
  const MIN_ITEMS =
    16;

  const $ = (
    selector,
    root = document
  ) => root.querySelector(
    selector
  );

  const $$ = (
    selector,
    root = document
  ) => Array.from(
    root.querySelectorAll(
      selector
    )
  );

  const preview =
    $(
      "[data-artwall-editor-preview]"
    )
    || $(".artwall");

  const originalButton =
    $(
      ".artwall-editor-plus--items"
    );

  const saveButton =
    $(
      "[data-artwall-save-all]"
    );

  if (
    !preview
    || !originalButton
  ) {
    console.warn(
      "[Muuzee Reorder v20260907-36] "
      + "preview/items button missing"
    );

    return;
  }

  /*
    The dedicated reorder module owns this button.
    Preserve its semantic class/position but remove older click listeners.
  */
  const itemsButton =
    originalButton.cloneNode(
      true
    );

  originalButton.replaceWith(
    itemsButton
  );

  const readJSON = (
    key,
    fallback
  ) => {
    try {
      const value =
        JSON.parse(
          localStorage.getItem(
            key
          )
          || "null"
        );

      return value == null
        ? fallback
        : value;
    } catch (_) {
      return fallback;
    }
  };

  const resolveGrid =
    () => (
      preview.querySelector(
        ".wall-grid.muuzee-masonry-grid"
      )
    );

  const tileForImage =
    (
      grid,
      image
    ) => {
      let node =
        image;

      while (
        node
        && node.parentElement
        && node.parentElement !== grid
      ) {
        node =
          node.parentElement;
      }

      return (
        node?.parentElement === grid
          ? node
          : null
      );
    };

  const liveItems =
    () => {
      const grid =
        resolveGrid();

      if (!grid) {
        return [];
      }

      const result =
        [];

      const usedTiles =
        new Set();

      const images =
        $$(
          "img",
          grid
        );

      for (
        let index = 0;
        index < images.length;
        index += 1
      ) {
        const image =
          images[index];

        const tile =
          tileForImage(
            grid,
            image
          );

        if (
          !tile
          || usedTiles.has(
            tile
          )
        ) {
          continue;
        }

        usedTiles.add(
          tile
        );

        const id =
          tile.dataset
            .exhibitionId
          || `live-${result.length + 1}`;

        tile.dataset
          .exhibitionId =
            id;

        result.push({
          id,
          title:
            image.alt
            || `展示会 ${result.length + 1}`,
          image:
            image.src
            || "",
          node:
            tile
        });
      }

      return result;
    };

  const seenItems =
    () => {
      const raw =
        readJSON(
          SEEN_KEY,
          []
        );

      if (
        !Array.isArray(raw)
      ) {
        return [];
      }

      const source =
        window
          .MuuzeeExhibitionCatalog;

      const catalog =
        Array.isArray(source)
          ? source
          : (
            source
            && typeof source
              === "object"
            ? (
              source.items
              || source.exhibitions
              || source.data
              || source.records
              || []
            )
            : []
          );

      const seeds =
        Array.isArray(
          window
            .MuuzeeArtWallReorderSeeds
        )
          ? window
              .MuuzeeArtWallReorderSeeds
          : [];

      const result =
        [];

      raw
        .filter(
          item => {
            const type =
              String(
                item?.type
                ?? item?.entityType
                ?? item?.entity_type
                ?? ""
              ).toLowerCase();

            return [
              "exhibition",
              "exhibitions"
            ].includes(
              type
            );
          }
        )
        .forEach(
          (row, index) => {
            const id =
              String(
                row?.id
                ?? row?.entityId
                ?? row?.entity_id
                ?? row?.itemId
                ?? row?.item_id
                ?? `seen-${index + 1}`
              );

            const catalogItem =
              Array.isArray(catalog)
                ? (
                  catalog.find(
                    item =>
                      String(
                        item?.id
                        ?? item?.exhibitionId
                        ?? item?.exhibition_id
                        ?? item?.slug
                        ?? ""
                      ) === id
                  )
                  || null
                )
                : null;

            const seed =
              seeds.length
                ? seeds[
                    index
                    % seeds.length
                  ]
                : null;

            const image =
              [
                catalogItem?.image,
                catalogItem?.imageUrl,
                catalogItem?.image_url,
                catalogItem?.primaryImage,
                catalogItem?.primary_image,
                catalogItem?.heroImage,
                catalogItem?.hero_image,
                row?.image,
                row?.imageUrl,
                seed?.image
              ].find(
                value =>
                  typeof value === "string"
                  && value
              )
              || "";

            const title =
              String(
                catalogItem?.title
                ?? catalogItem?.name
                ?? catalogItem?.title_ja
                ?? row?.title
                ?? seed?.title
                ?? `展示会 ${index + 1}`
              );

            if (image) {
              result.push({
                id:`seen-${id}`,
                title,
                image,
                node:null
              });
            }
          }
        );

      return result;
    };

  const buildItems =
    () => {
      const result =
        [];

      const usedImages =
        new Set();

      const pushUnique =
        item => {
          if (
            !item?.image
            || usedImages.has(
              item.image
            )
          ) {
            return;
          }

          usedImages.add(
            item.image
          );

          result.push(
            item
          );
        };

      liveItems()
        .forEach(
          pushUnique
        );

      seenItems()
        .forEach(
          pushUnique
        );

      const seeds =
        Array.isArray(
          window
            .MuuzeeArtWallReorderSeeds
        )
          ? window
              .MuuzeeArtWallReorderSeeds
          : [];

      /*
        First use unique Prototype images.
      */
      for (
        let index = 0;
        index < seeds.length
        && result.length < MIN_ITEMS;
        index += 1
      ) {
        const seed =
          seeds[index];

        if (
          !seed?.image
          || usedImages.has(
            seed.image
          )
        ) {
          continue;
        }

        usedImages.add(
          seed.image
        );

        result.push({
          id:
            `extra-${index + 1}`,
          title:
            seed.title
            || `展示会 ${result.length + 1}`,
          image:
            seed.image,
          node:null
        });
      }

      /*
        If the Prototype has fewer unique images,
        repeat them only to keep the editor populated.
      */
      let repeatIndex =
        0;

      while (
        result.length < MIN_ITEMS
        && seeds.length
      ) {
        const seed =
          seeds[
            repeatIndex
            % seeds.length
          ];

        result.push({
          id:
            `fill-${repeatIndex + 1}`,
          title:
            seed.title
            || `展示会 ${result.length + 1}`,
          image:
            seed.image,
          node:null
        });

        repeatIndex += 1;
      }

      return result;
    };

  const cleanTemplate =
    (
      sourceTile,
      item
    ) => {
      let node =
        sourceTile
          ?.cloneNode(
            true
          )
        || document
          .createElement(
            "div"
          );

      let image =
        node.querySelector(
          "img"
        );

      if (!image) {
        image =
          document
            .createElement(
              "img"
            );

        node.replaceChildren(
          image
        );
      } else {
        /*
          Preserve only the DOM branch containing the image.
          Old captions/editor UI must never leak into ArtWall tiles.
        */
        const keep =
          new Set();

        let cursor =
          image;

        while (
          cursor
          && cursor !== node
        ) {
          keep.add(
            cursor
          );

          cursor =
            cursor.parentElement;
        }

        const prune =
          parent => {
            for (
              const child
              of Array.from(
                parent.childNodes
              )
            ) {
              if (
                child.nodeType
                === Node.TEXT_NODE
              ) {
                child.nodeValue =
                  "";

                continue;
              }

              if (
                child.nodeType
                !== Node.ELEMENT_NODE
              ) {
                continue;
              }

              if (
                child === image
                || keep.has(
                  child
                )
              ) {
                prune(
                  child
                );

                continue;
              }

              child.remove();
            }
          };

        prune(
          node
        );
      }

      node.dataset
        .exhibitionId =
          item.id;

      image =
        node.querySelector(
          "img"
        );

      image.src =
        item.image;

      image.alt =
        item.title;

      image.loading =
        "lazy";

      image.draggable =
        false;

      return node;
    };

  const markDirty =
    () => {
      if (!saveButton) {
        return;
      }

      saveButton.disabled =
        false;

      saveButton.setAttribute(
        "aria-disabled",
        "false"
      );
    };

  /*
    ----------------------------------------------------------------
    Stable ArtWall Grid Store

    Source of truth is the ArtWall item membership/order itself,
    not the reorder popup.

    This fixes:
    - too few images on initial 4-column render
    - additional images disappearing after another editor redraw
    ----------------------------------------------------------------
  */

  const store = {
    items:
      new Map(),

    order:
      [],

    initialized:
      false,

    syncing:
      false,

    repairScheduled:
      false,

    repairCount:
      0
  };

  window.MuuzeeArtWallGridStore =
    store;

  const itemIdsInGrid =
    grid => (
      Array.from(
        grid?.children
        || []
      )
        .filter(
          child =>
            child.querySelector(
              "img"
            )
        )
        .map(
          child =>
            child.dataset
              .exhibitionId
        )
        .filter(Boolean)
    );

  const registerItems =
    items => {
      for (
        const item
        of items
      ) {
        const existing =
          store.items.get(
            item.id
          );

        if (
          existing?.node
          && !item.node
        ) {
          item.node =
            existing.node;
        }

        store.items.set(
          item.id,
          {
            ...existing,
            ...item,
            node:
              item.node
              || existing?.node
              || null
          }
        );
      }
    };

  const adoptCurrentGrid =
    () => {
      const grid =
        resolveGrid();

      if (!grid) {
        return;
      }

      const current =
        liveItems();

      for (
        const item
        of current
      ) {
        const existing =
          store.items.get(
            item.id
          );

        store.items.set(
          item.id,
          {
            ...existing,
            ...item,
            node:item.node
          }
        );

        if (
          !store.order.includes(
            item.id
          )
        ) {
          store.order.push(
            item.id
          );
        }
      }
    };

  const preferredOrder =
    items => {
      const ids =
        items.map(
          item =>
            item.id
        );

      const settings =
        readJSON(
          SETTINGS_KEY,
          {}
        );

      const saved =
        Array.isArray(
          settings.exhibitionOrder
        )
          ? settings
              .exhibitionOrder
              .filter(
                id =>
                  ids.includes(
                    id
                  )
              )
          : [];

      const current =
        itemIdsInGrid(
          resolveGrid()
        )
          .filter(
            id =>
              ids.includes(
                id
              )
          );

      return [
        ...saved,

        ...current
          .filter(
            id =>
              !saved.includes(
                id
              )
          ),

        ...ids
          .filter(
            id =>
              !saved.includes(
                id
              )
              && !current.includes(
                id
              )
          )
      ];
    };

  const syncGrid =
    (
      ids,
      {
        dirty = false,
        reason = "sync",
        dispatch = true
      } = {}
    ) => {
      const grid =
        resolveGrid();

      if (!grid) {
        return false;
      }

      const firstLive =
        liveItems()[0]
          ?.node
        || Array.from(
          store.items.values()
        ).find(
          item =>
            item.node
        )?.node
        || null;

      const fragment =
        document
          .createDocumentFragment();

      const nextOrder =
        [];

      store.syncing =
        true;

      try {
        for (
          const id
          of ids
        ) {
          const item =
            store.items.get(
              id
            );

          if (!item) {
            continue;
          }

          if (!item.node) {
            item.node =
              cleanTemplate(
                firstLive,
                item
              );

            store.items.set(
              id,
              item
            );
          }

          fragment.appendChild(
            item.node
          );

          nextOrder.push(
            id
          );
        }

        grid.replaceChildren(
          fragment
        );

        store.order =
          nextOrder;

        grid.dataset
          .artwallStableItems =
            String(
              nextOrder.length
            );

        if (dirty) {
          markDirty();
        }

        if (dispatch) {
          grid.dispatchEvent(
            new CustomEvent(
              "muuzee:artwall-grid-changed",
              {
                bubbles:true,
                detail:{
                  source:
                    "stable-grid",
                  reason,
                  count:
                    nextOrder.length
                }
              }
            )
          );
        }
      } finally {
        store.syncing =
          false;
      }

      return true;
    };

  const initializeStore =
    (
      reason = "initial"
    ) => {
      const grid =
        resolveGrid();

      if (!grid) {
        return false;
      }

      const items =
        buildItems();

      if (!items.length) {
        return false;
      }

      registerItems(
        items
      );

      store.order =
        preferredOrder(
          items
        );

      store.initialized =
        true;

      syncGrid(
        store.order,
        {
          dirty:false,
          reason
        }
      );

      console.info(
        "[Muuzee Stable ArtWall Grid]",
        {
          reason,
          count:
            store.order.length,
          minimum:
            MIN_ITEMS
        }
      );

      return true;
    };

  const repairMembership =
    (
      reason = "redraw"
    ) => {
      if (
        store.syncing
        || !store.initialized
      ) {
        return;
      }

      const grid =
        resolveGrid();

      if (!grid) {
        return;
      }

      /*
        If another module produced a genuinely new tile,
        adopt it instead of deleting it.
      */
      adoptCurrentGrid();

      const currentIds =
        new Set(
          itemIdsInGrid(
            grid
          )
        );

      const missing =
        store.order
          .filter(
            id =>
              !currentIds.has(
                id
              )
          );

      if (!missing.length) {
        grid.dataset
          .artwallStableItems =
            String(
              store.order.length
            );

        return;
      }

      store.repairCount += 1;

      console.info(
        "[Muuzee Stable ArtWall Grid] restoring missing items",
        {
          reason,
          missing:
            missing.length,
          expected:
            store.order.length,
          current:
            currentIds.size,
          repair:
            store.repairCount
        }
      );

      syncGrid(
        store.order,
        {
          dirty:false,
          reason:
            `repair:${reason}`
        }
      );
    };

  /*
    Redraw verification waits until the DOM and Masonry work have settled.
    It observes membership only; style/position changes never trigger repair.
  */
  let repairFrameA =
    0;

  let repairFrameB =
    0;

  const scheduleRepair =
    (
      reason = "redraw"
    ) => {
      if (
        store.syncing
        || store.repairScheduled
      ) {
        return;
      }

      store.repairScheduled =
        true;

      repairFrameA =
        requestAnimationFrame(
          () => {
            repairFrameA =
              0;

            repairFrameB =
              requestAnimationFrame(
                () => {
                  repairFrameB =
                    0;

                  store.repairScheduled =
                    false;

                  repairMembership(
                    reason
                  );
                }
              );
          }
        );
    };

  /*
    Observe only child membership under the ArtWall.
    This intentionally ignores Masonry style mutations, so it cannot create
    the previous resize/layout feedback loop.
  */
  const membershipObserver =
    new MutationObserver(
      mutations => {
        if (store.syncing) {
          return;
        }

        const changed =
          mutations.some(
            mutation =>
              mutation.type
              === "childList"
          );

        if (changed) {
          scheduleRepair(
            "child-list"
          );
        }
      }
    );

  membershipObserver.observe(
    preview,
    {
      childList:true,
      subtree:true
    }
  );

  preview.addEventListener(
    "muuzee:artwall-grid-changed",
    event => {
      if (
        event.detail?.source
        === "stable-grid"
      ) {
        return;
      }

      scheduleRepair(
        "grid-changed"
      );
    }
  );

  window.addEventListener(
    "pageshow",
    event => {
      /*
        Important for iOS / PWA / browser back-forward cache.
      */
      if (
        !store.initialized
      ) {
        initializeStore(
          "pageshow"
        );
      } else {
        scheduleRepair(
          event.persisted
            ? "pageshow-bfcache"
            : "pageshow"
        );
      }
    }
  );

  document.addEventListener(
    "visibilitychange",
    () => {
      if (
        document.visibilityState
        === "visible"
      ) {
        scheduleRepair(
          "visibility"
        );
      }
    }
  );

  /*
    Expose a tiny explicit contract for other ArtWall editor modules.
  */
  store.ensure =
    reason => {
      if (
        !store.initialized
      ) {
        return initializeStore(
          reason
          || "external"
        );
      }

      scheduleRepair(
        reason
        || "external"
      );

      return true;
    };

  store.sync =
    (
      ids,
      options
    ) => syncGrid(
      ids,
      options
    );

  /*
    Materialize the complete ArtWall immediately.
    This is the key difference from the previous implementation:
    opening the popup is no longer required to reach MIN_ITEMS.
  */
  initializeStore(
    "module-init"
  );

  /*
    One settled verification after fonts/images/layout modules have had time
    to perform their own initial rendering.
  */
  requestAnimationFrame(
    () => {
      requestAnimationFrame(
        () => {
          scheduleRepair(
            "initial-settled"
          );
        }
      );
    }
  );

  const openDialog =
    () => {
      if (
        !store.initialized
      ) {
        initializeStore(
          "before-popup"
        );
      } else {
        repairMembership(
          "before-popup"
        );
      }

      /*
        Refresh source data without making the popup the source of truth.
      */
      const refreshed =
        buildItems();

      registerItems(
        refreshed
      );

      for (
        const item
        of refreshed
      ) {
        if (
          !store.order.includes(
            item.id
          )
        ) {
          store.order.push(
            item.id
          );
        }
      }

      if (
        store.order.length
        < MIN_ITEMS
      ) {
        initializeStore(
          "popup-minimum"
        );
      }

      const itemMap =
        store.items;

      let order =
        [...store.order];

      const before =
        [...order];

      const backdrop =
        document.createElement(
          "div"
        );

      backdrop.className =
        "artwall-reorder-dialog-backdrop";

      backdrop.innerHTML = `
        <section
          class="artwall-reorder-dialog"
          role="dialog"
          aria-modal="true"
        >
          <div class="artwall-reorder-dialog-head">
            <div>
              <small>ArtWall Edit</small>
              <h2>展示会の並び替え</h2>
            </div>

            <button
              type="button"
              class="artwall-reorder-dialog-close"
              aria-label="閉じる"
            >×</button>
          </div>

          <div class="artwall-reorder-dialog-body">
            <p class="artwall-reorder-help">
              つまみを押したまま上下に移動してください。
            </p>

            <div
              class="artwall-reorder-list-v2"
              data-artwall-reorder-list-v2
            ></div>
          </div>

          <div class="artwall-reorder-dialog-actions">
            <button
              type="button"
              class="is-secondary"
              data-reorder-cancel
            >キャンセル</button>

            <button
              type="button"
              data-reorder-apply
            >反映</button>
          </div>
        </section>
      `;

      document.body.appendChild(
        backdrop
      );

      document.body.style.overflow =
        "hidden";

      const list =
        $(
          "[data-artwall-reorder-list-v2]",
          backdrop
        );

      const close =
        $(
          ".artwall-reorder-dialog-close",
          backdrop
        );

      const cancel =
        $(
          "[data-reorder-cancel]",
          backdrop
        );

      const apply =
        $(
          "[data-reorder-apply]",
          backdrop
        );

      let active =
        null;

      let syncFrame =
        0;

      const currentOrder =
        () => {
          const ids =
            [];

          for (
            const child
            of Array.from(
              list.children
            )
          ) {
            if (
              child.classList
                .contains(
                  "artwall-reorder-placeholder-v2"
                )
            ) {
              const id =
                child.dataset
                  .draggedId;

              if (id) {
                ids.push(
                  id
                );
              }

              continue;
            }

            const id =
              child.dataset
                .itemId;

            if (id) {
              ids.push(
                id
              );
            }
          }

          return ids;
        };

      const syncMain =
        ids => {
          order =
            [...ids];

          syncGrid(
            order,
            {
              dirty:true,
              reason:
                "popup-reorder"
            }
          );
        };

      const scheduleSync =
        () => {
          if (syncFrame) {
            return;
          }

          syncFrame =
            requestAnimationFrame(
              () => {
                syncFrame =
                  0;

                syncMain(
                  currentOrder()
                );
              }
            );
        };

      const handleIcon =
        () => `
          <svg
            viewBox="0 0 20 24"
            width="20"
            height="24"
            aria-hidden="true"
          >
            <circle cx="6" cy="6" r="1.5"></circle>
            <circle cx="14" cy="6" r="1.5"></circle>
            <circle cx="6" cy="12" r="1.5"></circle>
            <circle cx="14" cy="12" r="1.5"></circle>
            <circle cx="6" cy="18" r="1.5"></circle>
            <circle cx="14" cy="18" r="1.5"></circle>
          </svg>
        `;

      const finish =
        () => {
          if (!active) {
            return;
          }

          const {
            row,
            placeholder,
            handle,
            pointerId
          } = active;

          placeholder.before(
            row
          );

          placeholder.remove();

          row.classList.remove(
            "is-dragging"
          );

          for (
            const property
            of [
              "position",
              "left",
              "top",
              "width",
              "height",
              "z-index",
              "pointer-events",
              "margin"
            ]
          ) {
            row.style.removeProperty(
              property
            );
          }

          try {
            if (
              handle.hasPointerCapture(
                pointerId
              )
            ) {
              handle.releasePointerCapture(
                pointerId
              );
            }
          } catch (_) {}

          active =
            null;

          syncMain(
            currentOrder()
          );
        };

      const render =
        () => {
          list.replaceChildren();

          for (
            const id
            of order
          ) {
            const item =
              itemMap.get(
                id
              );

            if (!item) {
              continue;
            }

            const row =
              document.createElement(
                "article"
              );

            row.className =
              "artwall-reorder-row-v2";

            row.dataset.itemId =
              id;

            row.innerHTML = `
              <img
                class="artwall-reorder-thumb-v2"
                src="${item.image}"
                alt=""
                draggable="false"
              >

              <div class="artwall-reorder-title-v2"></div>

              <button
                type="button"
                class="artwall-reorder-handle-v2"
                aria-label="並び替える"
              >
                ${handleIcon()}
              </button>
            `;

            $(
              ".artwall-reorder-title-v2",
              row
            ).textContent =
              item.title
              || "展示会";

            const handle =
              $(
                ".artwall-reorder-handle-v2",
                row
              );

            list.appendChild(
              row
            );

            handle.addEventListener(
              "pointerdown",
              event => {
                if (
                  event.button != null
                  && event.button !== 0
                ) {
                  return;
                }

                event.preventDefault();

                const rect =
                  row.getBoundingClientRect();

                const placeholder =
                  document.createElement(
                    "div"
                  );

                placeholder.className =
                  "artwall-reorder-placeholder-v2";

                placeholder.dataset.draggedId =
                  id;

                row.before(
                  placeholder
                );

                row.classList.add(
                  "is-dragging"
                );

                document.body.appendChild(
                  row
                );

                row.style.position =
                  "fixed";

                row.style.left =
                  `${rect.left}px`;

                row.style.top =
                  `${rect.top}px`;

                row.style.width =
                  `${rect.width}px`;

                row.style.height =
                  `${rect.height}px`;

                row.style.zIndex =
                  "1700";

                row.style.pointerEvents =
                  "none";

                row.style.margin =
                  "0";

                active = {
                  row,
                  handle,
                  placeholder,
                  pointerId:
                    event.pointerId,
                  offsetY:
                    event.clientY
                    - rect.top
                };

                try {
                  handle.setPointerCapture(
                    event.pointerId
                  );
                } catch (_) {}
              }
            );

            handle.addEventListener(
              "pointermove",
              event => {
                if (
                  !active
                  || event.pointerId
                    !== active.pointerId
                ) {
                  return;
                }

                event.preventDefault();

                active.row.style.top =
                  `${
                    event.clientY
                    - active.offsetY
                  }px`;

                const hit =
                  document.elementFromPoint(
                    event.clientX,
                    event.clientY
                  );

                const target =
                  hit?.closest(
                    ".artwall-reorder-row-v2"
                  );

                if (
                  !target
                  || target.parentElement
                    !== list
                ) {
                  return;
                }

                const rect =
                  target.getBoundingClientRect();

                if (
                  event.clientY
                  < rect.top
                    + rect.height / 2
                ) {
                  target.before(
                    active.placeholder
                  );
                } else {
                  target.after(
                    active.placeholder
                  );
                }

                scheduleSync();
              }
            );

            handle.addEventListener(
              "pointerup",
              event => {
                if (
                  active
                  && event.pointerId
                    === active.pointerId
                ) {
                  finish();
                }
              }
            );

            handle.addEventListener(
              "pointercancel",
              event => {
                if (
                  active
                  && event.pointerId
                    === active.pointerId
                ) {
                  finish();
                }
              }
            );
          }
        };

      render();

      console.info(
        "[Muuzee Reorder v20260907-36]",
        {
          rows:
            order.length,
          stableGrid:
            store.order.length
        }
      );

      const closeDialog =
        restore => {
          if (active) {
            finish();
          }

          if (restore) {
            syncGrid(
              before,
              {
                dirty:true,
                reason:
                  "popup-cancel"
              }
            );
          }

          backdrop.remove();

          document.body.style.overflow =
            "";
        };

      close.addEventListener(
        "click",
        () =>
          closeDialog(
            true
          )
      );

      cancel.addEventListener(
        "click",
        () =>
          closeDialog(
            true
          )
      );

      apply.addEventListener(
        "click",
        () => {
          order =
            currentOrder();

          syncGrid(
            order,
            {
              dirty:true,
              reason:
                "popup-apply"
            }
          );

          backdrop.remove();

          document.body.style.overflow =
            "";
        }
      );
    };

  itemsButton.addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      openDialog();
    },
    true
  );

  saveButton
    ?.addEventListener(
      "click",
      () => {
        window.setTimeout(
          () => {
            const current =
              readJSON(
                SETTINGS_KEY,
                {}
              );

            const grid =
              resolveGrid();

            if (!grid) {
              return;
            }

            const order =
              itemIdsInGrid(
                grid
              );

            localStorage.setItem(
              SETTINGS_KEY,
              JSON.stringify({
                ...current,
                exhibitionOrder:
                  order
              })
            );
          },
          0
        );
      }
    );

  document.documentElement.dataset
    .artwallReorderModule =
      "v20260907-36";
})();
