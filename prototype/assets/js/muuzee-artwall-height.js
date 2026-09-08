/*
  Muuzee Shared ArtWall — wall height consumer

  Reads the already-saved prototype state.
  No extra Store or DOM observer.

  standard -> 260px
  expanded -> 320px
*/
(() => {
  "use strict";

  const HEIGHTS = {
    standard:
      260,

    expanded:
      320
  };

  const readMode =
    () => {
      const raw =
        window.MuuzeeArtWallStore
          ?.getRaw?.()
        || {};

      return raw.wallHeightMode
        === "expanded"
          ? "expanded"
          : "standard";
    };

  const apply =
    () => {
      const mode =
        readMode();

      const height =
        HEIGHTS[
          mode
        ];

      document
        .querySelectorAll(
          ".artwall .wall"
        )
        .forEach(
          wall => {
            wall.style.height =
              `${height}px`;

            wall.dataset
              .wallHeightMode =
                mode;
          }
        );
    };

  const start =
    () => {
      apply();

      window.addEventListener(
        "muuzee:artwall-store-change",
        apply
      );

      window.addEventListener(
        "pageshow",
        apply
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

  window.MuuzeeArtWallHeight = {
    apply
  };
})();
