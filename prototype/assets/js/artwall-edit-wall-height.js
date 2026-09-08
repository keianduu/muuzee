/*
  Muuzee ArtWall Edit — wall height mode

  Reuses the current Seen-exhibition popup controls.
  No new popup / observer / store.
*/
(() => {
  "use strict";

  const HEIGHTS = {
    standard:260,
    expanded:320
  };

  const normalize =
    value =>
      value === "expanded"
        ? "expanded"
        : "standard";

  const editor =
    () =>
      window.MuuzeeArtWallEditor
      || null;

  const getMode =
    () =>
      normalize(
        editor()
          ?.getState?.()
          ?.wallHeightMode
      );

  const getWall =
    () =>
      document.querySelector(
        ".artwall-editor-canvas .wall"
      )
      || document.querySelector(
        ".artwall .wall"
      );

  const applyHeight =
    mode => {
      const wall =
        getWall();

      if (!wall) {
        return;
      }

      const current =
        normalize(
          mode
        );

      wall.style.height =
        `${HEIGHTS[current]}px`;

      wall.dataset
        .wallHeightMode =
          current;
    };

  /*
    Saved state or default standard.
  */
  applyHeight(
    getMode()
  );

  const enhance =
    () => {
      const dialog =
        document.querySelector(
          ".artwall-reorder-dialog"
        );

      const controls =
        dialog
          ?.querySelector(
            ".artwall-reorder-columns"
          );

      if (
        !dialog
        || !controls
        || controls.querySelector(
          '[name="artwall-wall-height"]'
        )
      ) {
        return;
      }

      const before =
        getMode();

      let selected =
        before;

      let committed =
        false;

      const label =
        document.createElement(
          "span"
        );

      label.className =
        "artwall-reorder-columns-label";

      label.textContent =
        "行数";

      const group =
        document.createElement(
          "div"
        );

      group.className =
        "artwall-reorder-setting-group artwall-reorder-setting-group--rows";

      const options =
        document.createElement(
          "div"
        );

      options.className =
        "artwall-reorder-column-options";

      options.innerHTML = `
        <label class="artwall-reorder-column-option">
          <input
            type="radio"
            name="artwall-wall-height"
            value="standard"
            ${before === "standard" ? "checked" : ""}
          >
          <span>標準</span>
        </label>

        <label class="artwall-reorder-column-option">
          <input
            type="radio"
            name="artwall-wall-height"
            value="expanded"
            ${before === "expanded" ? "checked" : ""}
          >
          <span>拡大</span>
        </label>
      `;

      group.append(
        label,
        options
      );

      controls.append(
        group
      );

      options.addEventListener(
        "change",
        event => {
          const input =
            event.target;

          if (
            !input.matches(
              'input[name="artwall-wall-height"]'
            )
            || !input.checked
          ) {
            return;
          }

          selected =
            normalize(
              input.value
            );

          applyHeight(
            selected
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
            committed =
              true;

            editor()
              ?.patchState?.({
                wallHeightMode:
                  selected
              });
          },
          true
        );

      const restore =
        () => {
          if (committed) {
            return;
          }

          applyHeight(
            before
          );
        };

      dialog
        .querySelectorAll(
          "[data-reorder-cancel],[data-reorder-close]"
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
    };

  /*
    Current Seen popup is created by the existing click flow.
    Wait for it to exist, then enhance once.
  */
  document.addEventListener(
    "click",
    event => {
      if (
        !event.target
          ?.closest?.(
            ".artwall-editor-plus--items"
          )
      ) {
        return;
      }

      requestAnimationFrame(
        () => {
          requestAnimationFrame(
            () => {
              enhance();

              /*
                One simple fallback for slower mobile rendering.
              */
              if (
                !document.querySelector(
                  'input[name="artwall-wall-height"]'
                )
              ) {
                setTimeout(
                  enhance,
                  60
                );
              }
            }
          );
        }
      );
    },
    true
  );

  document.documentElement
    .dataset
    .artwallWallHeight =
      "v20260908-02";
})();
