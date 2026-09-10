/*
  Muuzee My Art — ArtWall PNG export

  Readiness:
  - My Art renders the ArtWall once.
  - Export readiness includes every image inside .artwall:
      profile avatar + exhibition images.
  - Loaded images are converted to export-safe Data URLs before CTA enable.
  - User tap performs rasterization only.
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

  const READY_TIMEOUT =
    15000;

  const label =
    button.querySelector(
      "span"
    );

  const normalLabel =
    "画像DL";

  let ready =
    false;

  let prepareToken =
    0;

  let preparedImages =
    new Map();

  let generatedCache = {
    signature:"",
    dataUrl:""
  };

  const setReady =
    value => {
      ready =
        value === true;

      button.disabled =
        !ready;

      button.setAttribute(
        "aria-disabled",
        ready
          ? "false"
          : "true"
      );

      if(label){
        label.textContent =
          ready
            ? normalLabel
            : "画像準備中…";
      }
    };

  setReady(
    false
  );

  const allImages =
    () =>
      Array.from(
        artwall.querySelectorAll(
          "img"
        )
      );

  const imageKey =
    image =>
      image.currentSrc
      || image.src
      || image.getAttribute(
        "src"
      )
      || "";

  const waitForImage =
    (
      image,
      token
    ) =>
      new Promise(
        resolve => {
          if(
            token
            !== prepareToken
          ){
            resolve(
              false
            );

            return;
          }

          if(
            image.complete
            && image.naturalWidth > 0
          ){
            resolve(
              true
            );

            return;
          }

          let settled =
            false;

          const finish =
            success => {
              if(settled){
                return;
              }

              settled =
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
                && token
                  === prepareToken
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
              READY_TIMEOUT
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

  const imageToDataUrl =
    image => {
      const key =
        imageKey(
          image
        );

      if(
        key.startsWith(
          "data:"
        )
      ){
        return key;
      }

      const canvas =
        document.createElement(
          "canvas"
        );

      canvas.width =
        image.naturalWidth;

      canvas.height =
        image.naturalHeight;

      const context =
        canvas.getContext(
          "2d"
        );

      if(!context){
        throw new Error(
          "Canvas context unavailable"
        );
      }

      context.drawImage(
        image,
        0,
        0
      );

      return canvas.toDataURL(
        "image/jpeg",
        .92
      );
    };

  const waitForDomReady =
    () => {
      if(
        document.readyState
        !== "loading"
      ){
        return Promise.resolve();
      }

      return new Promise(
        resolve => {
          document.addEventListener(
            "DOMContentLoaded",
            resolve,
            {
              once:true
            }
          );
        }
      );
    };

  const prepareExport =
    async () => {
      const token =
        ++prepareToken;

      setReady(
        false
      );

      preparedImages =
        new Map();

      try {
        await waitForDomReady();

        if(
          window.MuuzeeArtWallReady
          && typeof window
            .MuuzeeArtWallReady
            .then
            === "function"
        ){
          await window
            .MuuzeeArtWallReady;
        }

        if(
          token
          !== prepareToken
        ){
          return;
        }

        const images =
          allImages();

        if(!images.length){
          throw new Error(
            "ArtWall has no images"
          );
        }

        const results =
          await Promise.all(
            images.map(
              image =>
                waitForImage(
                  image,
                  token
                )
            )
          );

        if(
          token
          !== prepareToken
        ){
          return;
        }

        if(
          results.some(
            value =>
              !value
          )
        ){
          throw new Error(
            "ArtWall image readiness failed"
          );
        }

        const unique =
          new Map();

        images.forEach(
          image => {
            const key =
              imageKey(
                image
              );

            if(
              key
              && !unique.has(
                key
              )
            ){
              unique.set(
                key,
                image
              );
            }
          }
        );

        for(
          const [
            key,
            image
          ]
          of unique
        ){
          if(
            token
            !== prepareToken
          ){
            return;
          }

          preparedImages.set(
            key,
            imageToDataUrl(
              image
            )
          );
        }

        if(
          token
          !== prepareToken
        ){
          return;
        }

        setReady(
          true
        );

        window.dispatchEvent(
          new CustomEvent(
            "muuzee:artwall-export-ready",
            {
              detail:{
                images:
                  images.length,
                uniqueImages:
                  preparedImages.size
              }
            }
          )
        );
      } catch(error) {
        console.error(
          "[Muuzee ArtWall Export Prepare]",
          error
        );

        if(
          token
          === prepareToken
        ){
          setReady(
            false
          );
        }
      }
    };

  const invalidate =
    () => {
      ++prepareToken;

      ready =
        false;

      preparedImages =
        new Map();

      generatedCache = {
        signature:"",
        dataUrl:""
      };

      setReady(
        false
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

  const applyPreparedImages =
    () => {
      const originals =
        [];

      allImages()
        .forEach(
          image => {
            const key =
              imageKey(
                image
              );

            const dataUrl =
              preparedImages.get(
                key
              );

            if(!dataUrl){
              throw new Error(
                `Missing prepared image: ${key}`
              );
            }

            originals.push({
              image,
              src:
                image.getAttribute(
                  "src"
                ),
              srcset:
                image.getAttribute(
                  "srcset"
                )
            });

            image.removeAttribute(
              "srcset"
            );

            image.src =
              dataUrl;
          }
        );

      return () => {
        originals.forEach(
          original => {
            if(
              original.src
              === null
            ){
              original.image
                .removeAttribute(
                  "src"
                );
            } else {
              original.image
                .setAttribute(
                  "src",
                  original.src
                );
            }

            if(
              original.srcset
              === null
            ){
              original.image
                .removeAttribute(
                  "srcset"
                );
            } else {
              original.image
                .setAttribute(
                  "srcset",
                  original.srcset
                );
            }
          }
        );
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
      if(
        event.target
        === dialog
      ){
        closePreview();
      }
    }
  );

  window.addEventListener(
    "muuzee:artwall-ready",
    () => {
      prepareExport();
    }
  );

  window.addEventListener(
    "muuzee:profile-settings-change",
    () => {
      invalidate();

      setTimeout(
        prepareExport,
        0
      );
    }
  );

  window.addEventListener(
    "muuzee:artwall-store-change",
    () => {
      invalidate();

      setTimeout(
        prepareExport,
        0
      );
    }
  );

  /*
    Profile avatar is assigned at DOMContentLoaded.
    Prepare after that assignment and after the ArtWall grid promise.
  */
  prepareExport();

  button.addEventListener(
    "click",
    async event => {
      event.preventDefault();
      event.stopPropagation();

      if(!ready){
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

      let restore =
        () => {};

      button.disabled =
        true;

      if(label){
        label.textContent =
          "画像生成中…";
      }

      try {
        restore =
          applyPreparedImages();

        await waitForLayout();

        const rect =
          artwall
            .getBoundingClientRect();

        const startedAt =
          performance.now();

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

        console.info(
          "[Muuzee ArtWall Export Timing]",
          {
            rasterizeMs:
              Math.round(
                performance.now()
                - startedAt
              ),

            images:
              allImages()
                .length,

            prepared:
              preparedImages.size,

            pixelRatio:
              PIXEL_RATIO
          }
        );

        generatedCache = {
          signature,
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
          "ArtWall画像を生成できませんでした。再読み込みしてお試しください。"
        );
      } finally {
        restore();

        setReady(
          true
        );
      }
    },
    true
  );
})();
