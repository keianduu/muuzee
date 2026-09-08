/*
  Muuzee ArtWall Edit — iOS focus zoom guard

  Purpose:
  Prevent Safari's automatic input-focus zoom without changing the
  Design Guide font scale.

  The viewport restriction exists only while a form control is focused
  and is restored immediately afterwards.
*/
(() => {
  "use strict";

  const viewport =
    document.querySelector(
      'meta[name="viewport"]'
    );

  if (!viewport) {
    return;
  }

  const isIOS =
    /iPad|iPhone|iPod/.test(
      navigator.userAgent
    )
    || (
      navigator.platform
        === "MacIntel"
      && navigator.maxTouchPoints
        > 1
    );

  if (!isIOS) {
    return;
  }

  const originalContent =
    viewport.getAttribute(
      "content"
    )
    || "";

  const EDITABLE_SELECTOR =
    [
      'input:not([type="checkbox"])',
      'input:not([type="radio"])',
      "textarea",
      "select"
    ].join(",");

  const contentWithFocusGuard =
    () => {
      const parts =
        originalContent
          .split(",")
          .map(
            value =>
              value.trim()
          )
          .filter(Boolean)
          .filter(
            value =>
              !/^maximum-scale\s*=/i
                .test(
                  value
                )
          );

      parts.push(
        "maximum-scale=1"
      );

      return parts.join(
        ", "
      );
    };

  let guarded =
    false;

  const enable =
    () => {
      if (guarded) {
        return;
      }

      guarded =
        true;

      viewport.setAttribute(
        "content",
        contentWithFocusGuard()
      );
    };

  const disable =
    () => {
      if (!guarded) {
        return;
      }

      guarded =
        false;

      viewport.setAttribute(
        "content",
        originalContent
      );
    };

  document.addEventListener(
    "focusin",
    event => {
      if (
        event.target
          ?.matches?.(
            EDITABLE_SELECTOR
          )
      ) {
        enable();
      }
    },
    true
  );

  document.addEventListener(
    "focusout",
    () => {
      /*
        Let focus transfer to another field first.
        If another editable field receives focus, focusin re-enables it.
      */
      setTimeout(
        () => {
          const active =
            document.activeElement;

          if (
            !active
            || !active.matches?.(
              EDITABLE_SELECTOR
            )
          ) {
            disable();
          }
        },
        0
      );
    },
    true
  );

  window.addEventListener(
    "pagehide",
    disable
  );

  window.addEventListener(
    "pageshow",
    () => {
      const active =
        document.activeElement;

      if (
        !active
        || !active.matches?.(
          EDITABLE_SELECTOR
        )
      ) {
        disable();
      }
    }
  );

  document.documentElement
    .dataset
    .artwallFocusZoom =
      "v20260908-01";
})();
