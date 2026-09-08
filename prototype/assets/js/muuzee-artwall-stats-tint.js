/*
  Muuzee Shared ArtWall — Stats tint

  Source of truth:
  - ArtWall Edit: input[name="dialog-background"].value
  - My Art / Home: saved state.background

  No rendered-color detection.
  No RGB proximity matching.
*/
(() => {
  "use strict";

  const SETTINGS_KEY =
    "muuzee:artwall-settings";

  const TINTS = {
    default:
      "rgba(100,100,0,.05)",

    pink:
      "rgba(100,0,0,.05)",

    blue:
      "rgba(0,100,100,.05)",

    green:
      "rgba(0,100,0,.05)",

    yellow:
      "rgba(100,100,0,.05)",

    beige:
      "rgba(100,100,0,.05)"
  };

  const normalizeKey =
    value => {
      const key =
        String(
          value || ""
        )
          .trim()
          .toLowerCase();

      return (
        Object.prototype
          .hasOwnProperty.call(
            TINTS,
            key
          )
      )
        ? key
        : "default";
    };

  const readSavedBackground =
    () => {
      try {
        const state =
          JSON.parse(
            localStorage.getItem(
              SETTINGS_KEY
            )
            || "{}"
          );

        return normalizeKey(
          state.background
        );
      } catch (_) {
        return "default";
      }
    };

  const applyKey =
    (
      key,
      root = document
    ) => {
      const normalized =
        normalizeKey(
          key
        );

      const tint =
        TINTS[
          normalized
        ];

      root
        .querySelectorAll(
          ".artwall .stats"
        )
        .forEach(
          stats => {
            stats.style
              .background =
                tint;

            stats.dataset
              .artwallStatsTint =
                normalized;
          }
        );
    };

  /*
    Editor live preview:
    radio value is the source of truth.
  */
  document.addEventListener(
    "change",
    event => {
      const input =
        event.target;

      if (
        !input
          ?.matches?.(
            'input[name="dialog-background"]'
          )
      ) {
        return;
      }

      applyKey(
        input.value
      );
    },
    true
  );

  /*
    Some browsers/UIs can update checked state through label click.
    Run once after the click so the checked radio is authoritative.
  */
  document.addEventListener(
    "click",
    event => {
      const dialog =
        event.target
          ?.closest?.(
            ".artwall-editor-dialog"
          );

      if (!dialog) {
        return;
      }

      const radios =
        dialog.querySelectorAll(
          'input[name="dialog-background"]'
        );

      if (!radios.length) {
        return;
      }

      requestAnimationFrame(
        () => {
          const checked =
            dialog.querySelector(
              'input[name="dialog-background"]:checked'
            );

          if (checked) {
            applyKey(
              checked.value
            );
          }
        }
      );
    },
    true
  );

  /*
    When the background popup appears, its checked radio wins.
  */
  const syncCheckedRadio =
    () => {
      const checked =
        document.querySelector(
          'input[name="dialog-background"]:checked'
        );

      if (checked) {
        applyKey(
          checked.value
        );

        return true;
      }

      return false;
    };

  /*
    Consumer pages / initial load:
    use saved background key directly.
  */
  const syncSaved =
    () => {
      if (
        syncCheckedRadio()
      ) {
        return;
      }

      applyKey(
        readSavedBackground()
      );
    };

  const dialogObserver =
    new MutationObserver(
      mutations => {
        for (
          const mutation
          of mutations
        ) {
          if (
            mutation.addedNodes
              .length
          ) {
            requestAnimationFrame(
              () => {
                syncCheckedRadio();
              }
            );

            return;
          }
        }
      }
    );

  const start =
    () => {
      syncSaved();

      dialogObserver.observe(
        document.body,
        {
          childList:true,
          subtree:true
        }
      );

      window.addEventListener(
        "muuzee:artwall-store-change",
        event => {
          const detail =
            event.detail
            || {};

          if (
            Object.prototype
              .hasOwnProperty.call(
                detail,
                "background"
              )
          ) {
            applyKey(
              detail.background
            );

            return;
          }

          syncSaved();
        }
      );

      window.addEventListener(
        "pageshow",
        syncSaved
      );

      document.addEventListener(
        "visibilitychange",
        () => {
          if (
            document.visibilityState
            === "visible"
          ) {
            syncSaved();
          }
        }
      );
    };

  if (
    document.readyState
    === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      start,
      {
        once:true
      }
    );
  } else {
    start();
  }

  window.MuuzeeArtWallStatsTint = {
    apply:
      applyKey,

    sync:
      syncSaved,

    tints:
      {
        ...TINTS
      }
  };

  document.documentElement
    .dataset
    .artwallStatsTint =
      "v20260908-08";
})();
