(() => {
  "use strict";

  const SETTINGS_KEY = "muuzee:artwall-settings";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const preview = $("[data-artwall-editor-preview]") || $(".artwall");
  const canvas = $("[data-artwall-editor-canvas]");
  const overlay = $("[data-artwall-editor-overlay]");

  if (!preview || !canvas || !overlay) return;

  const buttons = Object.fromEntries(
    $$("[data-artwall-edit-target]", overlay)
      .map(button => [button.dataset.artwallEditTarget, button])
  );

  const dialogBackdrop = $("[data-artwall-dialog-backdrop]");
  const dialog = $("[data-artwall-dialog]");
  const dialogTitle = $("[data-artwall-dialog-title]");
  const dialogBody = $("[data-artwall-dialog-body]");
  const dialogApply = $("[data-artwall-dialog-apply]");
  const dialogCancel = $("[data-artwall-dialog-cancel]");
  const dialogClose = $("[data-artwall-dialog-close]");

  const saveAll = $("[data-artwall-save-all]");
  const saveStatus = $("[data-artwall-save-status]");

  const palette = {
    default: "",
    blue: "#eef4f7",
    pink: "#f8eef1",
    green: "#eef4ed",
    yellow: "#faf5df",
    beige: "#fbfaf6"
  };

  const defaults = {
    title: "",
    comment: "",
    background: "default",
    columns: 3,
    showIcon: true,
    hiddenPrototypeItems: [],
    prototypeOrder: []
  };

  const readJSON = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  };

  const clone = value => JSON.parse(JSON.stringify(value));

  const saved = readJSON(SETTINGS_KEY, {});
  let state = {...defaults, ...(saved && typeof saved === "object" ? saved : {})};
  state.columns = Number(state.columns) === 4 ? 4 : 3;
  state.showIcon = state.showIcon !== false;
  state.hiddenPrototypeItems = Array.isArray(state.hiddenPrototypeItems)
    ? state.hiddenPrototypeItems.map(String)
    : [];
  state.prototypeOrder = Array.isArray(state.prototypeOrder)
    ? state.prototypeOrder.map(String)
    : [];

  let persisted = clone(state);
  let activeTarget = null;
  let activeDraft = null;
  let dragState = null;

  const directImageChildCount = element => (
    Array.from(element.children)
      .filter(child => child.querySelector("img"))
      .length
  );

  const discoverGrid = () => {
    /*
      Prefer the real shared ArtWall exhibition-grid classes.
      Geometry fallback is used only when no known shared class exists.
    */
    const explicit = preview.querySelector(
      [
        ".wall-grid",
        ".artwall-grid",
        ".wall-masonry",
        ".artwall-masonry",
        "[data-artwall-grid]",
        "[data-wall-grid]",
        ".masonry"
      ].join(",")
    );

    if (
      explicit
      && directImageChildCount(explicit) >= 2
    ) {
      return explicit;
    }

    const candidates = Array.from(
      preview.querySelectorAll("*")
    )
      .map(element => ({
        element,
        count: directImageChildCount(element)
      }))
      .filter(item => item.count >= 2)
      .sort((a, b) => {
        const aRect =
          a.element.getBoundingClientRect();

        const bRect =
          b.element.getBoundingClientRect();

        const aArea =
          aRect.width * aRect.height;

        const bArea =
          bRect.width * bRect.height;

        return (
          (b.count - a.count)
          || (bArea - aArea)
        );
      });

    return candidates[0]?.element || null;
  };

  const grid = discoverGrid();

  const gridItems = () => (
    grid
      ? Array.from(grid.children).filter(child => child.querySelector("img"))
      : []
  );

  const snapshotItems = gridItems().map((node, index) => ({
    id: node.dataset.exhibitionId || `prototype-${index + 1}`,
    node: node.cloneNode(true),
    image: node.querySelector("img")?.src || "",
    alt: node.querySelector("img")?.alt || `展示会 ${index + 1}`
  }));

  const outsideGrid = element => (
    element
    && (!grid || !grid.contains(element))
  );

  const visibleElement = element => {
    if (!element) return false;

    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      style.display !== "none"
      && style.visibility !== "hidden"
      && rect.width > 0
      && rect.height > 0
    );
  };

  /*
    Profile icon:
    use the first visible image outside the exhibition grid.
    This avoids matching generic icon wrappers.
  */
  const discoverProfileIcon = () => {
    const candidates = $$("img", preview)
      .filter(outsideGrid)
      .filter(visibleElement);

    return candidates[0] || null;
  };

  /*
    Title:
    choose the visible text element outside the grid with the largest
    computed font size. Limit candidates to semantic heading/text nodes.
  */
  const discoverTitle = () => {
    const candidates = $$(
      "h1,h2,h3,h4,strong,[class*='title']",
      preview
    )
      .filter(outsideGrid)
      .filter(visibleElement)
      .filter(element => {
        const text = element.textContent.trim();

        return (
          text.length >= 2
          && !/^(EXHIBITIONS|MUSEUMS|ARTISTS|\d+)$/i.test(text)
        );
      })
      .map(element => ({
        element,
        fontSize: parseFloat(
          getComputedStyle(element).fontSize
        ) || 0,
        area: (
          element.getBoundingClientRect().width
          * element.getBoundingClientRect().height
        )
      }))
      .sort((a, b) => (
        (b.fontSize - a.fontSize)
        || (b.area - a.area)
      ));

    return candidates[0]?.element || null;
  };

  /*
    Comment:
    prefer a visible paragraph outside the grid.
    Fall back to description/comment classes only when needed.
  */
  const discoverComment = () => {
    const paragraphs = $$("p", preview)
      .filter(outsideGrid)
      .filter(visibleElement)
      .filter(element => element.textContent.trim().length >= 4);

    if (paragraphs.length) {
      return paragraphs[0];
    }

    return $$(
      "[class*='comment'],[class*='description'],[class*='lead']",
      preview
    )
      .filter(outsideGrid)
      .filter(visibleElement)[0] || null;
  };

  const parts = {
    icon: discoverProfileIcon(),
    title: discoverTitle(),
    comment: discoverComment()
  };

  const discoverIconVisual = image => {
    if (!image) return null;

    let current = image;

    for (let depth = 0; depth < 4; depth += 1) {
      const parent = current.parentElement;

      if (!parent || parent === preview) break;

      const rect = parent.getBoundingClientRect();
      const ratio = rect.height
        ? rect.width / rect.height
        : 0;

      if (
        rect.width >= 32
        && rect.width <= 160
        && rect.height >= 32
        && rect.height <= 160
        && ratio >= .7
        && ratio <= 1.35
      ) {
        current = parent;
        continue;
      }

      break;
    }

    return current;
  };

  const iconVisual = discoverIconVisual(
    parts.icon
  );

  const original = {
    title: parts.title?.textContent?.trim() || "",
    comment: parts.comment?.textContent?.trim() || ""
  };

  if (!state.title) state.title = original.title;
  if (!state.comment) state.comment = original.comment;

  const setDirty = dirty => {
    if (saveAll) {
      saveAll.disabled = !dirty;
      saveAll.setAttribute(
        "aria-disabled",
        dirty ? "false" : "true"
      );
    }
  };

  const isDirty = () => JSON.stringify(state) !== JSON.stringify(persisted);

  const saveState = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state));
    persisted = clone(state);
    setDirty(false);

    window.dispatchEvent(new CustomEvent("muuzee:artwall-change", {
      detail: clone(state)
    }));
  };



  const wallFade = preview.querySelector(
    ".wall-fade"
  );

  let originalWallFadeGradient = "";

  const captureWallFadeGradient = () => {
    if (!wallFade) return;

    if (!originalWallFadeGradient) {
      originalWallFadeGradient =
        getComputedStyle(
          wallFade
        ).backgroundImage || "";
    }
  };

  const hexToRgb = hex => {
    const value = String(hex || "")
      .replace("#", "")
      .trim();

    if (!/^[0-9a-f]{6}$/i.test(value)) {
      return null;
    }

    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16)
    };
  };

  const recolorGradient = (
    gradient,
    color
  ) => {
    const rgb = hexToRgb(color);

    if (!rgb || !gradient) {
      return gradient;
    }

    /*
      Chrome computed styles normally serialize gradient colors as
      rgb()/rgba(). Replace only RGB channels and keep alpha + stop positions,
      which preserves the existing .wall-fade gradient shape.
    */
    return gradient.replace(
      /rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)/gi,
      (match, _r, _g, _b, alpha) => {
        const a = alpha == null
          ? 1
          : Number(alpha);

        if (a >= 1) {
          return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        }

        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
      }
    );
  };

  const syncWallFade = color => {
    if (!wallFade) return;

    captureWallFadeGradient();

    if (
      !color
      || !originalWallFadeGradient
      || originalWallFadeGradient === "none"
    ) {
      wallFade.style.removeProperty(
        "background-image"
      );
      return;
    }

    wallFade.style.setProperty(
      "background-image",
      recolorGradient(
        originalWallFadeGradient,
        color
      ),
      "important"
    );
  };

  /* actual-wall-fade-sync:start */

  const actualWallFade = () => (
    preview.querySelector(".wall-fade")
    || canvas?.querySelector(".wall-fade")
    || document.querySelector(".wall-fade")
  );

  let originalActualWallFade = "";

  const captureActualWallFade = () => {
    const fade = actualWallFade();

    if (!fade) {
      return null;
    }

    if (!originalActualWallFade) {
      originalActualWallFade =
        getComputedStyle(fade).backgroundImage || "";
    }

    return fade;
  };

  const artwallFadeHexToRgb = hex => {
    const value = String(hex || "")
      .replace("#", "")
      .trim();

    if (!/^[0-9a-f]{6}$/i.test(value)) {
      return null;
    }

    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16)
    };
  };

  const recolorActualWallFade = (
    gradient,
    color
  ) => {
    const rgb =
      artwallFadeHexToRgb(color);

    if (
      !rgb
      || !gradient
      || gradient === "none"
    ) {
      return gradient;
    }

    return gradient.replace(
      /rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)/gi,
      (_match, _r, _g, _b, alpha) => {
        const a = (
          alpha == null
            ? 1
            : Number(alpha)
        );

        if (a >= 1) {
          return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        }

        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
      }
    );
  };

  const syncActualWallFade = color => {
    const fade =
      captureActualWallFade();

    if (!fade) {
      return;
    }

    if (!color) {
      fade.style.removeProperty(
        "background-image"
      );
      return;
    }

    const recolored =
      recolorActualWallFade(
        originalActualWallFade,
        color
      );

    if (
      recolored
      && recolored !== "none"
    ) {
      fade.style.setProperty(
        "background-image",
        recolored,
        "important"
      );
    }
  };

  /* actual-wall-fade-sync:end */

  const applyBackground = () => {
    const color =
      palette[state.background] || "";

    if (!color) {
      preview.style.removeProperty(
        "background"
      );

      if (
        typeof syncBottomGradient
        === "function"
      ) {
        syncBottomGradient("");
      }

      syncActualWallFade("");
      return;
    }

    preview.style.setProperty(
      "background",
      color,
      "important"
    );

    if (
      typeof syncBottomGradient
      === "function"
    ) {
      syncBottomGradient(color);
    }

    syncActualWallFade(color);
  };

  const applyColumns = () => {
    if (!grid) return;

    const style = getComputedStyle(grid);

    if (
      style.display === "grid"
      || style.display === "inline-grid"
    ) {
      grid.style.setProperty(
        "grid-template-columns",
        `repeat(${state.columns},minmax(0,1fr))`,
        "important"
      );
    }

    grid.style.setProperty(
      "column-count",
      String(state.columns)
    );
  };

  const renderPrototypeItems = () => {
    if (!grid || !snapshotItems.length) return;

    const byId = new Map(snapshotItems.map(item => [item.id, item]));

    const orderedIds = [
      ...state.prototypeOrder.filter(id => byId.has(id)),
      ...snapshotItems.map(item => item.id).filter(id => !state.prototypeOrder.includes(id))
    ];

    grid.replaceChildren();

    for (const id of orderedIds) {
      if (state.hiddenPrototypeItems.includes(id)) continue;

      const item = byId.get(id);
      if (!item) continue;

      const node = item.node.cloneNode(true);
      node.dataset.exhibitionId = item.id;
      grid.appendChild(node);
    }
  };

  const applyState = () => {
    if (parts.title) parts.title.textContent = state.title || original.title;
    if (parts.comment) parts.comment.textContent = state.comment || original.comment;

    if (iconVisual) {
      iconVisual.style.visibility =
        state.showIcon ? "" : "hidden";

      iconVisual.style.pointerEvents =
        state.showIcon ? "" : "none";
    }

    applyBackground();
    applyColumns();
    renderPrototypeItems();
    positionButtons();
  };

  const rectWithinCanvas = element => {
    if (!element) return null;

    const canvasRect = canvas.getBoundingClientRect();
    const rect = element.getBoundingClientRect();

    return {
      left: rect.left - canvasRect.left,
      top: rect.top - canvasRect.top,
      width: rect.width,
      height: rect.height
    };
  };

  const snap4 = value => (
    Math.round(value / 4) * 4
  );

  const placeButton = (
    name,
    x,
    y
  ) => {
    const button = buttons[name];

    if (!button) return;

    const width =
      button.offsetWidth || 24;

    const height =
      button.offsetHeight || 24;

    button.hidden = false;
    button.style.display = "flex";
    button.style.removeProperty(
      "right"
    );

    const maxLeft = Math.max(
      4,
      canvas.clientWidth
        - width
        - 4
    );

    const maxTop = Math.max(
      4,
      canvas.clientHeight
        - height
        - 4
    );

    button.style.left =
      `${snap4(
        Math.max(
          4,
          Math.min(
            maxLeft,
            x
          )
        )
      )}px`;

    button.style.top =
      `${snap4(
        Math.max(
          4,
          Math.min(
            maxTop,
            y
          )
        )
      )}px`;
  };

  const placeButtonRight = (
    name,
    right,
    y
  ) => {
    const button = buttons[name];

    if (!button) return;

    const width =
      button.offsetWidth || 24;

    placeButton(
      name,
      right - width,
      y
    );
  };



  const positionButtons = () => {
    const iconRect = rectWithinCanvas(
      iconVisual
    );

    const titleRect = rectWithinCanvas(
      parts.title
    );

    const commentRect = rectWithinCanvas(
      parts.comment
    );

    const gridRect = rectWithinCanvas(
      grid
    );

    const previewRect = rectWithinCanvas(
      preview
    );

    /*
      Handle size = 24px.
      16px outward means only 8px overlaps the target area.
      All values are multiples of 4.
    */
    const OUTSET = 16;
    const GRID_INSET = 8;
    const FRAME_INSET = 16;

    if (iconRect) {
      placeButton(
        "icon",
        iconRect.left
          - OUTSET,
        iconRect.top
          - OUTSET
      );
    }

    if (titleRect) {
      placeButton(
        "title",
        titleRect.left
          - OUTSET,
        titleRect.top
          - OUTSET
      );
    }

    if (commentRect) {
      placeButton(
        "comment",
        commentRect.left
          - OUTSET,
        commentRect.top
          - OUTSET
      );
    }

    if (gridRect) {
      /*
        Fixed editor-handle positions requested for the current ArtWall layout.
        Both values stay on the 4px grid.
      */
      const itemsButton =
        buttons.items;

      if (itemsButton) {
        itemsButton.hidden = false;
        itemsButton.style.display = "flex";
        itemsButton.style.left = "4px";
        itemsButton.style.right = "";
        itemsButton.style.top = "200px";
      }

      const columnsButton =
        buttons.columns;

      if (columnsButton) {
        columnsButton.hidden = false;
        columnsButton.style.display = "flex";
        columnsButton.style.left = "";
        columnsButton.style.right = "8px";
        columnsButton.style.top = "184px";
      }
    }

    if (previewRect) {
      placeButtonRight(
        "background",
        previewRect.left
          + previewRect.width
          - FRAME_INSET,
        previewRect.top
          + FRAME_INSET
      );
    }
  };

  const openDialog = target => {
    activeTarget = target;
    activeDraft = clone(state);

    if (!dialogBackdrop || !dialog || !dialogTitle || !dialogBody) return;

    dialog.classList.toggle("is-wide", target === "items");
    dialogBody.replaceChildren();

    if (target === "icon") {
      dialogTitle.textContent = "アイコン表示";

      dialogBody.innerHTML = `
        <div class="artwall-editor-dialog-options">
          <label class="artwall-editor-dialog-option">
            <input type="radio" name="dialog-icon" value="on" ${state.showIcon ? "checked" : ""}>
            <span>表示</span>
          </label>
          <label class="artwall-editor-dialog-option">
            <input type="radio" name="dialog-icon" value="off" ${!state.showIcon ? "checked" : ""}>
            <span>非表示</span>
          </label>
        </div>
      `;
    }

    if (target === "title") {
      dialogTitle.textContent = "タイトル編集";

      dialogBody.innerHTML = `
        <label class="artwall-editor-dialog-field">
          <span>タイトル</span>
          <input type="text" maxlength="80" data-dialog-title-input>
        </label>
      `;

      $("[data-dialog-title-input]", dialogBody).value = state.title;
    }

    if (target === "comment") {
      dialogTitle.textContent = "コメント編集";

      dialogBody.innerHTML = `
        <label class="artwall-editor-dialog-field">
          <span>コメント</span>
          <textarea maxlength="280" data-dialog-comment-input></textarea>
        </label>
      `;

      $("[data-dialog-comment-input]", dialogBody).value = state.comment;
    }

    if (target === "background") {
      dialogTitle.textContent = "背景を変更";

      const colors = [
        ["default", "デフォルト", ""],
        ["blue", "青", "#eef4f7"],
        ["pink", "ピンク", "#f8eef1"],
        ["green", "グリーン", "#eef4ed"],
        ["yellow", "黄色", "#faf5df"],
        ["beige", "ベージュ", "#fbfaf6"]
      ];

      dialogBody.innerHTML = `
        <div class="artwall-editor-dialog-colors">
          ${colors.map(([value, label, color]) => `
            <label class="artwall-editor-dialog-color">
              <input type="radio" name="dialog-background" value="${value}" ${state.background === value ? "checked" : ""}>
              <span>
                <i style="background:${color || "var(--greige)"}"></i>
                ${label}
              </span>
            </label>
          `).join("")}
        </div>
      `;
    }

    if (target === "columns") {
      dialogTitle.textContent = "展示会の列数";

      dialogBody.innerHTML = `
        <div class="artwall-editor-dialog-options">
          <label class="artwall-editor-dialog-option">
            <input type="radio" name="dialog-columns" value="3" ${state.columns === 3 ? "checked" : ""}>
            <span>3列</span>
          </label>
          <label class="artwall-editor-dialog-option">
            <input type="radio" name="dialog-columns" value="4" ${state.columns === 4 ? "checked" : ""}>
            <span>4列</span>
          </label>
        </div>
      `;
    }

    if (target === "items") {
      dialogTitle.textContent = "展示会写真を編集";
      buildItemEditor();
    }

    dialogBackdrop.hidden = false;
    document.body.style.overflow = "hidden";
  };

  const closeDialog = restore => {
    if (restore && activeDraft) {
      state = clone(activeDraft);
      captureWallFadeGradient();
  applyState();
    }

    activeTarget = null;
    activeDraft = null;
    dragState = null;

    if (dialogBackdrop) dialogBackdrop.hidden = true;
    document.body.style.overflow = "";
  };

  const buildItemEditor = () => {
    const byId = new Map(snapshotItems.map(item => [item.id, item]));

    const orderedIds = [
      ...state.prototypeOrder.filter(id => byId.has(id)),
      ...snapshotItems.map(item => item.id).filter(id => !state.prototypeOrder.includes(id))
    ];

    const list = document.createElement("div");
    list.className = "artwall-editor-item-list";
    list.dataset.dialogItemList = "";

    for (const id of orderedIds) {
      const item = byId.get(id);
      if (!item) continue;

      const article = document.createElement("article");
      article.dataset.itemId = id;
      article.draggable = true;

      const image = document.createElement("img");
      image.src = item.image;
      image.alt = item.alt;
      image.draggable = false;

      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = !state.hiddenPrototypeItems.includes(id);

      label.appendChild(checkbox);
      article.appendChild(image);
      article.appendChild(label);
      list.appendChild(article);

      checkbox.addEventListener("change", () => {
        const hidden = new Set(state.hiddenPrototypeItems);

        if (checkbox.checked) hidden.delete(id);
        else hidden.add(id);

        state.hiddenPrototypeItems = Array.from(hidden);
        renderPrototypeItems();
        positionButtons();
        setDirty(true);
      });

      article.addEventListener("dragstart", event => {
        if (event.target.closest("label")) {
          event.preventDefault();
          return;
        }

        const placeholder = document.createElement("div");
        placeholder.className = "artwall-editor-item-drop";

        article.after(placeholder);
        article.classList.add("is-dragging");

        dragState = {article, placeholder};
      });

      article.addEventListener("dragend", () => {
        if (!dragState) return;

        dragState.article.classList.remove("is-dragging");
        dragState.placeholder.remove();
        dragState = null;

        state.prototypeOrder = Array.from(
          list.querySelectorAll("article")
        ).map(node => node.dataset.itemId);

        renderPrototypeItems();
        positionButtons();
        setDirty(true);
      });
    }

    list.addEventListener("dragover", event => {
      if (!dragState) return;
      event.preventDefault();

      const target = event.target.closest("article");

      if (!target || target === dragState.article) return;

      const rect = target.getBoundingClientRect();

      if (event.clientY < rect.top + rect.height / 2) {
        target.before(dragState.placeholder);
      } else {
        target.after(dragState.placeholder);
      }
    });

    list.addEventListener("drop", event => {
      if (!dragState) return;
      event.preventDefault();

      dragState.placeholder.before(dragState.article);
      dragState.article.classList.remove("is-dragging");
      dragState.placeholder.remove();
      dragState = null;

      state.prototypeOrder = Array.from(
        list.querySelectorAll("article")
      ).map(node => node.dataset.itemId);

      renderPrototypeItems();
      positionButtons();
      setDirty(true);
    });

    dialogBody.appendChild(list);
  };

  const applyDialog = () => {
    if (activeTarget === "icon") {
      const value = $('input[name="dialog-icon"]:checked', dialogBody)?.value;
      state.showIcon = value !== "off";
    }

    if (activeTarget === "title") {
      state.title = $("[data-dialog-title-input]", dialogBody)?.value || "";
    }

    if (activeTarget === "comment") {
      state.comment = $("[data-dialog-comment-input]", dialogBody)?.value || "";
    }

    if (activeTarget === "background") {
      state.background = $('input[name="dialog-background"]:checked', dialogBody)?.value || "default";
    }

    if (activeTarget === "columns") {
      state.columns = Number(
        $('input[name="dialog-columns"]:checked', dialogBody)?.value
      ) === 4 ? 4 : 3;
    }

    applyState();
    setDirty(isDirty());
    closeDialog(false);
  };

  Object.entries(buttons).forEach(([target, button]) => {
    button.addEventListener("click", () => openDialog(target));
  });

  dialogApply?.addEventListener("click", applyDialog);
  dialogCancel?.addEventListener("click", () => closeDialog(true));
  dialogClose?.addEventListener("click", () => closeDialog(true));

  dialogBackdrop?.addEventListener("click", event => {
    if (event.target === dialogBackdrop) {
      closeDialog(true);
    }
  });

  window.addEventListener("keydown", event => {
    if (event.key === "Escape" && dialogBackdrop && !dialogBackdrop.hidden) {
      closeDialog(true);
    }
  });

  saveAll?.addEventListener("click", saveState);

  const resizeObserver = new ResizeObserver(positionButtons);
  resizeObserver.observe(canvas);
  resizeObserver.observe(preview);

  window.addEventListener("resize", positionButtons);

  captureActualWallFade();
  applyState();
  persisted = clone(state);
  setDirty(false);
  requestAnimationFrame(() => {
    positionButtons();

    requestAnimationFrame(
      positionButtons
    );
  });

  window.addEventListener(
    "load",
    positionButtons,
    { once:true }
  );

  if (document.fonts?.ready) {
    document.fonts.ready.then(
      positionButtons
    );
  }

  $$("img", preview).forEach(image => {
    if (!image.complete) {
      image.addEventListener(
        "load",
        positionButtons,
        { once:true }
      );
    }
  });
})();
