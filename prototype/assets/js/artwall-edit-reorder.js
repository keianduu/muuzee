(() => {
  "use strict";

  const SETTINGS_KEY =
    "muuzee:artwall-settings";

  const SEEN_KEY =
    "muuzee:seen-items";

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
      "[Muuzee Reorder v20260907-34] "
      + "preview/items button missing"
    );

    return;
  }

  /*
    This button has fixed class-based coordinates.
    Clone it once to remove all older click listeners safely.
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
                seeds[
                  index
                  % Math.max(
                    seeds.length,
                    1
                  )
                ]?.image
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
                ?? seeds[
                  index
                  % Math.max(
                    seeds.length,
                    1
                  )
                ]?.title
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

      const push =
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
          push
        );

      seenItems()
        .forEach(
          push
        );

      const seeds =
        Array.isArray(
          window
            .MuuzeeArtWallReorderSeeds
        )
          ? window
              .MuuzeeArtWallReorderSeeds
          : [];

      let index =
        0;

      while (
        result.length
        < MIN_ITEMS
        && seeds.length
      ) {
        const seed =
          seeds[
            index
            % seeds.length
          ];

        /*
          Duplicated source images are allowed when needed only
          to provide enough reorderable rows for the Prototype.
        */
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

        index += 1;
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
          Preserve only the branch that contains the first image.
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

  const openDialog =
    () => {
      const grid =
        resolveGrid();

      if (!grid) {
        console.warn(
          "[Muuzee Reorder] grid missing"
        );

        return;
      }

      const items =
        buildItems();

      if (!items.length) {
        console.warn(
          "[Muuzee Reorder] no items"
        );

        return;
      }

      const itemMap =
        new Map(
          items.map(
            item => [
              item.id,
              item
            ]
          )
        );

      const settings =
        readJSON(
          SETTINGS_KEY,
          {}
        );

      const knownIds =
        items.map(
          item =>
            item.id
        );

      let order = [
        ...(
          Array.isArray(
            settings.exhibitionOrder
          )
            ? settings
                .exhibitionOrder
                .filter(
                  id =>
                    knownIds.includes(
                      id
                    )
                )
            : []
        ),

        ...knownIds
          .filter(
            id =>
              !(
                Array.isArray(
                  settings.exhibitionOrder
                )
                && settings.exhibitionOrder
                  .includes(
                    id
                  )
              )
          )
      ];

      const before =
        [...order];

      const liveTemplate =
        liveItems()[0]
          ?.node
        || null;

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
          const fragment =
            document
              .createDocumentFragment();

          for (
            const id
            of ids
          ) {
            const item =
              itemMap.get(
                id
              );

            if (!item) {
              continue;
            }

            if (!item.node) {
              item.node =
                cleanTemplate(
                  liveTemplate,
                  item
                );
            }

            fragment.appendChild(
              item.node
            );
          }

          grid.replaceChildren(
            fragment
          );

          order =
            [...ids];

          grid.dispatchEvent(
            new CustomEvent(
              "muuzee:artwall-grid-changed",
              {
                bubbles:true
              }
            )
          );

          markDirty();
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
        "[Muuzee Reorder v20260907-34]",
        {
          rows:
            order.length,
          live:
            liveItems().length,
          seen:
            seenItems().length
        }
      );

      const closeDialog =
        restore => {
          if (active) {
            finish();
          }

          if (restore) {
            syncMain(
              before
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

          syncMain(
            order
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
              Array.from(
                grid.children
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
                .filter(Boolean);

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
      "v20260907-34";
})();
