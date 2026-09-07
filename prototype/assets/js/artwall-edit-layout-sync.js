(() => {
  "use strict";

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

  const canvas =
    $(
      "[data-artwall-editor-canvas]"
    )
    || preview?.parentElement;

  if (
    !preview
    || !canvas
  ) {
    console.warn(
      "[Muuzee ArtWall Layout Sync] "
      + "preview/canvas missing"
    );

    return;
  }

  const handles = {
    icon:
      $(
        ".artwall-editor-plus--icon"
      ),

    title:
      $(
        ".artwall-editor-plus--title"
      ),

    comment:
      $(
        ".artwall-editor-plus--comment"
      ),

    background:
      $(
        ".artwall-editor-plus--background"
      ),

    items:
      $(
        ".artwall-editor-plus--items"
      ),

    columns:
      $(
        ".artwall-editor-plus--columns"
      )
  };

  const HANDLE_SIZE =
    24;

  /*
    4px grid is the positioning unit for all editor handles.
  */
  const snap4 =
    value => (
      Math.round(
        value / 4
      ) * 4
    );

  const resolveGrid =
    () => (
      preview.querySelector(
        ".wall-grid.muuzee-masonry-grid"
      )
    );

  const outsideGrid =
    (
      element,
      grid
    ) => (
      element
      && (
        !grid
        || !grid.contains(
          element
        )
      )
    );

  const usableRect =
    element => {
      if (!element) {
        return null;
      }

      const rect =
        element.getBoundingClientRect();

      if (
        rect.width <= 0
        || rect.height <= 0
      ) {
        return null;
      }

      return rect;
    };

  const discoverIcon =
    grid => {
      const explicit =
        preview.querySelector(
          [
            ".wall-avatar img",
            ".wall-profile img",
            ".artwall-avatar img",
            ".artwall-profile img",
            "[data-artwall-avatar] img",
            "[data-artwall-icon] img"
          ].join(",")
        );

      if (
        explicit
        && outsideGrid(
          explicit,
          grid
        )
      ) {
        return explicit;
      }

      /*
        Fallback:
        first square-ish image outside exhibition grid.
        visibility:hidden is intentionally accepted so icon OFF
        still keeps a positioning anchor.
      */
      const candidates =
        $$(
          "img",
          preview
        )
          .filter(
            image =>
              outsideGrid(
                image,
                grid
              )
          )
          .map(
            image => ({
              image,
              rect:
                usableRect(
                  image
                )
            })
          )
          .filter(
            item =>
              item.rect
          )
          .filter(
            item => {
              const ratio =
                item.rect.width
                / item.rect.height;

              return (
                item.rect.width
                  >= 32
                && item.rect.width
                  <= 160
                && item.rect.height
                  >= 32
                && item.rect.height
                  <= 160
                && ratio >= .7
                && ratio <= 1.35
              );
            }
          );

      return (
        candidates[0]?.image
        || null
      );
    };

  const visualIconBox =
    image => {
      if (!image) {
        return null;
      }

      let node =
        image;

      /*
        Expand to a square-ish avatar wrapper when one exists.
      */
      for (
        let depth = 0;
        depth < 4;
        depth += 1
      ) {
        const parent =
          node.parentElement;

        if (
          !parent
          || parent === preview
        ) {
          break;
        }

        const rect =
          usableRect(
            parent
          );

        if (!rect) {
          break;
        }

        const ratio =
          rect.width
          / rect.height;

        if (
          rect.width >= 32
          && rect.width <= 180
          && rect.height >= 32
          && rect.height <= 180
          && ratio >= .65
          && ratio <= 1.45
        ) {
          node =
            parent;

          continue;
        }

        break;
      }

      return node;
    };

  const discoverTitle =
    grid => {
      const explicit =
        preview.querySelector(
          [
            ".wall-title",
            ".artwall-title",
            "[data-artwall-title]"
          ].join(",")
        );

      if (
        explicit
        && outsideGrid(
          explicit,
          grid
        )
        && usableRect(
          explicit
        )
      ) {
        return explicit;
      }

      /*
        Largest rendered heading outside the exhibition grid.
      */
      const candidates =
        $$(
          "h1,h2,h3,h4,strong,[class*='title']",
          preview
        )
          .filter(
            element =>
              outsideGrid(
                element,
                grid
              )
          )
          .map(
            element => ({
              element,
              rect:
                usableRect(
                  element
                ),
              fontSize:
                parseFloat(
                  getComputedStyle(
                    element
                  ).fontSize
                ) || 0,
              text:
                element
                  .textContent
                  .trim()
            })
          )
          .filter(
            item =>
              item.rect
              && item.text.length >= 2
          )
          .filter(
            item =>
              !/^(EXHIBITIONS|MUSEUMS|ARTISTS|\d+)$/i
                .test(
                  item.text
                )
          )
          .sort(
            (a, b) =>
              b.fontSize
              - a.fontSize
          );

      return (
        candidates[0]?.element
        || null
      );
    };

  const discoverComment =
    grid => {
      const explicit =
        preview.querySelector(
          [
            ".wall-comment",
            ".artwall-comment",
            "[data-artwall-comment]"
          ].join(",")
        );

      if (
        explicit
        && outsideGrid(
          explicit,
          grid
        )
        && usableRect(
          explicit
        )
      ) {
        return explicit;
      }

      const paragraph =
        $$(
          "p",
          preview
        )
          .filter(
            element =>
              outsideGrid(
                element,
                grid
              )
          )
          .find(
            element => (
              usableRect(
                element
              )
              && element
                .textContent
                .trim()
                .length >= 4
            )
          );

      return (
        paragraph
        || null
      );
    };

  const relativeRect =
    element => {
      const rect =
        usableRect(
          element
        );

      if (!rect) {
        return null;
      }

      const canvasRect =
        canvas
          .getBoundingClientRect();

      return {
        left:
          rect.left
          - canvasRect.left,

        top:
          rect.top
          - canvasRect.top,

        width:
          rect.width,

        height:
          rect.height,

        right:
          rect.right
          - canvasRect.left,

        bottom:
          rect.bottom
          - canvasRect.top
      };
    };

  const setPosition =
    (
      handle,
      left,
      top
    ) => {
      if (!handle) {
        return;
      }

      const maxLeft =
        Math.max(
          0,
          canvas.clientWidth
          - HANDLE_SIZE
        );

      const maxTop =
        Math.max(
          0,
          canvas.clientHeight
          - HANDLE_SIZE
        );

      handle.style.setProperty(
        "--artwall-handle-left",
        `${
          snap4(
            Math.max(
              0,
              Math.min(
                maxLeft,
                left
              )
            )
          )
        }px`
      );

      handle.style.setProperty(
        "--artwall-handle-top",
        `${
          snap4(
            Math.max(
              0,
              Math.min(
                maxTop,
                top
              )
            )
          )
        }px`
      );

      handle.dataset
        .artwallHandleResolved =
          "true";
    };

  const unresolved =
    handle => {
      if (!handle) {
        return;
      }

      handle.dataset
        .artwallHandleResolved =
          "false";
    };

  const positionHandles =
    reason => {
      const grid =
        resolveGrid();

      const icon =
        visualIconBox(
          discoverIcon(
            grid
          )
        );

      const title =
        discoverTitle(
          grid
        );

      const comment =
        discoverComment(
          grid
        );

      const iconRect =
        relativeRect(
          icon
        );

      const titleRect =
        relativeRect(
          title
        );

      const commentRect =
        relativeRect(
          comment
        );

      const gridRect =
        relativeRect(
          grid
        );

      const previewRect =
        relativeRect(
          preview
        );

      /*
        Same 4px-grid relationship for content handles:
        16px outward leaves 8px overlap on a 24px handle,
        keeping the content visible while preserving visual association.
      */
      const OUTSET =
        16;

      if (iconRect) {
        setPosition(
          handles.icon,
          iconRect.left
            - OUTSET,
          iconRect.top
            - OUTSET
        );
      } else {
        unresolved(
          handles.icon
        );
      }

      if (titleRect) {
        setPosition(
          handles.title,
          titleRect.left
            - OUTSET,
          titleRect.top
            - OUTSET
        );
      } else {
        unresolved(
          handles.title
        );
      }

      if (commentRect) {
        setPosition(
          handles.comment,
          commentRect.left
            - OUTSET,
          commentRect.top
            - OUTSET
        );
      } else {
        unresolved(
          handles.comment
        );
      }

      if (gridRect) {
        /*
          Exhibition reorder:
          top-left of current rendered image grid.
        */
        setPosition(
          handles.items,
          gridRect.left
            - OUTSET,
          gridRect.top
            - OUTSET
        );

        /*
          Columns:
          same Y grid line, mirrored at grid top-right.
          24px handle with 16px outward = right edge +16px.
        */
        setPosition(
          handles.columns,
          gridRect.right
            - (
              HANDLE_SIZE
              - OUTSET
            ),
          gridRect.top
            - OUTSET
        );
      } else {
        unresolved(
          handles.items
        );

        unresolved(
          handles.columns
        );
      }

      if (previewRect) {
        /*
          Background stays inside the ArtWall frame,
          16px from top/right.
        */
        setPosition(
          handles.background,
          previewRect.right
            - HANDLE_SIZE
            - 16,
          previewRect.top
            + 16
        );
      } else {
        unresolved(
          handles.background
        );
      }

      document.documentElement
        .dataset
        .artwallHandleLayout =
          "ready";

      window.dispatchEvent(
        new CustomEvent(
          "muuzee:artwall-editor-layout-synced",
          {
            detail:{
              reason
            }
          }
        )
      );
    };

  /*
    Layout pipeline:
    DOM update -> first frame -> browser layout -> second frame -> position.
  */
  let firstFrame =
    0;

  let secondFrame =
    0;

  let fallbackTimer =
    0;

  const schedulePosition =
    (
      reason = "unknown",
      withFallback = false
    ) => {
      if (firstFrame) {
        cancelAnimationFrame(
          firstFrame
        );
      }

      if (secondFrame) {
        cancelAnimationFrame(
          secondFrame
        );
      }

      firstFrame =
        requestAnimationFrame(
          () => {
            firstFrame =
              0;

            secondFrame =
              requestAnimationFrame(
                () => {
                  secondFrame =
                    0;

                  positionHandles(
                    reason
                  );
                }
              );
          }
        );

      /*
        Async image/Masonry work can finish after the two frames.
        Use one delayed verification pass only for redraw events.
      */
      if (withFallback) {
        window.clearTimeout(
          fallbackTimer
        );

        fallbackTimer =
          window.setTimeout(
            () => {
              positionHandles(
                `${reason}:settled`
              );
            },
            140
          );
      }
    };

  /*
    ResizeObserver is geometry-only.
    It never modifies ArtWall/Masonry content and therefore
    cannot create the previous redraw feedback loop.
  */
  const resizeObserver =
    new ResizeObserver(
      () => {
        schedulePosition(
          "resize-observer"
        );
      }
    );

  const refreshObservedTargets =
    () => {
      resizeObserver.disconnect();

      const grid =
        resolveGrid();

      const targets = [
        canvas,
        preview,
        grid,
        visualIconBox(
          discoverIcon(
            grid
          )
        ),
        discoverTitle(
          grid
        ),
        discoverComment(
          grid
        )
      ].filter(Boolean);

      for (
        const target
        of new Set(
          targets
        )
      ) {
        resizeObserver.observe(
          target
        );
      }
    };

  const redrawEvents = [
    "muuzee:artwall-grid-changed",
    "muuzee:artwall-change",
    "muuzee:personal-change"
  ];

  for (
    const eventName
    of redrawEvents
  ) {
    window.addEventListener(
      eventName,
      () => {
        refreshObservedTargets();

        schedulePosition(
          eventName,
          true
        );
      }
    );
  }

  /*
    Explicitly listen on the grid as well because grid-changed bubbles.
  */
  preview.addEventListener(
    "muuzee:artwall-grid-changed",
    () => {
      refreshObservedTargets();

      schedulePosition(
        "grid-changed",
        true
      );
    }
  );

  let resizeTimer =
    0;

  window.addEventListener(
    "resize",
    () => {
      window.clearTimeout(
        resizeTimer
      );

      resizeTimer =
        window.setTimeout(
          () => {
            refreshObservedTargets();

            schedulePosition(
              "window-resize"
            );
          },
          80
        );
    }
  );

  /*
    Image loads can change Masonry height.
  */
  const bindImageLoadChecks =
    () => {
      $$(
        "img",
        preview
      ).forEach(
        image => {
          if (
            image.dataset
              .artwallHandleLoadBound
          ) {
            return;
          }

          image.dataset
            .artwallHandleLoadBound =
              "true";

          if (
            !image.complete
          ) {
            image.addEventListener(
              "load",
              () => {
                refreshObservedTargets();

                schedulePosition(
                  "image-load",
                  true
                );
              },
              {
                once:true
              }
            );
          }
        }
      );
    };

  /*
    When the reorder popup or column module redraws the grid,
    new <img> elements may be appended.
    The explicit grid-changed event re-runs this binding.
  */
  preview.addEventListener(
    "muuzee:artwall-grid-changed",
    bindImageLoadChecks
  );

  window.addEventListener(
    "load",
    () => {
      refreshObservedTargets();
      bindImageLoadChecks();

      schedulePosition(
        "window-load",
        true
      );
    },
    {
      once:true
    }
  );

  if (
    document.fonts?.ready
  ) {
    document.fonts.ready.then(
      () => {
        refreshObservedTargets();

        schedulePosition(
          "fonts-ready",
          true
        );
      }
    );
  }

  /*
    Initial sync after all defer scripts have executed.
  */
  refreshObservedTargets();
  bindImageLoadChecks();

  schedulePosition(
    "initial",
    true
  );

  document.documentElement
    .dataset
    .artwallLayoutSyncModule =
      "v20260907-35";

  console.info(
    "[Muuzee ArtWall Layout Sync v20260907-35]",
    {
      mode:
        "post-render-relative-handles",
      grid:
        !!resolveGrid()
    }
  );
})();
