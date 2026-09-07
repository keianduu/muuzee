(() => {
  "use strict";

  const SETTINGS_KEY = "muuzee:artwall-settings";
  const SEEN_KEY = "muuzee:seen-items";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const dummyItems = Array.isArray(window.MuuzeeArtWallDummyExhibitions)
    ? window.MuuzeeArtWallDummyExhibitions
    : [];

  const preview =
    $("[data-artwall-editor-preview]")
    || $(".artwall");

  const columnsButton =
    $(".artwall-editor-plus--columns");

  const itemsButton =
    $(".artwall-editor-plus--items");

  const saveButton =
    $("[data-artwall-save-all]");

  if (!preview || !columnsButton || !itemsButton) {
    console.warn(
      "[Muuzee ArtWall Collection v20260907-21] required element missing",
      {
        preview: !!preview,
        columnsButton: !!columnsButton,
        itemsButton: !!itemsButton
      }
    );
    return;
  }

  const readJSON = (key, fallback) => {
    try {
      const value =
        JSON.parse(localStorage.getItem(key) || "null");

      return value == null
        ? fallback
        : value;
    } catch (_) {
      return fallback;
    }
  };

  const settings =
    readJSON(SETTINGS_KEY, {});

  const state = {
    columns:
      Number(settings.columns) === 3
        ? 3
        : 4,

    order:
      Array.isArray(settings.exhibitionOrder)
        ? settings.exhibitionOrder.map(String)
        : [],

    hidden:
      Array.isArray(settings.hiddenExhibitionIds)
        ? settings.hiddenExhibitionIds.map(String)
        : []
  };

  /*
    Requirement:
    default is always 4 columns unless 3 was explicitly persisted.
  */
  if (settings.columns == null) {
    state.columns = 4;
  }

  const markDirty = () => {
    if (!saveButton) return;

    saveButton.disabled = false;
    saveButton.setAttribute(
      "aria-disabled",
      "false"
    );
  };

  /*
    Robust exhibition-grid discovery.
    Do NOT resolve once at module boot.
    The shared ArtWall may finish rendering after this module loads.
  */
  const resolveGrid = () => (
    preview.querySelector(
      ".wall-grid.muuzee-masonry-grid"
    )
  );

  const applyColumns = columns => {
    state.columns =
      Number(columns) === 3
        ? 3
        : 4;

    const grid =
      resolveGrid();

    if (!grid) {
      console.warn(
        "[Muuzee ArtWall Collection] "
        + ".wall-grid.muuzee-masonry-grid not found"
      );

      return false;
    }

    grid.dataset.artwallColumns =
      String(
        state.columns
      );

    /*
      CSS owns the actual layout.
      Keep variables in sync for any existing Masonry implementation.
    */
    for (
      const property
      of [
        "--artwall-columns",
        "--wall-columns",
        "--masonry-columns",
        "--columns"
      ]
    ) {
      grid.style.setProperty(
        property,
        String(
          state.columns
        )
      );
    }

    requestAnimationFrame(
      () => {
        window.dispatchEvent(
          new Event("resize")
        );

        grid.dispatchEvent(
          new CustomEvent(
            "muuzee:masonry-relayout",
            {
              bubbles:true,
              detail:{
                columns:
                  state.columns
              }
            }
          )
        );
      }
    );

    return true;
  };

  const normalizeType = value => {
    const type =
      String(value || "")
        .toLowerCase();

    return [
      "exhibition",
      "exhibitions"
    ].includes(type)
      ? "exhibition"
      : type;
  };

  const entryId = item => String(
    item?.id
    ?? item?.entityId
    ?? item?.entity_id
    ?? item?.itemId
    ?? item?.item_id
    ?? ""
  );

  const seenRows = () => {
    const raw =
      readJSON(SEEN_KEY, []);

    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .filter(item => (
        item
        && typeof item === "object"
        && normalizeType(
          item.type
          ?? item.entityType
          ?? item.entity_type
        ) === "exhibition"
      ))
      .map(item => ({
        ...item,
        __id: entryId(item)
      }))
      .filter(item => item.__id);
  };

  const catalogSource =
    window.MuuzeeExhibitionCatalog;

  const catalog = (() => {
    if (Array.isArray(catalogSource)) {
      return catalogSource;
    }

    if (
      catalogSource
      && typeof catalogSource === "object"
    ) {
      for (
        const key
        of [
          "items",
          "exhibitions",
          "data",
          "records"
        ]
      ) {
        if (
          Array.isArray(
            catalogSource[key]
          )
        ) {
          return catalogSource[key];
        }
      }
    }

    return [];
  })();

  const findCatalogItem = id => (
    catalog.find(item => (
      String(
        item?.id
        ?? item?.exhibitionId
        ?? item?.exhibition_id
        ?? item?.slug
        ?? ""
      ) === String(id)
    ))
    || null
  );

  const imageOf = item => (
    [
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

  const titleOf = item => String(
    item?.title
    ?? item?.name
    ?? item?.title_ja
    ?? item?.titleJa
    ?? ""
  );

  const currentPrototypeItems = () => {
    const grid =
      resolveGrid();

    if (!grid) {
      return [];
    }

    return Array.from(grid.children)
      .filter(child => child.querySelector("img"))
      .map((child, index) => ({
        id:
          child.dataset.exhibitionId
          || `prototype-${index + 1}`,

        title:
          child.querySelector("img")?.alt
          || `展示会 ${index + 1}`,

        image:
          child.querySelector("img")?.src
          || "",

        isDummy: true,

        template:
          child.cloneNode(true)
      }));
  };

    /* real-artwall-dom-sync-v3:start */

  const realArtWallTiles =
    new Map();

  const realArtWallTilesByImage =
    new Map();

  let cleanArtWallTemplate =
    null;

  const sanitizeArtWallTile =
    node => {
      if (!node) {
        return node;
      }

      const image =
        node.querySelector(
          "img"
        );

      if (!image) {
        return node;
      }

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

      node.querySelectorAll(
        [
          "button",
          "input",
          "label",
          ".artwall-seen-item-badge",
          ".artwall-editor-item-check",
          "[data-artwall-editor-control]"
        ].join(",")
      ).forEach(
        element =>
          element.remove()
      );

      for (
        const property
        of [
          "--artwall-editor-left",
          "--artwall-editor-top",
          "--artwall-editor-width"
        ]
      ) {
        node.style.removeProperty(
          property
        );
      }

      return node;
    };

  const registerRealArtWallTiles =
    () => {
      const grid =
        resolveGrid();

      if (!grid) {
        return;
      }

      const nodes =
        Array.from(
          grid.children
        )
          .filter(
            child =>
              child.querySelector(
                "img"
              )
          );

      for (
        let index = 0;
        index < nodes.length;
        index += 1
      ) {
        const node =
          nodes[index];

        const id =
          node.dataset
            .exhibitionId
          || `prototype-${index + 1}`;

        node.dataset
          .exhibitionId =
            id;

        sanitizeArtWallTile(
          node
        );

        realArtWallTiles.set(
          id,
          node
        );

        const src =
          node.querySelector(
            "img"
          )?.src
          || "";

        if (src) {
          realArtWallTilesByImage.set(
            src,
            node
          );
        }

        if (
          !cleanArtWallTemplate
        ) {
          cleanArtWallTemplate =
            node.cloneNode(
              true
            );

          sanitizeArtWallTile(
            cleanArtWallTemplate
          );
        }
      }
    };

  const tileForExhibition =
    item => {
      let node =
        realArtWallTiles.get(
          item.id
        )
        || null;

      if (
        !node
        && item.image
      ) {
        node =
          realArtWallTilesByImage.get(
            item.image
          )
          || null;
      }

      if (!node) {
        node =
          cleanArtWallTemplate
            ?.cloneNode(
              true
            )
          || document.createElement(
            "div"
          );

        if (
          !node.querySelector(
            "img"
          )
        ) {
          node.appendChild(
            document.createElement(
              "img"
            )
          );
        }

        sanitizeArtWallTile(
          node
        );
      }

      node.dataset
        .exhibitionId =
          item.id;

      const image =
        node.querySelector(
          "img"
        );

      if (image) {
        image.src =
          item.image;

        image.alt =
          item.title;

        image.loading =
          "lazy";

        image.draggable =
          false;
      }

      realArtWallTiles.set(
        item.id,
        node
      );

      if (item.image) {
        realArtWallTilesByImage.set(
          item.image,
          node
        );
      }

      return node;
    };

  const cleanCurrentArtWallGrid =
    () => {
      const grid =
        resolveGrid();

      if (!grid) {
        return;
      }

      const fragment =
        document
          .createDocumentFragment();

      for (
        const child
        of Array.from(
          grid.children
        )
      ) {
        if (
          !child.querySelector(
            "img"
          )
        ) {
          continue;
        }

        sanitizeArtWallTile(
          child
        );

        fragment.appendChild(
          child
        );
      }

      grid.replaceChildren(
        fragment
      );

      registerRealArtWallTiles();
    };

  cleanCurrentArtWallGrid();

  /* real-artwall-dom-sync-v3:end */

const buildExhibitions = () => {
    const result = [];
    const usedIds = new Set();
    const usedImages = new Set();

    const seen =
      seenRows();

    seen.forEach(
      (row, index) => {
        if (
          usedIds.has(
            row.__id
          )
        ) {
          return;
        }

        const source =
          findCatalogItem(
            row.__id
          );

        const fallback =
          dummyItems[
            index
            % Math.max(
              dummyItems.length,
              1
            )
          ];

        const image =
          imageOf(source)
          || row.image
          || row.imageUrl
          || fallback?.image
          || "";

        const title =
          titleOf(source)
          || row.title
          || fallback?.title
          || `観た展示会 ${index + 1}`;

        result.push({
          id: row.__id,
          title,
          image,
          isDummy: false,
          template: null
        });

        usedIds.add(
          row.__id
        );

        if (image) {
          usedImages.add(
            image
          );
        }
      }
    );

    /*
      Add current ArtWall items first, then dummy exhibition data,
      until there are enough cards to test Masonry/reordering.
    */
    const MIN_ITEMS = 16;

    const candidates = [
      ...currentPrototypeItems(),

      ...dummyItems.map(
        (item, index) => ({
          id:
            `dummy-${index + 1}`,

          title:
            item.title
            || `展示会サンプル ${index + 1}`,

          image:
            item.image,

          isDummy: true,

          template: null
        })
      )
    ];

    for (
      const candidate
      of candidates
    ) {
      if (
        result.length
        >= MIN_ITEMS
      ) {
        break;
      }

      if (
        !candidate.image
        || usedIds.has(
          candidate.id
        )
        || usedImages.has(
          candidate.image
        )
      ) {
        continue;
      }

      result.push(
        candidate
      );

      usedIds.add(
        candidate.id
      );

      usedImages.add(
        candidate.image
      );
    }

    return result;
  };

  let exhibitions = [];

  const refreshExhibitions = () => {
    exhibitions =
      buildExhibitions();

    return exhibitions;
  };

  const itemMap = () => new Map(
    exhibitions.map(
      item => [
        item.id,
        item
      ]
    )
  );

  const orderedIds = () => {
    const ids =
      exhibitions.map(
        item =>
          item.id
      );

    return [
      ...state.order
        .filter(
          id =>
            ids.includes(id)
        ),

      ...ids
        .filter(
          id =>
            !state.order
              .includes(id)
        )
    ];
  };

  

    const createMainItem =
      item => (
        tileForExhibition(
          item
        )
      );

    const renderMain =
      () => {
        const grid =
          resolveGrid();

        if (!grid) {
          return;
        }

        registerRealArtWallTiles();

        const map =
          itemMap();

        const fragment =
          document
            .createDocumentFragment();

        for (
          const id
          of orderedIds()
        ) {
          if (
            state.hidden
              .includes(
                id
              )
          ) {
            continue;
          }

          const item =
            map.get(
              id
            );

          if (!item) {
            continue;
          }

          const node =
            createMainItem(
              item
            );

          sanitizeArtWallTile(
            node
          );

          fragment.appendChild(
            node
          );
        }

        /*
          Popup order becomes the ACTUAL .wall-grid DOM order.
        */
        grid.replaceChildren(
          fragment
        );

        /*
          One event -> one current 3/4-column Masonry pass.
        */
        grid.dispatchEvent(
          new CustomEvent(
            "muuzee:artwall-grid-changed",
            {
              bubbles:true
            }
          )
        );
      };

  const createDialog = (
    title,
    compact = false
  ) => {
    const backdrop =
      document.createElement(
        "div"
      );

    backdrop.className =
      "artwall-collection-dialog-backdrop";

    const dialog =
      document.createElement(
        "section"
      );

    dialog.className =
      "artwall-collection-dialog"
      + (
        compact
          ? " is-compact"
          : ""
      );

    dialog.innerHTML = `
      <div class="artwall-collection-dialog-head">
        <div>
          <small>ArtWall Edit</small>
          <h2>${title}</h2>
        </div>

        <button
          type="button"
          class="artwall-collection-dialog-close"
          aria-label="閉じる"
        >×</button>
      </div>

      <div
        class="artwall-collection-dialog-body"
      ></div>

      <div
        class="artwall-collection-dialog-actions"
      >
        <button
          type="button"
          class="is-secondary"
          data-collection-cancel
        >キャンセル</button>

        <button
          type="button"
          data-collection-apply
        >反映</button>
      </div>
    `;

    backdrop.appendChild(
      dialog
    );

    document.body.appendChild(
      backdrop
    );

    document.body.style.overflow =
      "hidden";

    return {
      backdrop,
      body:
        $(
          ".artwall-collection-dialog-body",
          dialog
        ),
      cancel:
        $(
          "[data-collection-cancel]",
          dialog
        ),
      apply:
        $(
          "[data-collection-apply]",
          dialog
        ),
      close:
        $(
          ".artwall-collection-dialog-close",
          dialog
        )
    };

    /*
      Column layout module owns Masonry geometry.
      Notify it once after the photo editor changes grid children/order.
    */
    grid.dispatchEvent(
      new CustomEvent(
        "muuzee:artwall-grid-changed",
        {
          bubbles:true
        }
      )
    );
  };

  const destroyDialog =
    instance => {
      instance.backdrop.remove();

      document.body.style.overflow =
        "";
    };

  const openColumns =
    event => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const before =
        state.columns;

      const instance =
        createDialog(
          "展示会の列数",
          true
        );

      instance.body.innerHTML = `
        <p class="artwall-collection-help">
          3列 / 4列を選ぶとすぐにArtWallへ反映します。
        </p>

        <div class="artwall-column-options">
          <label class="artwall-column-option">
            <input
              type="radio"
              name="collection-columns"
              value="3"
              ${
                state.columns === 3
                  ? "checked"
                  : ""
              }
            >
            <span>3列</span>
          </label>

          <label class="artwall-column-option">
            <input
              type="radio"
              name="collection-columns"
              value="4"
              ${
                state.columns === 4
                  ? "checked"
                  : ""
              }
            >
            <span>4列</span>
          </label>
        </div>
      `;

      $$(
        'input[name="collection-columns"]',
        instance.body
      )
        .forEach(
          input => {
            input.addEventListener(
              "change",
              () => {
                if (
                  !input.checked
                ) {
                  return;
                }

                applyColumns(
                  input.value
                );

                markDirty();
              }
            );
          }
        );

      const cancel =
        () => {
          applyColumns(
            before
          );

          destroyDialog(
            instance
          );
        };

      instance.cancel
        .addEventListener(
          "click",
          cancel
        );

      instance.close
        .addEventListener(
          "click",
          cancel
        );

      instance.apply
        .addEventListener(
          "click",
          () => {
            markDirty();

            destroyDialog(
              instance
            );
          }
        );
    };

        const openItems =
        event => {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();

          const grid =
            resolveGrid();

          if (!grid) {
            console.warn(
              "[Muuzee ArtWall Reorder] "
              + ".wall-grid.muuzee-masonry-grid not found"
            );

            return;
          }

          /*
            Source of truth for this popup:
            the actual tiles currently rendered in the ArtWall.
          */
          const liveTiles =
            Array.from(
              grid.children
            )
              .filter(
                child =>
                  child.querySelector(
                    "img"
                  )
              );

          const liveMap =
            new Map();

          const reorderItems =
            [];

          for (
            let index = 0;
            index < liveTiles.length;
            index += 1
          ) {
            const node =
              liveTiles[index];

            const image =
              node.querySelector(
                "img"
              );

            const id =
              node.dataset
                .exhibitionId
              || `live-${index + 1}`;

            node.dataset
              .exhibitionId =
                id;

            const item = {
              id,
              title:
                image?.alt
                || `展示会 ${index + 1}`,
              image:
                image?.src
                || "",
              node,
              isDummy:false
            };

            liveMap.set(
              id,
              item
            );

            reorderItems.push(
              item
            );
          }

          /*
            Add Prototype dummy data after the current real ArtWall items.
            This keeps the popup populated even before Seen data is complete.
          */
          const dummy =
            Array.isArray(
              window
                .MuuzeeArtWallDummyExhibitions
            )
              ? window
                  .MuuzeeArtWallDummyExhibitions
              : [];

          const usedImages =
            new Set(
              reorderItems
                .map(
                  item =>
                    item.image
                )
                .filter(Boolean)
            );

          const TARGET_COUNT =
            Math.max(
              16,
              reorderItems.length
            );

          for (
            let index = 0;
            index < dummy.length;
            index += 1
          ) {
            if (
              reorderItems.length
              >= TARGET_COUNT
            ) {
              break;
            }

            const data =
              dummy[index];

            if (
              !data?.image
              || usedImages.has(
                data.image
              )
            ) {
              continue;
            }

            const id =
              `dummy-${index + 1}`;

            reorderItems.push({
              id,
              title:
                data.title
                || `展示会サンプル ${index + 1}`,
              image:
                data.image,
              node:null,
              isDummy:true
            });

            usedImages.add(
              data.image
            );
          }

          /*
            Keep current state.order where possible,
            then append every newly-discovered item.
          */
          const allIds =
            reorderItems.map(
              item =>
                item.id
            );

          const workingOrder = [
            ...state.order
              .filter(
                id =>
                  allIds.includes(
                    id
                  )
              ),

            ...allIds
              .filter(
                id =>
                  !state.order
                    .includes(
                      id
                    )
              )
          ];

          state.order =
            [...workingOrder];

          const itemMap =
            new Map(
              reorderItems.map(
                item => [
                  item.id,
                  item
                ]
              )
            );

          /*
            Create a clean image-only tile for dummy entries.
            Real tiles are never cloned; the same DOM node is moved.
          */
          const firstLiveTemplate =
            liveTiles[0]
              ?.cloneNode(
                true
              )
            || null;

          const cleanDummyTile =
            item => {
              let node =
                firstLiveTemplate
                  ?.cloneNode(
                    true
                  )
                || document.createElement(
                  "div"
                );

              let image =
                node.querySelector(
                  "img"
                );

              if (!image) {
                image =
                  document.createElement(
                    "img"
                  );

                node.replaceChildren(
                  image
                );
              } else {
                /*
                  Strip everything except the image branch.
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

          /*
            Popup order -> actual ArtWall DOM order.
          */
          const syncMainArtWall =
            order => {
              const fragment =
                document
                  .createDocumentFragment();

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

                let node =
                  item.node;

                if (!node) {
                  node =
                    cleanDummyTile(
                      item
                    );

                  item.node =
                    node;
                }

                fragment.appendChild(
                  node
                );
              }

              grid.replaceChildren(
                fragment
              );

              state.order =
                [...order];

              /*
                Exactly one current 3/4-column Masonry relayout.
              */
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

          const instance =
            createDialog(
              "展示会の並び替え"
            );

          instance.body.innerHTML = `
            <p class="artwall-collection-help">
              つまみを押したまま上下に移動してください。
              並び順はArtWall本体にもすぐ反映されます。
            </p>

            <div
              class="artwall-reorder-list"
              data-artwall-reorder-list
            ></div>
          `;

          const list =
            $(
              "[data-artwall-reorder-list]",
              instance.body
            );

          if (!list) {
            console.warn(
              "[Muuzee ArtWall Reorder] "
              + "reorder list mount missing"
            );

            return;
          }

          let activeDrag =
            null;

          let syncFrame =
            0;

          const orderFromList =
            () => {
              const order =
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
                      "artwall-reorder-placeholder"
                    )
                ) {
                  const id =
                    child.dataset
                      .draggedId;

                  if (id) {
                    order.push(
                      id
                    );
                  }

                  continue;
                }

                if (
                  child.classList
                    .contains(
                      "artwall-reorder-row"
                    )
                ) {
                  const id =
                    child.dataset
                      .itemId;

                  if (id) {
                    order.push(
                      id
                    );
                  }
                }
              }

              return order;
            };

          const scheduleSync =
            () => {
              if (
                syncFrame
              ) {
                return;
              }

              syncFrame =
                requestAnimationFrame(
                  () => {
                    syncFrame =
                      0;

                    syncMainArtWall(
                      orderFromList()
                    );
                  }
                );
            };

          const createHandle =
            () => {
              const handle =
                document.createElement(
                  "button"
                );

              handle.type =
                "button";

              handle.className =
                "artwall-reorder-handle";

              handle.setAttribute(
                "aria-label",
                "並び替える"
              );

              handle.innerHTML = `
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

              return handle;
            };

          const finishDrag =
            () => {
              if (
                !activeDrag
              ) {
                return;
              }

              const {
                row,
                placeholder,
                handle,
                pointerId
              } = activeDrag;

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

              activeDrag =
                null;

              syncMainArtWall(
                orderFromList()
              );
            };

          const beginDrag =
            (
              event,
              row,
              handle
            ) => {
              if (
                event.button != null
                && event.button !== 0
              ) {
                return;
              }

              event.preventDefault();
              event.stopPropagation();

              const rect =
                row.getBoundingClientRect();

              const placeholder =
                document.createElement(
                  "div"
                );

              placeholder.className =
                "artwall-reorder-placeholder";

              placeholder.dataset
                .draggedId =
                  row.dataset
                    .itemId;

              placeholder.style.height =
                `${rect.height}px`;

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
                "1600";

              row.style.pointerEvents =
                "none";

              row.style.margin =
                "0";

              activeDrag = {
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
            };

          const moveDrag =
            event => {
              if (
                !activeDrag
                || event.pointerId
                  !== activeDrag
                    .pointerId
              ) {
                return;
              }

              event.preventDefault();

              const {
                row,
                placeholder,
                offsetY
              } = activeDrag;

              row.style.top =
                `${
                  event.clientY
                  - offsetY
                }px`;

              const hit =
                document.elementFromPoint(
                  event.clientX,
                  event.clientY
                );

              const target =
                hit?.closest(
                  ".artwall-reorder-row"
                );

              let changed =
                false;

              if (
                target
                && target.parentElement
                  === list
              ) {
                const rect =
                  target
                    .getBoundingClientRect();

                if (
                  event.clientY
                  < rect.top
                    + rect.height / 2
                ) {
                  if (
                    target.previousElementSibling
                    !== placeholder
                  ) {
                    target.before(
                      placeholder
                    );

                    changed =
                      true;
                  }
                } else if (
                  target.nextElementSibling
                  !== placeholder
                ) {
                  target.after(
                    placeholder
                  );

                  changed =
                    true;
                }
              }

              if (
                changed
              ) {
                scheduleSync();
              }
            };

          const renderRows =
            () => {
              list.replaceChildren();

              for (
                const id
                of state.order
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
                  "artwall-reorder-row";

                row.dataset.itemId =
                  id;

                const image =
                  document.createElement(
                    "img"
                  );

                image.className =
                  "artwall-reorder-thumb";

                image.src =
                  item.image;

                image.alt =
                  "";

                image.loading =
                  "lazy";

                image.draggable =
                  false;

                const title =
                  document.createElement(
                    "div"
                  );

                title.className =
                  "artwall-reorder-title";

                title.textContent =
                  item.title
                  || "展示会";

                const handle =
                  createHandle();

                row.append(
                  image,
                  title,
                  handle
                );

                list.appendChild(
                  row
                );

                handle.addEventListener(
                  "pointerdown",
                  pointerEvent =>
                    beginDrag(
                      pointerEvent,
                      row,
                      handle
                    )
                );

                handle.addEventListener(
                  "pointermove",
                  moveDrag
                );

                handle.addEventListener(
                  "pointerup",
                  pointerEvent => {
                    if (
                      activeDrag
                      && pointerEvent.pointerId
                        === activeDrag
                          .pointerId
                    ) {
                      finishDrag();
                    }
                  }
                );

                handle.addEventListener(
                  "pointercancel",
                  pointerEvent => {
                    if (
                      activeDrag
                      && pointerEvent.pointerId
                        === activeDrag
                          .pointerId
                    ) {
                      finishDrag();
                    }
                  }
                );
              }
            };

          renderRows();

          console.info(
            "[Muuzee ArtWall Reorder]",
            {
              live:
                liveTiles.length,
              total:
                state.order.length,
              dummy:
                state.order.length
                - liveTiles.length
            }
          );

          const before =
            [...state.order];

          const cancel =
            () => {
              if (
                activeDrag
              ) {
                finishDrag();
              }

              state.order =
                [...before];

              syncMainArtWall(
                state.order
              );

              destroyDialog(
                instance
              );
            };

          instance.cancel
            .addEventListener(
              "click",
              cancel
            );

          instance.close
            .addEventListener(
              "click",
              cancel
            );

          instance.apply
            .addEventListener(
              "click",
              () => {
                if (
                  activeDrag
                ) {
                  finishDrag();
                }

                state.order =
                  orderFromList();

                syncMainArtWall(
                  state.order
                );

                destroyDialog(
                  instance
                );
              }
            );
        };

  /*
    Capture phase runs before the existing bubble listener.
    stopImmediatePropagation keeps the old handler from firing.
    The DOM button itself is NOT replaced, so positioning code remains intact.
  */
itemsButton.addEventListener(
    "click",
    openItems,
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

            /* shared-artwall-collection-store-patch:start */
            if (
              window.MuuzeeArtWallStore
                ?.patch
            ) {
              window.MuuzeeArtWallStore
                .patch({
                  columns:
                    state.columns,
                  exhibitionOrder:
                    [...state.order],
                  hiddenExhibitionIds:
                    [...state.hidden]
                });
            } else {
              localStorage.setItem(
                SETTINGS_KEY,
                JSON.stringify({
                  ...current,
                  columns:
                    state.columns,
                  exhibitionOrder:
                    [...state.order],
                  hiddenExhibitionIds:
                    [...state.hidden]
                })
              );
            }
            /* shared-artwall-collection-store-patch:end */
          },
          0
        );
      }
    );

  /*
    Default 4 columns is visible immediately.
  */
  window.requestAnimationFrame(
    () => {
      const grid =
        resolveGrid();

      if (grid) {
        Array.from(
          grid.children
        )
          .filter(
            child =>
              child.querySelector(
                "img"
              )
          )
          .forEach(
            sanitizeArtWallTile
          );
      }

      /*
        Default 4 columns,
        unless the user explicitly saved 3.
      */
}
  );

  document.documentElement.dataset
    .artwallCollectionModule =
      "v20260907-21";

  console.info(
    "[Muuzee ArtWall Collection v20260907-21]",
    {
      columns:
        state.columns,
      buttons:
        "capture-owned",
      dummy:
        dummyItems.length
    }
  );
})();
