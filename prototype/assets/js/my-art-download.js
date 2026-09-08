/*
  Muuzee My Art — ArtWall PNG download

  Export engine:
    html-to-image 1.11.13

  Goal:
    reproduce the browser-rendered ArtWall as faithfully as possible.
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

  if (
    !button
    || !artwall
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
                  const finish =
                    () => resolve();

                  image.addEventListener(
                    "load",
                    finish,
                    {
                      once:true
                    }
                  );

                  image.addEventListener(
                    "error",
                    finish,
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

  const fileName =
    () => {
      const now =
        new Date();

      const y =
        now.getFullYear();

      const m =
        String(
          now.getMonth() + 1
        )
          .padStart(
            2,
            "0"
          );

      const d =
        String(
          now.getDate()
        )
          .padStart(
            2,
            "0"
          );

      return (
        `muuzee-artwall-${y}${m}${d}.png`
      );
    };

  const download =
    dataUrl => {
      const link =
        document.createElement(
          "a"
        );

      link.href =
        dataUrl;

      link.download =
        fileName();

      link.style.display =
        "none";

      document.body
        .appendChild(
          link
        );

      link.click();
      link.remove();
    };

  button.addEventListener(
    "click",
    async () => {
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
          await document.fonts
            .ready;
        }

        await waitForImages(
          artwall
        );

        await waitForLayout();

        const rect =
          artwall
            .getBoundingClientRect();

        const width =
          Math.ceil(
            rect.width
          );

        const height =
          Math.ceil(
            rect.height
          );

        const dataUrl =
          await window.htmlToImage
            .toPng(
              artwall,
              {
                width,
                height,
                pixelRatio:
                  PIXEL_RATIO,
                cacheBust:true,
                skipAutoScale:false
              }
            );

        download(
          dataUrl
        );
      } catch (error) {
        console.error(
          "[Muuzee ArtWall Download]",
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
    }
  );
})();
