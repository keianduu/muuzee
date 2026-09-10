/*
  Muuzee My Art — ArtWall PNG preview

  Production pipeline validated by Safari A/B test:
    ArtWall render
    -> all images load/decode
    -> fonts
    -> stable layout
    -> WebKit settle
    -> modern-screenshot
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

  const SCALE =
    4;

  const IMAGE_TIMEOUT =
    15000;

  const FONT_TIMEOUT =
    5000;

  const COMMON_SETTLE_MS =
    300;

  const DRAW_IMAGE_INTERVAL_MS =
    150;

  const delay =
    ms =>
      new Promise(
        resolve =>
          setTimeout(
            resolve,
            ms
          )
      );

  const withTimeout =
    (
      promise,
      ms,
      label
    ) =>
      Promise.race([
        promise,

        new Promise(
          (_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    `${label} timeout`
                  )
                ),
              ms
            )
        )
      ]);

  const createProgress =
    () => {
      let root =
        document.querySelector(
          "[data-my-art-export-progress]"
        );

      if(root){
        return root;
      }

      root =
        document.createElement(
          "div"
        );

      root.className =
        "my-art-export-progress";

      root.hidden =
        true;

      root.dataset
        .myArtExportProgress =
          "";

      root.setAttribute(
        "role",
        "status"
      );

      root.setAttribute(
        "aria-live",
        "polite"
      );

      root.innerHTML = `
        <div class="my-art-export-progress__panel">
          <div
            class="my-art-export-progress__spinner"
            aria-hidden="true"
          ></div>
          <p class="my-art-export-progress__title">
            ArtWall画像を生成しています
          </p>
          <p
            class="my-art-export-progress__status"
            data-export-progress-status
          >
            準備しています…
          </p>
          <div
            class="my-art-export-progress__track"
            aria-hidden="true"
          >
            <div
              class="my-art-export-progress__bar"
              data-export-progress-bar
            ></div>
          </div>
        </div>
      `;

      document.body.appendChild(
        root
      );

      return root;
    };

  const progressRoot =
    createProgress();

  const progressStatus =
    progressRoot.querySelector(
      "[data-export-progress-status]"
    );

  const progressBar =
    progressRoot.querySelector(
      "[data-export-progress-bar]"
    );

  const showProgress =
    (
      percent,
      status
    ) => {
      progressRoot.hidden =
        false;

      if(progressBar){
        progressBar.style.width =
          `${Math.max(
            0,
            Math.min(
              100,
              percent
            )
          )}%`;
      }

      if(
        progressStatus
        && status
      ){
        progressStatus.textContent =
          status;
      }
    };

  const hideProgress =
    () => {
      progressRoot.hidden =
        true;
    };

  const artwallImages =
    () =>
      Array.from(
        artwall.querySelectorAll(
          "img"
        )
      );

  const waitForImage =
    async image => {
      if(
        !(
          image.complete
          && image.naturalWidth > 0
        )
      ){
        await withTimeout(
          new Promise(
            (
              resolve,
              reject
            ) => {
              const cleanup =
                () => {
                  image.removeEventListener(
                    "load",
                    loaded
                  );

                  image.removeEventListener(
                    "error",
                    failed
                  );
                };

              const loaded =
                () => {
                  cleanup();
                  resolve();
                };

              const failed =
                () => {
                  cleanup();
                  reject(
                    new Error(
                      `Image failed: ${
                        image.currentSrc
                        || image.src
                      }`
                    )
                  );
                };

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
          ),
          IMAGE_TIMEOUT,
          "image load"
        );
      }

      if(
        typeof image.decode
        === "function"
      ){
        try {
          await withTimeout(
            image.decode(),
            IMAGE_TIMEOUT,
            "image decode"
          );
        } catch(error) {
          if(
            !image.complete
            || image.naturalWidth <= 0
          ){
            throw error;
          }
        }
      }

      if(
        !image.complete
        || image.naturalWidth <= 0
      ){
        throw new Error(
          "Image is not ready"
        );
      }
    };

  const waitForAllImages =
    async () => {
      const images =
        artwallImages();

      if(!images.length){
        throw new Error(
          "ArtWall has no images"
        );
      }

      for(
        let index = 0;
        index < images.length;
        index += 1
      ){
        const image =
          images[index];

        image.loading =
          "eager";

        try {
          image.fetchPriority =
            "high";
        } catch(_){
          // Browser hint only.
        }

        await waitForImage(
          image
        );

        showProgress(
          12
          + (
              (
                index + 1
              )
              / images.length
            )
            * 28,
          `画像を確認しています ${
            index + 1
          } / ${images.length}`
        );
      }
    };

  const waitForFonts =
    async () => {
      if(
        !document.fonts?.ready
      ){
        return;
      }

      try {
        await withTimeout(
          document.fonts.ready,
          FONT_TIMEOUT,
          "fonts"
        );
      } catch(error) {
        console.warn(
          "[Muuzee ArtWall Export] fonts readiness timeout",
          error
        );
      }
    };

  const waitForStableLayout =
    async () => {
      let previous =
        null;

      let stableFrames =
        0;

      for(
        let frame = 0;
        frame < 16;
        frame += 1
      ){
        await new Promise(
          resolve =>
            requestAnimationFrame(
              resolve
            )
        );

        const rect =
          artwall
            .getBoundingClientRect();

        const current = [
          Math.round(
            rect.width * 100
          ) / 100,

          Math.round(
            rect.height * 100
          ) / 100
        ];

        if(
          previous
          && previous[0]
            === current[0]
          && previous[1]
            === current[1]
        ){
          stableFrames +=
            1;
        } else {
          stableFrames =
            0;
        }

        previous =
          current;

        if(
          stableFrames >= 4
        ){
          break;
        }
      }
    };

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

  let generatedCache = {
    signature:"",
    dataUrl:""
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
    control =>
      control.addEventListener(
        "click",
        closePreview
      )
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
    "resize",
    invalidateCache
  );

  window.addEventListener(
    "muuzee:artwall-store-change",
    invalidateCache
  );

  window.addEventListener(
    "muuzee:profile-settings-change",
    invalidateCache
  );

  button.disabled =
    false;

  button.setAttribute(
    "aria-disabled",
    "false"
  );

  const label =
    button.querySelector(
      "span"
    );

  if(label){
    label.textContent =
      "画像DL";
  }

  button.addEventListener(
    "click",
    async event => {
      event.preventDefault();
      event.stopPropagation();

      if(button.disabled){
        return;
      }

      if(
        !window.modernScreenshot
        || typeof window
          .modernScreenshot
          .domToPng
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

      button.disabled =
        true;

      showProgress(
        5,
        "ArtWallを確認しています…"
      );

      const totalStartedAt =
        performance.now();

      try {
        if(
          window.MuuzeeArtWallReady
          && typeof window
            .MuuzeeArtWallReady
            .then
            === "function"
        ){
          await withTimeout(
            window.MuuzeeArtWallReady,
            IMAGE_TIMEOUT,
            "ArtWall render"
          );
        }

        showProgress(
          10,
          "画像を確認しています…"
        );

        await waitForAllImages();

        showProgress(
          43,
          "フォントを確認しています…"
        );

        await waitForFonts();

        showProgress(
          48,
          "レイアウトを確認しています…"
        );

        await waitForStableLayout();

        showProgress(
          52,
          "描画を安定させています…"
        );

        await delay(
          COMMON_SETTLE_MS
        );

        const rect =
          artwall
            .getBoundingClientRect();

        showProgress(
          58,
          "画像を生成しています…"
        );

        const rasterStartedAt =
          performance.now();

        const dataUrl =
          await window
            .modernScreenshot
            .domToPng(
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

                scale:
                  SCALE,

                timeout:
                  30000,

                drawImageInterval:
                  DRAW_IMAGE_INTERVAL_MS,

                fetch:{
                  requestInit:{
                    cache:
                      "force-cache",
                    credentials:
                      "same-origin"
                  },

                  bypassingCache:
                    false
                },

                progress:
                  (
                    current,
                    total
                  ) => {
                    if(
                      !total
                      || total <= 0
                    ){
                      return;
                    }

                    const ratio =
                      Math.max(
                        0,
                        Math.min(
                          1,
                          current / total
                        )
                      );

                    showProgress(
                      58
                      + ratio * 34,
                      `素材を準備しています ${
                        current
                      } / ${total}`
                    );
                  }
              }
            );

        const rasterizeMs =
          Math.round(
            performance.now()
            - rasterStartedAt
          );

        generatedCache = {
          signature,
          dataUrl
        };

        showProgress(
          97,
          "プレビューを準備しています…"
        );

        console.info(
          "[Muuzee ArtWall Export Timing]",
          {
            engine:
              "modern-screenshot",

            totalMs:
              Math.round(
                performance.now()
                - totalStartedAt
              ),

            rasterizeMs,

            scale:
              SCALE,

            drawImageInterval:
              DRAW_IMAGE_INTERVAL_MS,

            settleMs:
              COMMON_SETTLE_MS,

            images:
              artwallImages()
                .length
          }
        );

        await delay(
          80
        );

        showProgress(
          100,
          "完了"
        );

        hideProgress();

        openPreview(
          dataUrl
        );
      } catch(error) {
        hideProgress();

        console.error(
          "[Muuzee ArtWall Export]",
          error
        );

        window.alert(
          "ArtWall画像を生成できませんでした。再読み込みしてお試しください。"
        );
      } finally {
        button.disabled =
          false;
      }
    },
    true
  );
})();
