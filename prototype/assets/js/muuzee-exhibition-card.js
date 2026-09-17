/*
  Muuzee Exhibition Card — Shared renderer and behavior
  Owns list-card markup and poster orientation detection.
*/
(() => {
  "use strict";

  const esc = value => String(value ?? "").replace(/[&<>"']/g,char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));

  function renderListCard(item){
    if(!item) return "";

    const statusClass = item.status === "now" ? "muuzee-pill--status" : "muuzee-pill--neutral";
    const fallbackHref = item.id
      ? `./exhibition.html?id=${encodeURIComponent(item.id)}`
      : "#";
    const href = item.href || fallbackHref;
    const linkAttrs = href === "#"
      ? 'href="#" data-no-nav="true"'
      : `href="${esc(href)}"`;

    return `
      <article class="exhibition-list-card" data-save-type="exhibition" data-save-id="${esc(item.id || item.title)}">
        <a class="exhibition-card-link" ${linkAttrs}>
          <div class="exhibition-card-image">
            <img src="${esc(item.src)}" alt="${esc(item.title)}" loading="lazy">
          </div>
          <div class="exhibition-card-body">
            <div class="exhibition-card-topline">
              <span class="muuzee-pill ${statusClass}">${esc(item.statusLabel)}</span>
              <span class="exhibition-card-category">${esc(item.category)}</span>
              <span class="exhibition-card-area">${esc(item.area)}</span>
            </div>
            <h2>${esc(item.title)}</h2>
            <p class="exhibition-card-venue">${esc(item.venue)}</p>
            <p class="exhibition-card-date">${esc(item.date)}</p>
          </div>
        </a>
      </article>`;
  }

  function classifyImage(img){
    if(!img || !img.closest) return;

    const card = img.closest(".poster-card");
    if(!card) return;

    const width = img.naturalWidth || 0;
    const height = img.naturalHeight || 0;
    if(!width || !height) return;

    const landscape = width > height;

    card.classList.toggle("is-landscape", landscape);
    card.classList.toggle("is-portrait", !landscape);
  }

  function bindImage(img){
    if(img.dataset.muuzeePosterOrientationBound === "true"){
      if(img.complete) classifyImage(img);
      return;
    }

    img.dataset.muuzeePosterOrientationBound = "true";

    if(img.complete){
      classifyImage(img);
    }else{
      img.addEventListener("load", () => classifyImage(img), {once:true});
    }
  }

  function scan(root = document){
    root.querySelectorAll?.(".poster-card .poster-stage img").forEach(bindImage);
  }

  function init(){
    const posterMounts = Array.from(document.querySelectorAll(".poster-rail"));
    if(!posterMounts.length) return;

    posterMounts.forEach(mount => scan(mount));

    const observer = new MutationObserver(records => {
      records.forEach(record => {
        record.addedNodes.forEach(node => {
          if(node.nodeType !== 1) return;

          if(node.matches?.(".poster-card .poster-stage img")){
            bindImage(node);
          }

          scan(node);
        });
      });
    });

    posterMounts.forEach(mount => {
      observer.observe(mount,{
        childList:true,
        subtree:true
      });
    });
  }

  window.MuuzeeExhibitionCard = {
    ...(window.MuuzeeExhibitionCard || {}),
    renderListCard
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded",init,{once:true});
  }else{
    init();
  }
})();
