/*
  Muuzee My Art — ArtWall image preview only

  Button tap:
    ArtWall -> PNG -> Preview dialog

  No native share-sheet call.
  No automatic file download.
*/
(() => {
  "use strict";

  const button =
    document.querySelector(
      "[data-artwall-download]"
    );

  const artwall =
    document.querySelector(
      ".artwall"
    );

  const dialog =
    document.querySelector(
      "[data-artwall-image-preview-dialog]"
    );

  const preview =
    document.querySelector(
      "[data-artwall-image-preview]"
    );

  const closeButtons =
    document.querySelectorAll(
      "[data-artwall-image-preview-close]"
    );

  if (
    !button
    || !artwall
    || !dialog
    || !preview
  ) {
    return;
  }

  const PIXEL_RATIO =
    4;

  const waitForImages =
    async root => {
      const images =
        Array.from(
          root.querySelectorAll(
            "img"
          )
        );

      await Promise.all(
        images.map(
          async image => {
            if (
              image.complete
              && image.naturalWidth
            ) {
              return;
            }

            try {
              await image.decode();
            } catch (_) {
              await new Promise(
                resolve => {
                  const done =
                    () => resolve();

                  image.addEventListener(
                    "load",
                    done,
                    {
                      once:true
                    }
                  );

                  image.addEventListener(
                    "error",
                    done,
                    {
                      once:true
                    }
                  );
                }
              );
            }
          }
        )
      );
    };

  const waitForLayout =
    () =>
      new Promise(
        resolve => {
          requestAnimationFrame(
            () => {
              requestAnimationFrame(
                resolve
              );
            }
          );
        }
      );

  const openPreview =
    dataUrl => {
      preview.src =
        dataUrl;

      dialog.showModal();
    };

  const closePreview =
    () => {
      if (
        dialog.open
      ) {
        dialog.close();
      }
    };

  closeButtons
    .forEach(
      control => {
        control.addEventListener(
          "click",
          closePreview
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
        closePreview();
      }
    }
  );

  button.addEventListener(
    "click",
    async event => {
      event.preventDefault();
      event.stopPropagation();

      if (
        !window.htmlToImage
        || typeof window.htmlToImage
          .toPng
          !== "function"
      ) {
        window.alert(
          "画像生成機能を読み込めませんでした。再読み込みしてお試しください。"
        );

        return;
      }

      const label =
        button.querySelector(
          "span"
        );

      const originalLabel =
        label?.textContent
        || "画像DL";

      button.disabled =
        true;

      if (label) {
        label.textContent =
          "生成中…";
      }

      try {
        if (
          document.fonts
            ?.ready
        ) {
          await document.fonts.ready;
        }

        await waitForImages(
          artwall
        );

        await waitForLayout();

        const rect =
          artwall
            .getBoundingClientRect();

        const dataUrl =
          await window.htmlToImage
            .toPng(
              artwall,
              {
                width:
                  Math.ceil(
                    rect.width
                  ),

                height:
                  Math.ceil(
                    rect.height
                  ),

                pixelRatio:
                  PIXEL_RATIO,

                cacheBust:
                  true,

                skipAutoScale:
                  false
              }
            );

        openPreview(
          dataUrl
        );
      } catch (error) {
        console.error(
          "[Muuzee ArtWall Preview]",
          error
        );

        window.alert(
          "ArtWall画像を生成できませんでした。再読み込みしてお試しください。"
        );
      } finally {
        button.disabled =
          false;

        if (label) {
          label.textContent =
            originalLabel;
        }
      }
    },
    true
  );
})();
