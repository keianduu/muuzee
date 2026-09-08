/*
  Muuzee ArtWall Edit — "「観た」展示会" popup enhancement

  This module adds only column selection.
  Reorder is owned by artwall-edit-reorder.js.
  Profile settings live in the separate ArtWall情報 popup.
*/
(() => {
  "use strict";

  const DIALOG =
    ".artwall-reorder-dialog";

  let pendingBeforeColumns =
    null;

  const columnsApi =
    () =>
      window.MuuzeeArtWallColumns
      || null;

  const currentColumns =
    () => (
      Number(
        columnsApi()?.get?.()
      ) === 3
        ? 3
        : 4
    );

  const restoreColumns =
    async value => {
      const api =
        columnsApi();

      if (!api?.set) {
        return;
      }

      await api.set(
        value
      );
    };

  const enhance =
    dialog => {
      if (
        !dialog
        || dialog.dataset
          .seenPopupEnhanced
      ) {
        return;
      }

      dialog.dataset
        .seenPopupEnhanced =
          "true";

      const beforeColumns =
        pendingBeforeColumns
        ?? currentColumns();

      pendingBeforeColumns =
        null;

      const heading =
        dialog.querySelector(
          "h2"
        );

      if (heading) {
        heading.textContent =
          "「観た」展示会";
      }

      const body =
        dialog.querySelector(
          ".artwall-reorder-dialog-body"
        );

      if (!body) {
        return;
      }

      const section =
        document.createElement(
          "div"
        );

      section.className =
        "artwall-reorder-columns";

      section.setAttribute(
        "aria-label",
        "ArtWallの列数"
      );

      section.innerHTML = `
        <span class="artwall-reorder-columns-label">
          列数
        </span>

        <div
          class="artwall-reorder-column-options"
          role="radiogroup"
          aria-label="列数"
        >
          <label class="artwall-reorder-column-option">
            <input
              type="radio"
              name="artwall-seen-popup-columns"
              value="3"
              ${beforeColumns === 3 ? "checked" : ""}
            >
            <span>3列</span>
          </label>

          <label class="artwall-reorder-column-option">
            <input
              type="radio"
              name="artwall-seen-popup-columns"
              value="4"
              ${beforeColumns === 4 ? "checked" : ""}
            >
            <span>4列</span>
          </label>
        </div>
      `;

      body.before(
        section
      );

      let applied =
        false;

      let changed =
        false;

      section
        .querySelectorAll(
          'input[name="artwall-seen-popup-columns"]'
        )
        .forEach(
          input => {
            input.addEventListener(
              "change",
              async () => {
                if (
                  !input.checked
                  || !columnsApi()
                    ?.set
                ) {
                  return;
                }

                const next =
                  Number(
                    input.value
                  ) === 3
                    ? 3
                    : 4;

                if (
                  next
                  === currentColumns()
                ) {
                  return;
                }

                changed =
                  true;

                await columnsApi()
                  .set(
                    next
                  );
              }
            );
          }
        );

      dialog
        .querySelector(
          "[data-reorder-apply]"
        )
        ?.addEventListener(
          "click",
          () => {
            applied =
              true;

            if (changed) {
              columnsApi()
                ?.markDirty?.();
            }
          },
          true
        );

      let restored =
        false;

      const restore =
        () => {
          if (
            applied
            || restored
            || !changed
          ) {
            return;
          }

          restored =
            true;

          void restoreColumns(
            beforeColumns
          );
        };

      dialog
        .querySelectorAll(
          [
            "[data-reorder-cancel]",
            "[data-reorder-close]"
          ].join(",")
        )
        .forEach(
          button => {
            button.addEventListener(
              "click",
              restore,
              true
            );
          }
        );

      const backdrop =
        dialog.closest(
          ".artwall-reorder-dialog-backdrop"
        );

      backdrop?.addEventListener(
        "click",
        event => {
          if (
            event.target
            === backdrop
          ) {
            restore();
          }
        },
        true
      );

      const onKeyDown =
        event => {
          if (
            event.key
            === "Escape"
          ) {
            restore();
          }
        };

      document.addEventListener(
        "keydown",
        onKeyDown,
        true
      );

      const removalObserver =
        new MutationObserver(
          () => {
            if (
              !dialog.isConnected
            ) {
              document.removeEventListener(
                "keydown",
                onKeyDown,
                true
              );

              removalObserver.disconnect();
              restore();
            }
          }
        );

      removalObserver.observe(
        document.body,
        {
          childList:true,
          subtree:true
        }
      );
    };

  document.addEventListener(
    "click",
    event => {
      const trigger =
        event.target
          ?.closest?.(
            ".artwall-editor-plus--items"
          );

      if (!trigger) {
        return;
      }

      pendingBeforeColumns =
        currentColumns();
    },
    true
  );

  const observer =
    new MutationObserver(
      mutations => {
        for (
          const mutation
          of mutations
        ) {
          for (
            const node
            of mutation.addedNodes
          ) {
            if (
              !(node instanceof Element)
            ) {
              continue;
            }

            if (
              node.matches?.(
                DIALOG
              )
            ) {
              enhance(
                node
              );
            }

            node
              .querySelectorAll?.(
                DIALOG
              )
              .forEach(
                enhance
              );
          }
        }
      }
    );

  observer.observe(
    document.body,
    {
      childList:true,
      subtree:true
    }
  );

  document
    .querySelectorAll(
      DIALOG
    )
    .forEach(
      enhance
    );

  document.documentElement
    .dataset
    .artwallSeenPopup =
      "v20260908-three-popups-01";
})();
