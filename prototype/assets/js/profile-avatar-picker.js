/*
  Muuzee Profile Avatar Picker

  Responsibilities:
  - open/close the shared avatar picker
  - render all configured preset items
  - keep preset membership independent from image load success
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
            "async";

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

  const openPicker =
    () => {
      if (
        !dialog.open
      ) {
        dialog.showModal();
      }

      renderPresets();
      syncVisibleLayout();
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
      "v20260912-preset-config-01";
})();
