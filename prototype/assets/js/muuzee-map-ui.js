/* Muuzee Shared Map UI */
(() => {
  "use strict";

  const centerTokens = new WeakMap();

  const esc = value => String(value ?? "").replace(/[&<>"']/g,char => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[char]));

  function storageKey(type){
    return type === "museum"
      ? "muuzee:saved-museums"
      : "muuzee:saved-exhibitions";
  }

  function savedIds(type){
    try{
      const value = JSON.parse(
        localStorage.getItem(storageKey(type)) || "[]"
      );
      return Array.isArray(value) ? value : [];
    }catch{
      return [];
    }
  }

  function isSaved(type,id){
    return savedIds(type).includes(id);
  }

  function toggleSaved(type,id){
    const current = savedIds(type);
    const saved = current.includes(id);

    const next = saved
      ? current.filter(value => value !== id)
      : [...current,id];

    localStorage.setItem(storageKey(type),JSON.stringify(next));
    return !saved;
  }

  function exhibitionIcon(saved){
    return `
      <div class="muuzee-map-pin muuzee-map-pin--exhibition${saved ? " is-saved" : ""}">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="4" width="14" height="16" rx="1.5"></rect>
          <circle cx="10" cy="9" r="1.3"></circle>
          <path d="m7 17 4-4 2.5 2.5 2-2 1.5 2"></path>
        </svg>
      </div>`;
  }

  function museumIcon(saved){
    return `
      <div class="muuzee-map-pin muuzee-map-pin--museum${saved ? " is-saved" : ""}">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9h16M6 9v9M10 9v9M14 9v9M18 9v9M4 18h16M5 8l7-4 7 4"></path>
        </svg>
      </div>`;
  }

  function createIcon(type,saved){
    return L.divIcon({
      className:"",
      html:type === "museum"
        ? museumIcon(saved)
        : exhibitionIcon(saved),
      iconSize:[34,34],
      iconAnchor:[17,17],
      popupAnchor:[0,-15]
    });
  }

  function popupHTML(item,type){
    const saved = isSaved(type,item.id);
    const isMuseum = type === "museum";

    const meta = isMuseum
      ? [
          item.prefecture || item.country,
          item.city || item.location
        ].filter(Boolean).join(" · ")
      : [
          item.statusLabel,
          item.expressionCategory
        ].filter(Boolean).join(" · ");

    const sub = isMuseum
      ? item.category
      : [item.venue,item.date].filter(Boolean).join(" · ");

    const href = isMuseum
      ? `./museum.html?id=${encodeURIComponent(item.id)}`
      : (item.href || `./exhibition.html?id=${encodeURIComponent(item.id)}`);

    return `
      <article class="map-popup-card ${isMuseum ? "is-museum" : "is-exhibition"}">
        <div class="map-popup-image">
          <img
            src="${esc(isMuseum ? item.image : item.src)}"
            alt="${esc(item.name || item.title)}"
          >
        </div>

        <div class="map-popup-body">
          <div class="map-popup-topline">
            <span class="map-popup-meta">${esc(meta)}</span>

            <button
              class="map-popup-save${saved ? " is-saved" : ""}"
              type="button"
              data-popup-save
              data-popup-type="${type}"
              data-popup-id="${esc(item.id)}"
              aria-label="${saved ? "保存済み" : "保存"}"
              aria-pressed="${String(saved)}"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 3h12v18l-6-4-6 4Z"></path>
              </svg>
            </button>
          </div>

          <h3 class="map-popup-title">${esc(item.name || item.title)}</h3>
          <p class="map-popup-sub">${esc(sub)}</p>

          <div class="map-popup-actions">
            <a class="map-popup-detail" href="${esc(href)}">詳細を見る →</a>
          </div>
        </div>
      </article>`;
  }

  function centerOpenedPopup(map,mapEl,popup){
    const token = (centerTokens.get(map) || 0) + 1;
    centerTokens.set(map,token);

    const isCurrent = () => centerTokens.get(map) === token;

    const measure = () => {
      if(!isCurrent()) return;

      const popupEl = popup.getElement?.();

      if(!popupEl){
        window.requestAnimationFrame(measure);
        return;
      }

      popupEl.classList.add("is-positioning");

      const visual =
        popupEl.querySelector(".leaflet-popup-content-wrapper")
        || popupEl;

      const mapRect = mapEl.getBoundingClientRect();
      const popupRect = visual.getBoundingClientRect();

      const dx =
        popupRect.left + popupRect.width / 2
        - (mapRect.left + mapRect.width / 2);

      const dy =
        popupRect.top + popupRect.height / 2
        - (mapRect.top + mapRect.height / 2);

      const reveal = () => {
        if(!isCurrent()) return;
        popup.getElement?.()?.classList.remove("is-positioning");
      };

      if(Math.hypot(dx,dy) <= 2){
        reveal();
        return;
      }

      let done = false;
      let fallbackTimer = null;

      const finish = () => {
        if(done) return;
        done = true;

        if(fallbackTimer){
          window.clearTimeout(fallbackTimer);
        }

        map.off("moveend",finish);
        reveal();
      };

      map.once("moveend",finish);
      fallbackTimer = window.setTimeout(finish,700);

      map.panBy([dx,dy],{
        animate:true,
        duration:0.34,
        easeLinearity:0.22
      });
    };

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(measure);
    });
  }

  function syncPopupSaveButton(button){
    const type = button.dataset.popupType;
    const id = button.dataset.popupId;
    const saved = isSaved(type,id);

    button.classList.toggle("is-saved",saved);
    button.setAttribute("aria-pressed",String(saved));
    button.setAttribute("aria-label",saved ? "保存済み" : "保存");
  }

  function refreshMarker(markerLayer,type,id){
    const saved = isSaved(type,id);

    markerLayer.eachLayer(layer => {
      if(
        layer?._muuzeeSaveType !== type
        || layer?._muuzeeSaveId !== id
      ) return;

      const pin = layer.getElement?.()?.querySelector(".muuzee-map-pin");
      pin?.classList.toggle("is-saved",saved);
    });
  }

  function bindPopupSave(markerLayer,popup){
    const popupEl = popup.getElement?.();
    if(!popupEl) return;

    L.DomEvent.disableClickPropagation(popupEl);

    const button = popupEl.querySelector("[data-popup-save]");
    if(!button || button.dataset.muuzeeBound === "true") return;

    button.dataset.muuzeeBound = "true";

    button.addEventListener("click",event => {
      event.preventDefault();
      event.stopPropagation();

      const type = button.dataset.popupType;
      const id = button.dataset.popupId;

      const nowSaved = toggleSaved(type,id);
      syncPopupSaveButton(button);
      refreshMarker(markerLayer,type,id);

      if(nowSaved){
        window.MuuzeeAuth?.notifyAnonymousSave?.();
      }
    });
  }

  function addItemMarker({map,mapEl,markerLayer,item,type}){
    if(
      !Number.isFinite(item?.lat)
      || !Number.isFinite(item?.lng)
    ) return null;

    const marker = L.marker(
      [item.lat,item.lng],
      {icon:createIcon(type,isSaved(type,item.id))}
    );

    marker._muuzeeSaveType = type;
    marker._muuzeeSaveId = item.id;

    marker.bindPopup(
      popupHTML(item,type),
      {
        className:"muuzee-map-popup is-positioning",
        maxWidth:420,
        minWidth:300,
        closeButton:false,
        autoPan:false,
        keepInView:false,
        offset:[0,-2]
      }
    );

    marker.on("popupopen",event => {
      centerOpenedPopup(map,mapEl,event.popup);
      bindPopupSave(markerLayer,event.popup);
    });

    marker.addTo(markerLayer);
    return marker;
  }

  window.MuuzeeMapUI = Object.freeze({
    isSaved,
    addItemMarker
  });
})();
