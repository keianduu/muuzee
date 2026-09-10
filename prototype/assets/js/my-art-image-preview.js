(() => {
  "use strict";

  const button = document.querySelector("[data-artwall-download]");
  const artwall = document.querySelector(".artwall");
  const dialog = document.querySelector("[data-artwall-image-preview-dialog]");
  const preview = document.querySelector("[data-artwall-image-preview]");
  const closeButtons = document.querySelectorAll("[data-artwall-image-preview-close]");

  if (!button || !artwall || !dialog || !preview) return;

  const PIXEL_RATIO = 4;
  let artwallReady = false;
  let generatedCache = {signature:"",dataUrl:""};

  const label = button.querySelector("span");
  const originalLabel = label?.textContent || "画像DL";

  const setReady = ready => {
    artwallReady = ready === true;
    button.disabled = !artwallReady;
    button.setAttribute("aria-disabled",artwallReady ? "false" : "true");
    if (label) label.textContent = artwallReady ? originalLabel : "画像準備中…";
  };

  const applyReadyResult = result => {
    const complete = result === true || result?.complete === true;
    setReady(complete);
    if (!complete) console.warn("[Muuzee ArtWall Ready]",result);
  };

  setReady(false);

  if (window.MuuzeeArtWallReady?.then) {
    window.MuuzeeArtWallReady.then(applyReadyResult).catch(error => {
      console.error("[Muuzee ArtWall Ready]",error);
      setReady(false);
    });
  }

  window.addEventListener("muuzee:artwall-ready",event => applyReadyResult(event.detail));

  const imagesAreReady = () => Array.from(artwall.querySelectorAll("img"))
    .every(image => image.complete && image.naturalWidth > 0);

  const waitForLayout = () => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  const getSignature = () => {
    const rect = artwall.getBoundingClientRect();
    return [Math.round(rect.width),Math.round(rect.height),artwall.innerHTML].join("|");
  };

  const invalidateCache = () => {
    generatedCache = {signature:"",dataUrl:""};
  };

  const openPreview = dataUrl => {
    preview.src = dataUrl;
    dialog.showModal();
  };

  const closePreview = () => {
    if (dialog.open) dialog.close();
  };

  closeButtons.forEach(control => control.addEventListener("click",closePreview));
  dialog.addEventListener("click",event => {
    if (event.target === dialog) closePreview();
  });

  window.addEventListener("resize",invalidateCache);
  window.addEventListener("muuzee:artwall-store-change",() => {
    invalidateCache();
    setReady(false);
  });

  button.addEventListener("click",async event => {
    event.preventDefault();
    event.stopPropagation();

    if (!artwallReady || !imagesAreReady()) {
      setReady(false);
      return;
    }

    if (!window.htmlToImage || typeof window.htmlToImage.toPng !== "function") {
      window.alert("画像生成機能を読み込めませんでした。再読み込みしてお試しください。");
      return;
    }

    const signature = getSignature();
    if (generatedCache.dataUrl && generatedCache.signature === signature) {
      openPreview(generatedCache.dataUrl);
      return;
    }

    button.disabled = true;
    if (label) label.textContent = "画像生成中…";

    try {
      await waitForLayout();
      const rect = artwall.getBoundingClientRect();
      const startedAt = performance.now();

      const dataUrl = await window.htmlToImage.toPng(artwall,{
        width:Math.ceil(rect.width),
        height:Math.ceil(rect.height),
        pixelRatio:PIXEL_RATIO,
        cacheBust:false,
        skipAutoScale:false
      });

      console.info("[Muuzee ArtWall Export Timing]",{
        rasterizeMs:Math.round(performance.now()-startedAt),
        pixelRatio:PIXEL_RATIO,
        width:Math.ceil(rect.width),
        height:Math.ceil(rect.height),
        images:artwall.querySelectorAll("img").length
      });

      generatedCache = {signature,dataUrl};
      openPreview(dataUrl);
    } catch (error) {
      console.error("[Muuzee ArtWall Export]",error);
      window.alert("ArtWall画像を生成できませんでした。再読み込みしてお試しください。");
    } finally {
      setReady(imagesAreReady());
    }
  },true);
})();
