/*
  Muuzee ArtWall Edit — profile "+" visual alignment

  Final rendered geometry:
  - profile left edge = Seen exhibitions + left edge
  - profile top edge  = Background + top edge

  Existing editor JS remains responsible for the base positions.
*/
(() => {
  "use strict";

  const PROFILE =
    ".artwall-editor-plus--profile";

  const BACKGROUND =
    ".artwall-editor-plus--background";

  const ITEMS =
    ".artwall-editor-plus--items";

  let raf =
    0;

  const align =
    () => {
      raf =
        0;

      const profile =
        document.querySelector(
          PROFILE
        );

      const background =
        document.querySelector(
          BACKGROUND
        );

      const items =
        document.querySelector(
          ITEMS
        );

      if (
        !profile
        || !background
        || !items
      ) {
        return;
      }

      /*
        Reset only OUR visual correction before measuring.
        Existing transform/left/top from editor positioning stays intact.
      */
      profile.style.translate =
        "0px 0px";

      const profileRect =
        profile.getBoundingClientRect();

      const itemsRect =
        items.getBoundingClientRect();

      const backgroundRect =
        background.getBoundingClientRect();

      const deltaX =
        itemsRect.left
        - profileRect.left;

      const deltaY =
        backgroundRect.top
        - profileRect.top;

      profile.style.translate =
        `${deltaX}px ${deltaY}px`;
    };

  const requestAlign =
    () => {
      if (raf) {
        cancelAnimationFrame(
          raf
        );
      }

      /*
        Existing positionButtons() runs first.
        Align one frame afterwards by actual rendered edges.
      */
      raf =
        requestAnimationFrame(
          () => {
            requestAnimationFrame(
              align
            );
          }
        );
    };

  const observe =
    selector => {
      const node =
        document.querySelector(
          selector
        );

      if (!node) {
        return;
      }

      new MutationObserver(
        requestAlign
      ).observe(
        node,
        {
          attributes:true,
          attributeFilter:[
            "style",
            "class"
          ]
        }
      );
    };

  const start =
    () => {
      observe(
        BACKGROUND
      );

      observe(
        ITEMS
      );

      requestAlign();

      window.addEventListener(
        "resize",
        requestAlign,
        {
          passive:true
        }
      );

      window.addEventListener(
        "pageshow",
        requestAlign
      );

      [
        "muuzee:artwall-grid-changed",
        "muuzee:artwall-change"
      ].forEach(
        eventName => {
          window.addEventListener(
            eventName,
            requestAlign
          );
        }
      );

      document.addEventListener(
        "visibilitychange",
        () => {
          if (
            document.visibilityState
            === "visible"
          ) {
            requestAlign();
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

  document.documentElement
    .dataset
    .artwallProfilePosition =
      "v20260908-03";
})();
