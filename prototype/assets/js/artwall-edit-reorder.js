/*
  Muuzee ArtWall Edit — Seen exhibition reorder
  ?seenCount=N activates the 0..100 fixture scenario.
  Full order lives in data; the popup renders 20 rows at a time.
*/
(() => {
  "use strict";

  const SETTINGS_KEY = "muuzee:artwall-settings";
  const SEEN_KEY = "muuzee:seen-items";
  const PAGE_SIZE =
    Number(
      window.MuuzeeArtWallDataConfig
        ?.seen
        ?.pageSize
    )
    || 20;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const preview = $("[data-artwall-editor-preview]") || $(".artwall");
  const originalButton = $(".artwall-editor-plus--items");
  const saveButton = $("[data-artwall-save-all]");

  if (!preview || !originalButton) return;

  const itemsButton = originalButton.cloneNode(true);
  originalButton.replaceWith(itemsButton);

  const readJSON = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  };

  const fixtureCount = (() => {
    const params = new URLSearchParams(location.search);
    if (!params.has("seenCount")) return null;
    const value = Number(params.get("seenCount"));
    if (!Number.isFinite(value)) return null;
    return Math.min(100, Math.max(0, Math.trunc(value)));
  })();

  const fixtureMode = fixtureCount != null;
  if (fixtureMode) {
    document.documentElement.dataset.artwallSeenCount = String(fixtureCount);
  }

  const resolveGrid = () =>
    preview.querySelector(".wall-grid.muuzee-masonry-grid");

  const tileForImage = (grid, image) => {
    let node = image;
    while (node && node.parentElement && node.parentElement !== grid) {
      node = node.parentElement;
    }
    return node?.parentElement === grid ? node : null;
  };

  const liveItems = () => {
    const grid = resolveGrid();
    if (!grid) return [];
    const used = new Set();
    const result = [];

    $$("img", grid).forEach((image, index) => {
      const tile = tileForImage(grid, image);
      if (!tile || used.has(tile)) return;
      used.add(tile);

      const id = tile.dataset.exhibitionId || `live-${index + 1}`;
      tile.dataset.exhibitionId = id;

      result.push({
        id,
        title: image.alt || `展示会 ${index + 1}`,
        image: image.currentSrc || image.src || "",
        href: tile.getAttribute?.("href") || "",
        node: tile
      });
    });

    return result;
  };

  const fixtureItems = () => {
    const source = window.MuuzeeArtWallSeenFixtures?.items;
    if (!Array.isArray(source)) return [];
    const count = fixtureMode ? fixtureCount : source.length;

    return source.slice(0, count).map(item => ({
      id: String(item.id),
      title: String(item.title || "展示会"),
      image: String(item.image || ""),
      href: String(item.href || ""),
      node: null
    }));
  };

  const catalogRows = () => {
    const source = window.MuuzeeExhibitionCatalog;
    if (Array.isArray(source)) return source;
    if (!source || typeof source !== "object") return [];
    return source.items || source.exhibitions || source.data || source.records || [];
  };

  const seenItems = () => {
    const raw = readJSON(SEEN_KEY, []);
    if (!Array.isArray(raw)) return [];

    const catalog = catalogRows();
    const fallbacks = fixtureItems();

    return raw
      .filter(item => {
        const type = String(
          item?.type ?? item?.entityType ?? item?.entity_type ?? ""
        ).toLowerCase();
        return type === "exhibition" || type === "exhibitions";
      })
      .map((row, index) => {
        const rawId = String(
          row?.id ?? row?.entityId ?? row?.entity_id ??
          row?.itemId ?? row?.item_id ?? `seen-${index + 1}`
        );

        const catalogItem = catalog.find(item =>
          String(
            item?.id ?? item?.exhibitionId ?? item?.exhibition_id ??
            item?.slug ?? ""
          ) === rawId
        ) || null;

        const fallback = fallbacks.length
          ? fallbacks[index % fallbacks.length]
          : null;

        const image = [
          catalogItem?.image, catalogItem?.imageUrl, catalogItem?.image_url,
          catalogItem?.primaryImage, catalogItem?.primary_image,
          catalogItem?.heroImage, catalogItem?.hero_image,
          row?.image, row?.imageUrl, fallback?.image
        ].find(value => typeof value === "string" && value) || "";

        if (!image) return null;

        return {
          id: `seen-${rawId}`,
          title: String(
            catalogItem?.title ?? catalogItem?.name ?? catalogItem?.title_ja ??
            row?.title ?? fallback?.title ?? `展示会 ${index + 1}`
          ),
          image,
          href: catalogItem?.href || catalogItem?.url ||
            `./exhibition.html?id=${encodeURIComponent(rawId)}`,
          node: null
        };
      })
      .filter(Boolean);
  };

  const buildItems = () => {
    /* shared-seen-source:start */
      const sharedSeen =
        window
          .MuuzeeArtWallDataSource
          ?.getSeenItems?.();

      if (
        Array.isArray(sharedSeen)
      ) {
        return sharedSeen
          .map(
            (
              item,
              index
            ) => ({
              id:String(
                item.id
                ?? `shared-seen-${index + 1}`
              ),
              title:String(
                item.title
                || `展示会 ${index + 1}`
              ),
              image:String(
                item.src
                || item.image
                || ""
              ),
              href:String(
                item.href
                || ""
              ),
              node:null
            })
          )
          .filter(
            item =>
              item.image
          );
      }
      /* shared-seen-source:end */

      if (fixtureMode) return fixtureItems();

    const byId = new Map();
    [...liveItems(), ...seenItems()].forEach(item => {
      if (!item?.id || !item?.image || byId.has(item.id)) return;
      byId.set(item.id, item);
    });
    return Array.from(byId.values());
  };

  const imageSourceFor = item =>
    window.MuuzeeArtWallImageData?.[item.image]?.thumb || item.image;

  const markDirty = () => {
    if (!saveButton) return;
    saveButton.disabled = false;
    saveButton.setAttribute("aria-disabled", "false");
  };

  let tileTemplate = null;

  const captureTemplate = () => {
    if (tileTemplate) return;
    const first = liveItems()[0]?.node || null;
    if (first) tileTemplate = first.cloneNode(true);
  };

  const createTile = item => {
    captureTemplate();

    const node =
      item.node ||
      tileTemplate?.cloneNode(true) ||
      document.createElement("a");

    if (node.tagName === "A") {
      node.setAttribute("href", item.href || "./exhibitions.html");
    }
    if (!node.className) node.className = "wall-item";

    let image = node.querySelector("img");
    if (!image) {
      image = document.createElement("img");
      node.replaceChildren(image);
    }

    node.dataset.exhibitionId = item.id;
    image.src = imageSourceFor(item);
    image.alt = item.title;
    image.loading = "lazy";
    image.decoding = "async";
    image.draggable = false;

    return node;
  };

  const savedOrder = () => {
    const shared = window.MuuzeeArtWallStore?.get?.();
    if (Array.isArray(shared?.exhibitionOrder)) {
      return shared.exhibitionOrder.map(String);
    }

    const fallback = readJSON(SETTINGS_KEY, {});
    return Array.isArray(fallback?.exhibitionOrder)
      ? fallback.exhibitionOrder.map(String)
      : [];
  };

  const preferredOrder = items => {
    const ids = items.map(item => item.id);
    const allowed = new Set(ids);
    const saved = savedOrder().filter(id => allowed.has(id));
    return [...saved, ...ids.filter(id => !saved.includes(id))];
  };

  const store = {
    items: new Map(),
    order: [],
    initialized: false,
    syncing: false
  };
  window.MuuzeeArtWallGridStore = store;

  const syncGrid = (
    ids,
    {dirty = false, reason = "sync", dispatch = true} = {}
  ) => {
    const grid = resolveGrid();
    if (!grid) return false;

    const fragment = document.createDocumentFragment();
    const nextOrder = [];
    store.syncing = true;

    try {
      ids.forEach(id => {
        const item = store.items.get(id);
        if (!item) return;

        if (!item.node) {
          item.node = createTile(item);
          store.items.set(id, item);
        }

        fragment.appendChild(item.node);
        nextOrder.push(id);
      });

      grid.replaceChildren(fragment);
      store.order = nextOrder;
      grid.dataset.artwallStableItems = String(nextOrder.length);

      if (dirty) markDirty();

      if (dispatch) {
        grid.dispatchEvent(new CustomEvent("muuzee:artwall-grid-changed", {
          bubbles: true,
          detail: {
            source: "stable-grid",
            reason,
            count: nextOrder.length
          }
        }));
      }
    } finally {
      store.syncing = false;
    }

    return true;
  };

  const initializeStore = (reason = "initial") => {
    const grid = resolveGrid();
    if (!grid) return false;

    captureTemplate();
    const items = buildItems();

    store.items = new Map(items.map(item => [item.id, {...item}]));
    store.order = preferredOrder(items);
    store.initialized = true;

    syncGrid(store.order, {dirty: false, reason});
    return true;
  };

  const currentGridOrder = () => {
    const grid = resolveGrid();
    if (!grid) return [];

    return Array.from(grid.children)
      .filter(child => child.querySelector("img"))
      .map(child => child.dataset.exhibitionId)
      .filter(Boolean);
  };

  const sameOrder = (a, b) =>
    a.length === b.length && a.every((value, index) => value === b[index]);

  let repairFrame = 0;
  const scheduleRepair = (reason = "external-redraw") => {
    if (store.syncing || repairFrame || !store.initialized) return;

    repairFrame = requestAnimationFrame(() => {
      repairFrame = 0;
      if (store.syncing || !store.initialized) return;

      const current = currentGridOrder();
      if (sameOrder(current, store.order)) return;

      syncGrid(store.order, {
        dirty: false,
        reason: `repair:${reason}`
      });
    });
  };

  const grid = resolveGrid();
  if (grid) {
    new MutationObserver(() => {
      if (!store.syncing) scheduleRepair("child-list");
    }).observe(grid, {childList: true});
  }

  store.ensure = reason => {
    if (!store.initialized) return initializeStore(reason || "external");
    scheduleRepair(reason || "external");
    return true;
  };

  store.sync = (ids, options) => syncGrid(ids, options);

  initializeStore("module-init");
  requestAnimationFrame(() => requestAnimationFrame(() =>
    scheduleRepair("initial-settled")
  ));

  const handleIcon = () => `
    <svg viewBox="0 0 20 24" width="20" height="24" aria-hidden="true">
      <circle cx="6" cy="6" r="1.5"></circle>
      <circle cx="14" cy="6" r="1.5"></circle>
      <circle cx="6" cy="12" r="1.5"></circle>
      <circle cx="14" cy="12" r="1.5"></circle>
      <circle cx="6" cy="18" r="1.5"></circle>
      <circle cx="14" cy="18" r="1.5"></circle>
    </svg>`;

  const openDialog = () => {
    if (!store.initialized) initializeStore("before-popup");

    const refreshed = buildItems();
    const allowed = new Set(refreshed.map(item => item.id));

    refreshed.forEach(item => {
      const existing = store.items.get(item.id);
      store.items.set(item.id, {
        ...existing,
        ...item,
        node: existing?.node || item.node || null
      });
    });

    if (fixtureMode) {
      store.order = preferredOrder(refreshed);
    } else {
      store.order = [
        ...store.order.filter(id => allowed.has(id)),
        ...refreshed.map(item => item.id).filter(id => !store.order.includes(id))
      ];
    }

    syncGrid(store.order, {dirty: false, reason: "popup-refresh"});

    let order = [...store.order];
    const before = [...order];
    const selectedIds = new Set();

    const backdrop = document.createElement("div");
    backdrop.className = "artwall-reorder-dialog-backdrop";
    backdrop.innerHTML = `
      <section class="artwall-reorder-dialog" role="dialog" aria-modal="true"
        aria-labelledby="artwall-reorder-dialog-title">
        <div class="artwall-reorder-dialog-head">
          <div>
            <small>ArtWall Edit</small>
            <h2 id="artwall-reorder-dialog-title">「観た」展示会</h2>
          </div>
          <button type="button" class="artwall-reorder-dialog-close"
            data-reorder-close aria-label="閉じる">×</button>
        </div>

        <div class="artwall-reorder-dialog-body">
          <p class="artwall-reorder-help">
            つまんで並び替えられます。複数選択して先頭・末尾への一括移動もできます。
          </p>
          <div class="artwall-reorder-list-v2"
            data-artwall-reorder-list-v2></div>
          <p class="artwall-reorder-empty" data-artwall-reorder-empty hidden>
            観た展示会はまだありません。
          </p>
        </div>

        <div class="artwall-reorder-dialog-actions">
          <div class="artwall-reorder-selection-actions"
            data-reorder-selection-actions hidden>
            <span class="artwall-reorder-selected-count"
              data-reorder-selected-count>0件選択</span>
            <button type="button" class="artwall-reorder-bulk-button"
              data-reorder-move-first>↑ 先頭へ</button>
            <button type="button" class="artwall-reorder-bulk-button"
              data-reorder-move-last>↓ 末尾へ</button>
          </div>

          <div class="artwall-reorder-dialog-actions-main">
            <button type="button" class="is-secondary"
              data-reorder-cancel>キャンセル</button>
            <button type="button" data-reorder-apply>反映</button>
          </div>
        </div>
      </section>`;

    document.body.appendChild(backdrop);
    const originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const dialog = $(".artwall-reorder-dialog", backdrop);
    const list = $("[data-artwall-reorder-list-v2]", backdrop);
    const empty = $("[data-artwall-reorder-empty]", backdrop);
    const selectionActions = $("[data-reorder-selection-actions]", backdrop);
    const selectedCount = $("[data-reorder-selected-count]", backdrop);
    const close = $("[data-reorder-close]", backdrop);
    const cancel = $("[data-reorder-cancel]", backdrop);
    const apply = $("[data-reorder-apply]", backdrop);
    const moveFirst = $("[data-reorder-move-first]", backdrop);
    const moveLast = $("[data-reorder-move-last]", backdrop);

    let renderedCount = 0;
    let active = null;

    const updateSelectionUI = () => {
      const count = selectedIds.size;
      selectionActions.hidden = count === 0;
      selectedCount.textContent = `${count}件選択`;

      $$(".artwall-reorder-row-v2", list).forEach(row => {
        const selected = selectedIds.has(row.dataset.itemId);
        row.classList.toggle("is-selected", selected);
        $(".artwall-reorder-select-v2", row)
          ?.setAttribute("aria-pressed", selected ? "true" : "false");
      });
    };

    const toggleSelected = id => {
      selectedIds.has(id) ? selectedIds.delete(id) : selectedIds.add(id);
      updateSelectionUI();
    };

    const visibleIds = () =>
      Array.from(list.children)
        .filter(node => node.matches?.(".artwall-reorder-row-v2"))
        .map(node => node.dataset.itemId)
        .filter(Boolean);

    const applyDraggedPosition = draggedId => {
      const visible = visibleIds();
      const position = visible.indexOf(draggedId);
      if (position < 0) return;

      const base = order.filter(id => id !== draggedId);
      const nextId = visible.slice(position + 1)
        .find(id => base.includes(id));

      if (nextId) {
        base.splice(base.indexOf(nextId), 0, draggedId);
        order = base;
        return;
      }

      const previousId = visible.slice(0, position).reverse()
        .find(id => base.includes(id));

      if (previousId) {
        base.splice(base.indexOf(previousId) + 1, 0, draggedId);
        order = base;
        return;
      }

      order = [draggedId, ...base];
    };

    const finishDrag = () => {
      if (!active) return;

      const {id, row, placeholder, handle, pointerId} = active;
      placeholder.before(row);
      placeholder.remove();
      row.classList.remove("is-dragging");

      [
        "position", "left", "top", "width", "height",
        "z-index", "pointer-events", "margin"
      ].forEach(property => row.style.removeProperty(property));

      try {
        if (handle.hasPointerCapture(pointerId)) {
          handle.releasePointerCapture(pointerId);
        }
      } catch (_) {}

      active = null;
      applyDraggedPosition(id);
      syncGrid(order, {dirty: true, reason: "popup-drag"});
    };

    const createRow = id => {
      const item = store.items.get(id);
      if (!item) return null;

      const row = document.createElement("article");
      row.className = "artwall-reorder-row-v2";
      row.dataset.itemId = id;
      row.innerHTML = `
        <button type="button" class="artwall-reorder-select-v2"
          aria-label="アイテムを選択" aria-pressed="false">
          <span aria-hidden="true"></span>
        </button>
        <img class="artwall-reorder-thumb-v2"
          src="${imageSourceFor(item)}" alt="" loading="lazy"
          decoding="async" draggable="false">
        <div class="artwall-reorder-title-v2"></div>
        <button type="button" class="artwall-reorder-handle-v2"
          aria-label="並び替える">${handleIcon()}</button>`;

      $(".artwall-reorder-title-v2", row).textContent =
        item.title || "展示会";

      const select = $(".artwall-reorder-select-v2", row);
      const handle = $(".artwall-reorder-handle-v2", row);

      select.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        toggleSelected(id);
      });

      row.addEventListener("click", event => {
        if (event.target.closest(
          ".artwall-reorder-select-v2, .artwall-reorder-handle-v2"
        )) return;
        toggleSelected(id);
      });

      handle.addEventListener("pointerdown", event => {
        if (event.button != null && event.button !== 0) return;
        event.preventDefault();

        const rect = row.getBoundingClientRect();
        const placeholder = document.createElement("div");
        placeholder.className = "artwall-reorder-placeholder-v2";
        placeholder.dataset.draggedId = id;
        row.before(placeholder);

        row.classList.add("is-dragging");
        document.body.appendChild(row);
        row.style.position = "fixed";
        row.style.left = `${rect.left}px`;
        row.style.top = `${rect.top}px`;
        row.style.width = `${rect.width}px`;
        row.style.height = `${rect.height}px`;
        row.style.zIndex = "1700";
        row.style.pointerEvents = "none";
        row.style.margin = "0";

        active = {
          id, row, handle, placeholder,
          pointerId: event.pointerId,
          offsetY: event.clientY - rect.top
        };

        try {
          handle.setPointerCapture(event.pointerId);
        } catch (_) {}
      });

      handle.addEventListener("pointermove", event => {
        if (!active || event.pointerId !== active.pointerId) return;
        event.preventDefault();

        active.row.style.top = `${event.clientY - active.offsetY}px`;

        const target = document.elementFromPoint(
          event.clientX, event.clientY
        )?.closest(".artwall-reorder-row-v2");

        if (!target || target.parentElement !== list) return;

        const rect = target.getBoundingClientRect();
        if (event.clientY < rect.top + rect.height / 2) {
          target.before(active.placeholder);
        } else {
          target.after(active.placeholder);
        }
      });

      handle.addEventListener("pointerup", event => {
        if (active && event.pointerId === active.pointerId) finishDrag();
      });

      handle.addEventListener("pointercancel", event => {
        if (active && event.pointerId === active.pointerId) finishDrag();
      });

      return row;
    };

    const loadMore = () => {
      if (renderedCount >= order.length) return;

      const next = order.slice(renderedCount, renderedCount + PAGE_SIZE);
      const fragment = document.createDocumentFragment();

      next.forEach(id => {
        const row = createRow(id);
        if (row) fragment.appendChild(row);
      });

      list.appendChild(fragment);
      renderedCount += next.length;
      updateSelectionUI();
    };

    const renderFromStart = () => {
      list.replaceChildren();
      renderedCount = 0;
      empty.hidden = order.length !== 0;
      loadMore();
    };

    const maybeLoadMore = () => {
      if (renderedCount >= order.length) return;

      const remaining =
        dialog.scrollHeight - dialog.scrollTop - dialog.clientHeight;

      if (remaining < 240) loadMore();
    };

    const moveSelected = direction => {
      if (!selectedIds.size) return;

      const selected = order.filter(id => selectedIds.has(id));
      const rest = order.filter(id => !selectedIds.has(id));

      order = direction === "start"
        ? [...selected, ...rest]
        : [...rest, ...selected];

      selectedIds.clear();
      syncGrid(order, {
        dirty: true,
        reason: direction === "start"
          ? "popup-move-first"
          : "popup-move-last"
      });

      renderFromStart();
      if (direction === "start") dialog.scrollTop = 0;
    };

    moveFirst.addEventListener("click", () => moveSelected("start"));
    moveLast.addEventListener("click", () => moveSelected("end"));
    dialog.addEventListener("scroll", maybeLoadMore, {passive: true});

    renderFromStart();

    requestAnimationFrame(() => {
      while (
        renderedCount < order.length &&
        dialog.scrollHeight <= dialog.clientHeight + 80
      ) {
        const beforeCount = renderedCount;
        loadMore();
        if (renderedCount === beforeCount) break;
      }
    });

    const closeDialog = restore => {
      if (active) finishDrag();

      if (restore) {
        order = [...before];
        syncGrid(before, {dirty: true, reason: "popup-cancel"});
      }

      backdrop.remove();
      document.body.style.overflow = originalBodyOverflow;
    };

    close.addEventListener("click", () => closeDialog(true));
    cancel.addEventListener("click", () => closeDialog(true));

    apply.addEventListener("click", () => {
      syncGrid(order, {dirty: true, reason: "popup-apply"});
      backdrop.remove();
      document.body.style.overflow = originalBodyOverflow;
    });
  };

  itemsButton.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openDialog();
  }, true);

  saveButton?.addEventListener("click", () => {
    window.setTimeout(() => {
      const order = [...store.order];

      if (window.MuuzeeArtWallStore?.patch) {
        window.MuuzeeArtWallStore.patch({exhibitionOrder: order});
        return;
      }

      const current = readJSON(SETTINGS_KEY, {});
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({...current, exhibitionOrder: order})
      );
    }, 0);
  });

  document.documentElement.dataset.artwallReorderModule =
    "v20260911-seen-bulk-01";
})();
