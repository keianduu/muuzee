/*
  Muuzee ArtWall Edit — drag auto-scroll
  Page-specific enhancement for the exhibition reorder popup.

  Existing artwall-edit-reorder.js remains the owner of:
  - drag start / finish
  - pointer capture
  - order persistence
  - ArtWall synchronization

  This module only:
  - detects an active reorder handle
  - auto-scrolls the dialog near its visible top / bottom edge
  - moves the existing placeholder as new rows enter the viewport
*/
(() => {
  "use strict";

  const HANDLE_SELECTOR =
    ".artwall-reorder-handle-v2";

  const DIALOG_SELECTOR =
    ".artwall-reorder-dialog";

  const LIST_SELECTOR =
    "[data-artwall-reorder-list-v2]";

  const ROW_SELECTOR =
    ".artwall-reorder-row-v2";

  const PLACEHOLDER_SELECTOR =
    ".artwall-reorder-placeholder-v2";

  const HEAD_SELECTOR =
    ".artwall-reorder-dialog-head";

  const ACTIONS_SELECTOR =
    ".artwall-reorder-dialog-actions";

  const EDGE_PX =
    72;

  const MAX_SPEED =
    18;

  let active =
    null;

  let frame =
    0;

  const clamp =
    (value, min, max) =>
      Math.min(
        max,
        Math.max(
          min,
          value
        )
      );

  const stop =
    () => {
      if (frame) {
        cancelAnimationFrame(
          frame
        );

        frame =
          0;
      }

      active =
        null;
    };

  const visibleBounds =
    dialog => {
      const dialogRect =
        dialog
          .getBoundingClientRect();

      const head =
        dialog.querySelector(
          HEAD_SELECTOR
        );

      const actions =
        dialog.querySelector(
          ACTIONS_SELECTOR
        );

      const headRect =
        head
          ?.getBoundingClientRect();

      const actionsRect =
        actions
          ?.getBoundingClientRect();

      const top =
        Math.max(
          dialogRect.top,
          headRect?.bottom
            ?? dialogRect.top
        );

      const bottom =
        Math.min(
          dialogRect.bottom,
          actionsRect?.top
            ?? dialogRect.bottom
        );

      return {
        top,
        bottom
      };
    };

  const scrollSpeed =
    (
      pointerY,
      top,
      bottom
    ) => {
      const usable =
        Math.max(
          0,
          bottom - top
        );

      if (!usable) {
        return 0;
      }

      const edge =
        Math.min(
          EDGE_PX,
          Math.max(
            40,
            usable * 0.24
          )
        );

      if (
        pointerY
        < top + edge
      ) {
        const strength =
          clamp(
            (
              top + edge
              - pointerY
            ) / edge,
            0,
            1
          );

        return (
          -MAX_SPEED
          * strength
        );
      }

      if (
        pointerY
        > bottom - edge
      ) {
        const strength =
          clamp(
            (
              pointerY
              - (
                bottom - edge
              )
            ) / edge,
            0,
            1
          );

        return (
          MAX_SPEED
          * strength
        );
      }

      return 0;
    };

  const advancePlaceholder =
    (
      list,
      pointerY,
      top,
      bottom
    ) => {
      const placeholder =
        list.querySelector(
          `:scope > ${PLACEHOLDER_SELECTOR}`
        );

      if (!placeholder) {
        return;
      }

      const rows =
        Array.from(
          list.children
        )
          .filter(
            node =>
              node.matches?.(
                ROW_SELECTOR
              )
          );

      if (!rows.length) {
        return;
      }

      const visibleRows =
        rows.filter(
          row => {
            const rect =
              row
                .getBoundingClientRect();

            return (
              rect.bottom
                >= top
              && rect.top
                <= bottom
            );
          }
        );

      const candidates =
        visibleRows.length
          ? visibleRows
          : rows;

      let target =
        null;

      let bestDistance =
        Infinity;

      for (
        const row
        of candidates
      ) {
        const rect =
          row
            .getBoundingClientRect();

        const middle =
          rect.top
          + rect.height / 2;

        const distance =
          Math.abs(
            pointerY
            - middle
          );

        if (
          distance
          < bestDistance
        ) {
          bestDistance =
            distance;

          target =
            row;
        }
      }

      if (!target) {
        return;
      }

      const rect =
        target
          .getBoundingClientRect();

      const before =
        pointerY
        < rect.top
          + rect.height / 2;

      if (before) {
        if (
          target
            .previousElementSibling
          !== placeholder
        ) {
          target.before(
            placeholder
          );
        }
      } else if (
        target
          .nextElementSibling
        !== placeholder
      ) {
        target.after(
          placeholder
        );
      }
    };

  const tick =
    () => {
      frame =
        0;

      if (!active) {
        return;
      }

      const {
        dialog,
        list,
        pointerY
      } = active;

      if (
        !document.contains(
          dialog
        )
        || !document.contains(
          list
        )
      ) {
        stop();
        return;
      }

      const {
        top,
        bottom
      } =
        visibleBounds(
          dialog
        );

      const speed =
        scrollSpeed(
          pointerY,
          top,
          bottom
        );

      if (speed) {
        dialog.scrollTop +=
          speed;

        /*
          Scrolling changes every row's client rect even if the finger
          stays still, so advance the placeholder on every animation frame.
        */
        advancePlaceholder(
          list,
          pointerY,
          top,
          bottom
        );
      }

      frame =
        requestAnimationFrame(
          tick
        );
    };

  document.addEventListener(
    "pointerdown",
    event => {
      const handle =
        event.target
          ?.closest?.(
            HANDLE_SELECTOR
          );

      if (!handle) {
        return;
      }

      const dialog =
        handle.closest(
          DIALOG_SELECTOR
        );

      const list =
        dialog
          ?.querySelector(
            LIST_SELECTOR
          );

      if (
        !dialog
        || !list
      ) {
        return;
      }

      active = {
        pointerId:
          event.pointerId,
        dialog,
        list,
        pointerX:
          event.clientX,
        pointerY:
          event.clientY
      };

      if (!frame) {
        frame =
          requestAnimationFrame(
            tick
          );
      }
    },
    true
  );

  document.addEventListener(
    "pointermove",
    event => {
      if (
        !active
        || event.pointerId
          !== active.pointerId
      ) {
        return;
      }

      active.pointerX =
        event.clientX;

      active.pointerY =
        event.clientY;
    },
    true
  );

  const finish =
    event => {
      if (
        active
        && event.pointerId
          === active.pointerId
      ) {
        stop();
      }
    };

  document.addEventListener(
    "pointerup",
    finish,
    true
  );

  document.addEventListener(
    "pointercancel",
    finish,
    true
  );

  document.documentElement
    .dataset
    .artwallDragAutoscroll =
      "v20260907-01";
})();
