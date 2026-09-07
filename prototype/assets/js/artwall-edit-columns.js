(() => {
  "use strict";

  const SETTINGS_KEY =
    "muuzee:artwall-settings";

  const COLUMN_VERSION =
    2;

  const DEFAULT_COLUMNS =
    4;

  const GAP =
    8;

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

  const columnButton =
    $(
      ".artwall-editor-plus--columns"
    );

  const saveButton =
    $(
      "[data-artwall-save-all]"
    );

  if (
    !preview
    || !columnButton
  ) {
    console.warn(
      "[Muuzee ArtWall Columns v20260907-25] "
      + "required element missing"
    );

    return;
  }

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

  const settings =
    readJSON(
      SETTINGS_KEY,
      {}
    );

  /*
    New implementation starts at 4 columns.
    3 is restored only after THIS version has explicitly saved it.
  */
  let columns =
    (
      Number(
        settings
          .artwallColumnsVersion
      ) === COLUMN_VERSION
      && Number(
        settings.columns
      ) === 3
    )
      ? 3
      : DEFAULT_COLUMNS;

  let persistedColumns =
    columns;

  let dialogInstance =
    null;

  let layoutToken =
    0;

  let resizeTimer =
    0;

  /*
    Track the rendered grid width.
    iOS/PWA may change viewport HEIGHT during scroll without changing this.
  */
  let lastLayoutWidth =
    0;

  const resolveGrid = () => (
    preview.querySelector(
      ".wall-grid.muuzee-masonry-grid"
    )
  );

  const tilesOf =
    grid => (
      Array.from(
        grid.children
      )
        .filter(
          child =>
            child.querySelector(
              "img"
            )
        )
    );

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

  const waitForImage =
    image => {
      if (
        !image
        || image.complete
      ) {
        return Promise.resolve();
      }

      return new Promise(
        resolve => {
          const done =
            () => resolve();

          image.addEventListener(
            "load",
            done,
            {
              once:true
            }
          );

          image.addEventListener(
            "error",
            done,
            {
              once:true
            }
          );
        }
      );
    };

  const ratioOf =
    tile => {
      const image =
        tile.querySelector(
          "img"
        );

      if (
        image?.naturalWidth
        && image?.naturalHeight
      ) {
        return (
          image.naturalHeight
          / image.naturalWidth
        );
      }

      const rect =
        tile.getBoundingClientRect();

      if (
        rect.width > 0
        && rect.height > 0
      ) {
        return (
          rect.height
          / rect.width
        );
      }

      return 1;
    };

  /*
    Detached Masonry flow:
    1. Hide grid
    2. Read current tile DOM
    3. Detach tiles into DocumentFragment
    4. Calculate all coordinates from image ratios
    5. Apply CSS variables while detached
    6. Append once
    7. Set final grid height
    8. Show grid
  */
    const layoutMasonry =
      async requested => {
        const grid =
          resolveGrid();

        if (!grid) {
          console.warn(
            "[Muuzee ArtWall Columns] "
            + ".wall-grid.muuzee-masonry-grid not found"
          );

          return false;
        }

        const token =
          ++layoutToken;

        const requestedColumns =
          Number(
            requested
          ) === 3
            ? 3
            : 4;

        columns =
          requestedColumns;

        const tiles =
          tilesOf(
            grid
          );

        grid.dataset
          .artwallColumns =
            String(
              requestedColumns
            );

        if (
          !tiles.length
        ) {
          return true;
        }

        grid.dataset
          .artwallEditorLayoutPending =
            "true";

        await Promise.all(
          tiles.map(
            tile =>
              waitForImage(
                tile.querySelector(
                  "img"
                )
              )
          )
        );

        if (
          token !== layoutToken
        ) {
          return false;
        }

        const gridStyle =
          getComputedStyle(
            grid
          );

        const paddingLeft =
          parseFloat(
            gridStyle.paddingLeft
          ) || 0;

        const paddingRight =
          parseFloat(
            gridStyle.paddingRight
          ) || 0;

        const paddingTop =
          parseFloat(
            gridStyle.paddingTop
          ) || 0;

        const paddingBottom =
          parseFloat(
            gridStyle.paddingBottom
          ) || 0;

        const columnGap =
          parseFloat(
            gridStyle.columnGap
          );

        const rowGap =
          parseFloat(
            gridStyle.rowGap
          );

        const gap =
          Number.isFinite(
            columnGap
          )
            ? columnGap
            : (
              Number.isFinite(
                rowGap
              )
                ? rowGap
                : 4
            );

        const contentWidth =
          grid.clientWidth
          - paddingLeft
          - paddingRight;

        if (
          contentWidth <= 0
        ) {
          delete grid.dataset
            .artwallEditorLayoutPending;

          return false;
        }

        /*
          Width is the only resize dimension that requires Masonry geometry
          to be recalculated.
        */
        lastLayoutWidth =
          Math.round(
            grid.clientWidth
          );

        const columnWidth =
          (
            contentWidth
            - (
              gap
              * (
                requestedColumns - 1
              )
            )
          )
          / requestedColumns;

        const heights =
          Array(
            requestedColumns
          ).fill(
            paddingTop
          );

        /*
          Detach every tile first.
          Old live 4-column geometry cannot affect the new calculation.
        */
        const fragment =
          document.createDocumentFragment();

        for (
          const tile
          of tiles
        ) {
          fragment.appendChild(
            tile
          );
        }

        /*
          Clear every old geometry value while detached.
        */
        for (
          const tile
          of tiles
        ) {
          for (
            const property
            of [
              "position",
              "left",
              "top",
              "right",
              "bottom",
              "width",
              "height",
              "min-height",
              "max-height",
              "margin",
              "grid-row",
              "grid-row-start",
              "grid-row-end",
              "grid-column",
              "grid-column-start",
              "grid-column-end",
              "transform",
              "translate",
              "aspect-ratio"
            ]
          ) {
            tile.style.removeProperty(
              property
            );
          }

          const image =
            tile.querySelector(
              "img"
            );

          if (image) {
            for (
              const property
              of [
                "width",
                "height",
                "min-height",
                "max-height",
                "object-fit",
                "object-position",
                "transform",
                "aspect-ratio"
              ]
            ) {
              image.style.removeProperty(
                property
              );
            }
          }
        }

        /*
          Calculate shortest-column placement from image natural ratios only.
        */
        for (
          const tile
          of tiles
        ) {
          const image =
            tile.querySelector(
              "img"
            );

          let ratio =
            1;

          if (
            image?.naturalWidth
            && image?.naturalHeight
          ) {
            ratio =
              image.naturalHeight
              / image.naturalWidth;
          }

          if (
            !Number.isFinite(
              ratio
            )
            || ratio <= 0
          ) {
            ratio =
              1;
          }

          let targetColumn =
            0;

          for (
            let index = 1;
            index < heights.length;
            index += 1
          ) {
            if (
              heights[index]
              < heights[targetColumn]
            ) {
              targetColumn =
                index;
            }
          }

          const left =
            paddingLeft
            + (
              targetColumn
              * (
                columnWidth
                + gap
              )
            );

          const top =
            heights[
              targetColumn
            ];

          const itemHeight =
            columnWidth
            * ratio;

          tile.style.setProperty(
            "--artwall-editor-left",
            `${left}px`
          );

          tile.style.setProperty(
            "--artwall-editor-top",
            `${top}px`
          );

          tile.style.setProperty(
            "--artwall-editor-width",
            `${columnWidth}px`
          );

          heights[
            targetColumn
          ] +=
            itemHeight
            + gap;
        }

        const finalHeight =
          Math.max(
            0,
            Math.max(
              ...heights
            )
            - gap
            + paddingBottom
          );

        grid.dataset
          .artwallEditorLayoutManaged =
            "true";

        /*
          Exactly one append after every coordinate is prepared.
        */
        grid.appendChild(
          fragment
        );

        grid.style.setProperty(
          "--artwall-editor-grid-height",
          `${finalHeight}px`
        );

        await new Promise(
          resolve =>
            requestAnimationFrame(
              resolve
            )
        );

        if (
          token !== layoutToken
        ) {
          return false;
        }

        delete grid.dataset
          .artwallEditorLayoutPending;

        /*
          Measure the rendered result.
        */
        const lefts =
          [];

        for (
          const tile
          of tiles
        ) {
          const left =
            Math.round(
              tile
                .getBoundingClientRect()
                .left
            );

          if (
            !lefts.some(
              value =>
                Math.abs(
                  value - left
                ) <= 2
            )
          ) {
            lefts.push(
              left
            );
          }
        }

        grid.dataset
          .artwallVisualColumns =
            String(
              lefts.length
            );

        console.info(
          "[Muuzee ArtWall Columns]",
          {
            requested:
              requestedColumns,
            measured:
              lefts.length,
            gap:
              Math.round(
                gap * 100
              ) / 100,
            mode:
              "detached-natural-ratio-masonry"
          }
        );

        return true;
      };

  const createDialog =
    () => {
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
        "artwall-collection-dialog is-compact";

      dialog.setAttribute(
        "role",
        "dialog"
      );

      dialog.setAttribute(
        "aria-modal",
        "true"
      );

      /*
        IMPORTANT:
        because the new default is 4, the 4-column radio
        is active on first open.
      */
      dialog.innerHTML = `
        <div class="artwall-collection-dialog-head">
          <div>
            <small>ArtWall Edit</small>
            <h2>展示会の列数</h2>
          </div>

          <button
            type="button"
            class="artwall-collection-dialog-close"
            aria-label="閉じる"
          >×</button>
        </div>

        <div class="artwall-collection-dialog-body">
          <p class="artwall-collection-help">
            選択するとArtWallを再描画します。
          </p>

          <div class="artwall-column-options">
            <label class="artwall-column-option">
              <input
                type="radio"
                name="artwall-columns-v2"
                value="3"
                ${
                  columns === 3
                    ? "checked"
                    : ""
                }
              >
              <span>3列</span>
            </label>

            <label class="artwall-column-option">
              <input
                type="radio"
                name="artwall-columns-v2"
                value="4"
                ${
                  columns === 4
                    ? "checked"
                    : ""
                }
              >
              <span>4列</span>
            </label>
          </div>
        </div>

        <div class="artwall-collection-dialog-actions">
          <button
            type="button"
            class="is-secondary"
            data-columns-cancel
          >キャンセル</button>

          <button
            type="button"
            data-columns-apply
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
        dialog,
        cancel:
          $(
            "[data-columns-cancel]",
            dialog
          ),
        apply:
          $(
            "[data-columns-apply]",
            dialog
          ),
        close:
          $(
            ".artwall-collection-dialog-close",
            dialog
          )
      };
    };

  const destroyDialog =
    instance => {
      instance.backdrop.remove();

      document.body.style.overflow =
        "";

      dialogInstance =
        null;
    };

  const openColumns =
    event => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (
        dialogInstance
      ) {
        return;
      }

      const before =
        columns;

      const instance =
        createDialog();

      dialogInstance =
        instance;

      $$(
        'input[name="artwall-columns-v2"]',
        instance.dialog
      )
        .forEach(
          input => {
            input.addEventListener(
              "change",
              async () => {
                if (
                  !input.checked
                ) {
                  return;
                }

                await layoutMasonry(
                  input.value
                );

                markDirty();
              }
            );
          }
        );

      const cancel =
        async () => {
          await layoutMasonry(
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

      instance.backdrop
        .addEventListener(
          "click",
          event => {
            if (
              event.target
              === instance
                .backdrop
            ) {
              cancel();
            }
          }
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

  /*
    Only this module owns the column edit button.
  */
  columnButton.addEventListener(
    "click",
    openColumns,
    true
  );

  /*
    Photo editor explicitly tells us when its child DOM changed.
    One explicit event triggers one re-layout; no DOM mutation watcher is used.
  */
  preview.addEventListener(
    "muuzee:artwall-grid-changed",
    () => {
      layoutMasonry(
        columns
      );
    }
  );

  /* width-only-resize-guard:start
     Browser chrome / safe-area changes can emit resize while scrolling.
     Relayout only when the ArtWall grid width actually changed.
  */
  window.addEventListener(
    "resize",
    () => {
      const grid =
        resolveGrid();

      const nextWidth =
        Math.round(
          grid?.clientWidth
          || 0
        );

      if (
        !nextWidth
        || (
          lastLayoutWidth
          && Math.abs(
            nextWidth
            - lastLayoutWidth
          ) < 2
        )
      ) {
        return;
      }

      window.clearTimeout(
        resizeTimer
      );

      resizeTimer =
        window.setTimeout(
          () => {
            layoutMasonry(
              columns
            );
          },
          120
        );
    }
  );
  /* width-only-resize-guard:end */

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

            localStorage.setItem(
              SETTINGS_KEY,
              JSON.stringify({
                ...current,
                columns,
                artwallColumnsVersion:
                  COLUMN_VERSION
              })
            );

            persistedColumns =
              columns;
          },
          0
        );
      }
    );

  /*
    Initial state = real 4-column detached Masonry.
  */
  requestAnimationFrame(
    () => {
      layoutMasonry(
        columns
      );
    }
  );

  document.documentElement
    .dataset
    .artwallColumnsModule =
      "v20260907-25";

  console.info(
    "[Muuzee ArtWall Columns v20260907-25]",
    {
      initial:
        columns,
      observer:
        false,
      mode:
        "detached-js-masonry"
    }
  );
})();
