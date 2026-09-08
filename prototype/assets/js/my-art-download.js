/* Muuzee My Art — ArtWall PNG save/share */
(() => {
  "use strict";

  const button = document.querySelector("[data-artwall-download]");
  const artwall = document.querySelector(".artwall");
  if (!button || !artwall) return;

  const PIXEL_RATIO = 4;

  const waitForImages = async root => {
    const images = Array.from(root.querySelectorAll("img"));
    await Promise.all(images.map(async image => {
      if (image.complete && image.naturalWidth) return;
      try {
        await image.decode();
      } catch (_) {
        await new Promise(resolve => {
          const done = () => resolve();
          image.addEventListener("load", done, { once:true });
          image.addEventListener("error", done, { once:true });
        });
      }
    }));
  };

  const waitForLayout = () => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  const fileName = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2,"0");
    const d = String(now.getDate()).padStart(2,"0");
    return `muuzee-artwall-${y}${m}${d}.png`;
  };

  const directDownload = dataUrl => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = fileName();
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const dataUrlToFile = async dataUrl => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return new File([blob], fileName(), { type:"image/png" });
  };

  const shareOrDownload = async dataUrl => {
    const file = await dataUrlToFile(dataUrl);
    const canShareFiles =
      typeof navigator.share === "function"
      && typeof navigator.canShare === "function"
      && navigator.canShare({ files:[file] });

    if (!canShareFiles) {
      directDownload(dataUrl);
      return;
    }

    try {
      await navigator.share({
        title:"Muuzee ArtWall",
        files:[file]
      });
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.warn("[Muuzee ArtWall Share] fallback to download", error);
      directDownload(dataUrl);
    }
  };

  button.addEventListener("click", async () => {
    if (!window.htmlToImage || typeof window.htmlToImage.toPng !== "function") {
      window.alert("画像生成機能を読み込めませんでした。再読み込みしてお試しください。");
      return;
    }

    const label = button.querySelector("span");
    const originalLabel = label?.textContent || "画像DL";
    button.disabled = true;
    if (label) label.textContent = "生成中…";

    try {
      if (document.fonts?.ready) await document.fonts.ready;
      await waitForImages(artwall);
      await waitForLayout();

      const rect = artwall.getBoundingClientRect();
      const dataUrl = await window.htmlToImage.toPng(artwall, {
        width:Math.ceil(rect.width),
        height:Math.ceil(rect.height),
        pixelRatio:PIXEL_RATIO,
        cacheBust:true,
        skipAutoScale:false
      });

      await shareOrDownload(dataUrl);
    } catch (error) {
      console.error("[Muuzee ArtWall Save]", error);
      window.alert("ArtWall画像を生成できませんでした。再読み込みしてお試しください。");
    } finally {
      button.disabled = false;
      if (label) label.textContent = originalLabel;
    }
  });
})();
