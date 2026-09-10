/*
  Muuzee My Art — ArtWall PNG preview

  Export policy:
  - production/local-server HTTP(S) only
  - warm existing ArtWall thumbnail URLs before first tap
  - no cache busting
  - no placeholder images
  - never generate a partial ArtWall
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

  if(
    !button
    || !artwall
    || !dialog
    || !preview
  ){
    return;
  }

  const PIXEL_RATIO =
    4;

  const IMAGE_WAIT_TIMEOUT =
    8000;

  const warmPromises =
    new Map();

  let generatedCache = {
    signature:"",
    dataUrl:""
  };

  const getImages =
    () =>
      Array.from(
        artwall.querySelectorAll(
          "img"
        )
      );

  const getImageSrc =
    image =>
      image.currentSrc
      || image.src
      || image.getAttribute(
        "src"
      )
      || "";

  const warmImage =
    src => {
      if(!src){
        return Promise.resolve(
          false
        );
      }

      if(
        warmPromises.has(
          src
        )
      ){
        return warmPromises.get(
          src
        );
      }

      const promise =
        new Promise(
          resolve => {
            const image =
              new Image();

            let finished =
              false;

            const finish =
              success => {
                if(finished){
                  return;
                }

                finished =
                  true;

                clearTimeout(
                  timer
                );

                image.onload =
                  null;

                image.onerror =
                  null;

                resolve(
                  success
                );
              };

            const timer =
              setTimeout(
                () =>
                  finish(
                    false
                  ),
                IMAGE_WAIT_TIMEOUT
              );

            image.decoding =
              "async";

            try {
              image.fetchPriority =
                "low";
            } catch(_){
              // Optional browser hint.
            }

            image.onload =
              () =>
                finish(
                  true
                );

            image.onerror =
              () =>
                finish(
                  false
                );

            image.src =
              src;
          }
        );

      warmPromises.set(
        src,
        promise
      );

      return promise;
    };

  const warmArtWall =
    async () => {
      const sources =
        Array.from(
          new Set(
            getImages()
              .map(
                getImageSrc
              )
              .filter(Boolean)
          )
        );

      if(!sources.length){
        return;
      }

      await Promise.all(
        sources.map(
          warmImage
        )
      );
    };

  const waitForImage =
    image =>
      new Promise(
        resolve => {
          if(
            image.complete
            && image.naturalWidth > 0
          ){
            resolve(
              true
            );

            return;
          }

          try {
            image.loading =
              "eager";

            image.fetchPriority =
              "high";
          } catch(_){
            // Optional browser hint.
          }

          let finished =
            false;

          const finish =
            success => {
              if(finished){
                return;
              }

              finished =
                true;

              clearTimeout(
                timer
              );

              image.removeEventListener(
                "load",
                loaded
              );

              image.removeEventListener(
                "error",
                failed
              );

              resolve(
                success
              );
            };

          const loaded =
            () =>
              finish(
                image.naturalWidth > 0
              );

          const failed =
            () =>
              finish(
                false
              );

          const timer =
            setTimeout(
              () =>
                finish(
                  image.complete
                  && image.naturalWidth > 0
                ),
              IMAGE_WAIT_TIMEOUT
            );

          image.addEventListener(
            "load",
            loaded,
            {
              once:true
            }
          );

          image.addEventListener(
            "error",
            failed,
            {
              once:true
            }
          );
        }
      );

  const ensureAllImagesReady =
    async () => {
      const images =
        getImages();

      /*
        Trigger cache warming and DOM-image loading in parallel.
      */
      const [
        _warm,
        results
      ] =
        await Promise.all([
          warmArtWall(),
          Promise.all(
            images.map(
              waitForImage
            )
          )
        ]);

      const failed =
        images.filter(
          (
            image,
            index
          ) =>
            !results[index]
            || image.naturalWidth <= 0
        );

      if(failed.length){
        console.error(
          "[Muuzee ArtWall Export] images not ready",
          failed.map(
            image =>
              getImageSrc(
                image
              )
          )
        );

        throw new Error(
          `${failed.length} ArtWall image(s) are not ready`
        );
      }
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

  const getSignature =
    () => {
      const rect =
        artwall
          .getBoundingClientRect();

      return [
        Math.round(
          rect.width
        ),
        Math.round(
          rect.height
        ),
        artwall.innerHTML
      ].join(
        "|"
      );
    };

  const invalidateCache =
    () => {
      generatedCache = {
        signature:"",
        dataUrl:""
      };
    };

  const openPreview =
    dataUrl => {
      preview.src =
        dataUrl;

      dialog.showModal();
    };

  const closePreview =
    () => {
      if(dialog.open){
        dialog.close();
      }
    };

  closeButtons.forEach(
    button => {
      button.addEventListener(
        "click",
        closePreview
      );
    }
  );

  dialog.addEventListener(
    "click",
    event => {
      if(
        event.target
        === dialog
      ){
        closePreview();
      }
    }
  );

  const scheduleWarmup =
    delay => {
      const run =
        () => {
          warmArtWall()
            .catch(
              () => {}
            );
        };

      if(
        "requestIdleCallback"
        in window
      ){
        window.requestIdleCallback(
          run,
          {
            timeout:
              delay
          }
        );
      } else {
        setTimeout(
          run,
          Math.min(
            delay,
            1000
          )
        );
      }
    };

  /*
    ArtWall masonry can finish shortly after this controller initializes.
    Two warmup passes cover both immediate and late-created image nodes
    without adding a permanent DOM observer.
  */
  scheduleWarmup(
    800
  );

  setTimeout(
    () =>
      warmArtWall()
        .catch(
          () => {}
        ),
    1800
  );

  window.addEventListener(
    "resize",
    invalidateCache
  );

  window.addEventListener(
    "muuzee:artwall-store-change",
    () => {
      invalidateCache();

      scheduleWarmup(
        400
      );
    }
  );

  button.addEventListener(
    "click",
    async event => {
      event.preventDefault();
      event.stopPropagation();

      /*
        file:// is intentionally unsupported for this Web/PWA export path.
        Validate locally through localhost so browser origin/cache behavior
        matches GitHub Pages and production.
      */
      if(
        location.protocol
        === "file:"
      ){
        window.alert(
          "画像生成はlocalhostまたは公開URLで確認してください。file://ではブラウザの画像取得制限により正しく生成できません。"
        );

        return;
      }

      if(
        !window.htmlToImage
        || typeof window.htmlToImage
          .toPng
          !== "function"
      ){
        window.alert(
          "画像生成機能を読み込めませんでした。再読み込みしてお試しください。"
        );

        return;
      }

      const signature =
        getSignature();

      if(
        generatedCache.dataUrl
        && generatedCache.signature
          === signature
      ){
        openPreview(
          generatedCache.dataUrl
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

      if(label){
        label.textContent =
          "画像準備中…";
      }

      try {
        if(
          document.fonts
            ?.ready
        ){
          await document.fonts.ready;
        }

        await ensureAllImagesReady();

        await waitForLayout();

        if(label){
          label.textContent =
            "画像生成中…";
        }

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
                  false,

                skipAutoScale:
                  false
              }
            );

        generatedCache = {
          signature:
            getSignature(),
          dataUrl
        };

        openPreview(
          dataUrl
        );
      } catch(error) {
        console.error(
          "[Muuzee ArtWall Export]",
          error
        );

        window.alert(
          "一部の展示会画像を準備できませんでした。画像の読み込み完了後にもう一度お試しください。"
        );
      } finally {
        button.disabled =
          false;

        if(label){
          label.textContent =
            originalLabel;
        }
      }
    },
    true
  );
})();
