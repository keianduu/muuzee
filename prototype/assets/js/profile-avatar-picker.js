/*
  Muuzee Profile Avatar Picker

  Responsibilities:
  - open/close the avatar picker
  - render every configured preset
  - preload/decode preset images independently from scroll visibility
  - forward preset selection to profile-settings.js
  - open native file chooser only from the upload CTA

  Preset data lives in profile-avatar-presets.js.
*/
(() => {
  "use strict";

  const trigger =
    document.querySelector(
      "[data-avatar-button]"
    );

  const fileInput =
    document.querySelector(
      "[data-avatar-input]"
    );

  const dialog =
    document.querySelector(
      "[data-profile-avatar-picker]"
    );

  const uploadButton =
    dialog?.querySelector(
      "[data-profile-avatar-picker-upload]"
    );

  const grid =
    dialog?.querySelector(
      "[data-profile-avatar-preset-grid]"
    );

  const scroll =
    dialog?.querySelector(
      "[data-profile-avatar-preset-scroll]"
    );

  const closeButtons =
    dialog?.querySelectorAll(
      "[data-profile-avatar-picker-close]"
    )
    || [];

  if (
    !trigger
    || !fileInput
    || !dialog
    || !uploadButton
    || !grid
    || !scroll
  ) {
    return;
  }

  const presets =
    Array.isArray(
      window.MuuzeeProfileAvatarPresets
    )
      ? window.MuuzeeProfileAvatarPresets
      : [];

  let rendered =
    false;

  const presetReady =
    new Map();

  const preloadPreset =
    preset => {
      const src =
        String(
          preset?.src
          || ""
        );

      if (!src) {
        return Promise.resolve(
          false
        );
      }

      if (
        presetReady.has(
          src
        )
      ) {
        return presetReady.get(
          src
        );
      }

      const promise =
        new Promise(
          resolve => {
            const image =
              new Image();

            try {
              image.fetchPriority =
                "high";
            } catch (_) {}

            image.decoding =
              "async";

            let settled =
              false;

            const finish =
              async success => {
                if (settled) {
                  return;
                }

                settled =
                  true;

                if (
                  success
                  && typeof image.decode
                    === "function"
                ) {
                  try {
                    await image.decode();
                  } catch (_) {}
                }

                resolve(
                  success
                );
              };

            image.addEventListener(
              "load",
              () => {
                finish(
                  true
                );
              },
              {
                once:true
              }
            );

            image.addEventListener(
              "error",
              () => {
                finish(
                  false
                );
              },
              {
                once:true
              }
            );

            image.src =
              src;

            if (
              image.complete
              && image.naturalWidth > 0
            ) {
              finish(
                true
              );
            }
          }
        );

      presetReady.set(
        src,
        promise
      );

      return promise;
    };

  /*
    30 small WebPs are cheap enough for this dedicated settings page.
    Warm them immediately so first-open rendering does not depend on
    nested-scroll viewport heuristics.
  */
  const presetWarmup =
    Promise.all(
      presets.map(
        preloadPreset
      )
    );

  const syncPressedState =
    () => {
      const preview =
        document.querySelector(
          "[data-avatar-preview]"
        );

      const current =
        preview?.currentSrc
        || preview?.src
        || "";

      grid
        .querySelectorAll(
          "[data-profile-avatar-preset]"
        )
        .forEach(
          button => {
            const source =
              button.dataset
                .presetSrc
              || "";

            let selected =
              false;

            if (
              source
              && current
            ) {
              try {
                selected =
                  new URL(
                    source,
                    document.baseURI
                  ).href
                  === current;
              } catch (_) {
                selected =
                  current.endsWith(
                    source.replace(
                      /^\.\//,
                      "/"
                    )
                  );
              }
            }

            button.setAttribute(
              "aria-pressed",
              selected
                ? "true"
                : "false"
            );
          }
        );
    };

  const renderPresets =
    () => {
      if (rendered) {
        syncPressedState();
        return;
      }

      const fragment =
        document.createDocumentFragment();

      presets.forEach(
        (
          preset,
          index
        ) => {
          const button =
            document.createElement(
              "button"
            );

          button.type =
            "button";

          button.className =
            "profile-avatar-preset";

          button.dataset
            .profileAvatarPreset =
              String(
                preset.id
                || index + 1
              );

          button.dataset
            .presetSrc =
              String(
                preset.src
                || ""
              );

          button.setAttribute(
            "aria-label",
            `サンプルアイコン ${index + 1}`
          );

          button.setAttribute(
            "aria-pressed",
            "false"
          );

          const image =
            document.createElement(
              "img"
            );

          image.src =
            String(
              preset.src
              || ""
            );

          image.alt =
            "";

          image.loading =
            "eager";

          image.decoding =
            "sync";

          try {
            image.fetchPriority =
              "high";
          } catch (_) {}

          image.addEventListener(
            "load",
            () => {
              button.classList.add(
                "is-image-loaded"
              );
            },
            {
              once:true
            }
          );

          image.addEventListener(
            "error",
            () => {
              button.classList.add(
                "is-image-error"
              );

              button.title =
                "画像を読み込めませんでした";
            },
            {
              once:true
            }
          );

          if (
            image.complete
            && image.naturalWidth > 0
          ) {
            button.classList.add(
              "is-image-loaded"
            );
          }

          button.appendChild(
            image
          );

          button.addEventListener(
            "click",
            () => {
              if (
                !preset?.src
              ) {
                return;
              }

              window.dispatchEvent(
                new CustomEvent(
                  "muuzee:profile-avatar-select",
                  {
                    detail:{
                      id:
                        String(
                          preset.id
                          || ""
                        ),
                      src:
                        String(
                          preset.src
                        )
                    }
                  }
                )
              );

              grid
                .querySelectorAll(
                  "[data-profile-avatar-preset]"
                )
                .forEach(
                  item => {
                    item.setAttribute(
                      "aria-pressed",
                      item === button
                        ? "true"
                        : "false"
                    );
                  }
                );

              if (
                dialog.open
              ) {
                dialog.close();
              }
            }
          );

          fragment.appendChild(
            button
          );
        }
      );

      grid.replaceChildren(
        fragment
      );

      rendered =
        true;

      syncPressedState();
    };

  const syncScrollHeight =
    () => {
      const first =
        grid.querySelector(
          ".profile-avatar-preset"
        );

      if (!first) {
        return;
      }

      const rowHeight =
        first
          .getBoundingClientRect()
          .height;

      const rowGap =
        parseFloat(
          getComputedStyle(
            grid
          ).rowGap
        )
        || 0;

      if (!rowHeight) {
        return;
      }

      scroll.style.maxHeight =
        `${Math.ceil(
          rowHeight * 4.35
          + rowGap * 4
        )}px`;
    };

  const syncVisibleLayout =
    () => {
      requestAnimationFrame(
        () => {
          requestAnimationFrame(
            syncScrollHeight
          );
        }
      );
    };

  const refreshDecodedPresetPaint =
    () => {
      grid
        .querySelectorAll(
          ".profile-avatar-preset img"
        )
        .forEach(
          image => {
            if (
              image.complete
              && image.naturalWidth > 0
            ) {
              image
                .closest(
                  ".profile-avatar-preset"
                )
                ?.classList
                .add(
                  "is-image-loaded"
                );
            }
          }
        );

      void grid.offsetHeight;

      grid.classList.add(
        "is-preset-ready"
      );

      syncVisibleLayout();
    };

  const openPicker =
    () => {
      renderPresets();

      if (
        !dialog.open
      ) {
        dialog.showModal();
      }

      syncVisibleLayout();

      presetWarmup
        .finally(
          refreshDecodedPresetPaint
        );
    };

  const closePicker =
    () => {
      if (
        dialog.open
      ) {
        dialog.close();
      }
    };

  trigger.addEventListener(
    "click",
    event => {
      event.preventDefault();
      openPicker();
    }
  );

  uploadButton.addEventListener(
    "click",
    event => {
      event.preventDefault();
      fileInput.click();
    }
  );

  fileInput.addEventListener(
    "change",
    () => {
      if (
        fileInput.files
        && fileInput.files.length
      ) {
        closePicker();
      }
    }
  );

  closeButtons.forEach(
    button => {
      button.addEventListener(
        "click",
        closePicker
      );
    }
  );

  dialog.addEventListener(
    "click",
    event => {
      if (
        event.target
        === dialog
      ) {
        closePicker();
      }
    }
  );

  dialog.addEventListener(
    "close",
    () => {
      scroll.scrollTop =
        0;
    }
  );

  window.addEventListener(
    "resize",
    () => {
      if (
        dialog.open
      ) {
        syncVisibleLayout();
      }
    }
  );

  document.documentElement
    .dataset
    .profileAvatarPicker =
      "v20260912-avatar-render-deletefix-01";
})();
