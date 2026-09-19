/* Muuzee Shared Map Discovery — Leaflet, controls, location, count, markers */
(() => {
  "use strict";

  const MODES = new Set(["exhibition","museum"]);

  function resolveMount(value){
    return typeof value === "string" ? document.querySelector(value) : value;
  }

  function tileConfig(){
    return window.MuuzeeMapConfig?.tile || {
      url:"https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      options:{
        subdomains:"abcd",
        maxZoom:20,
        attribution:"&copy; OpenStreetMap contributors &copy; CARTO"
      },
      initialBounds:[[35.645,139.735],[35.728,139.825]],
      detailZoom:15
    };
  }

  function addTileLayer(map){
    const tile = tileConfig();
    return L.tileLayer(tile.url,tile.options).addTo(map);
  }

  function controlsMarkup(){
    return `
      <div class="muuzee-map-discovery-canvas" data-map-discovery-canvas></div>
      <div class="map-control-stack" aria-label="地図の表示切り替え">
        <div class="map-mode-bar">
          <button class="map-mode-button" type="button" data-map-mode="exhibition" aria-pressed="false">
            <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="1.5"></rect><circle cx="9" cy="9" r="1.5"></circle><path d="m6.5 17 4-4 3 3 2-2 2 3"></path></svg>
            <span>展示会</span>
          </button>
          <button class="map-mode-button" type="button" data-map-mode="museum" aria-pressed="false">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 9h18M5 9v10M9 9v10M15 9v10M19 9v10M3 19h18M4 8l8-5 8 5"></path></svg>
            <span>美術館</span>
          </button>
        </div>
        <button class="map-locate-button" type="button" data-map-locate aria-label="現在地へ移動">
          <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"></circle><path d="M12 3v3M12 18v3M3 12h3M18 12h3"></path></svg>
          <span>現在地</span>
        </button>
      </div>
      <div class="map-result-count" aria-live="polite">
        <strong data-map-result-count>0</strong>
        <span data-map-result-label>exhibitions</span>
      </div>
    `;
  }

  function mount({
    mount:mountValue,
    exhibitions = [],
    museums = [],
    initialMode = "exhibition",
    filterItems,
    onModeChange,
    mapOptions = {}
  } = {}){
    const root = resolveMount(mountValue);
    const mapUI = window.MuuzeeMapUI;

    if(!root || typeof window.L === "undefined" || !mapUI) return null;

    let mode = MODES.has(initialMode) ? initialMode : "exhibition";
    let destroyed = false;
    let currentLocationMarker = null;
    let resizeObserver = null;
    const timers = new Set();
    const collections = {
      exhibition:Array.isArray(exhibitions) ? exhibitions : [],
      museum:Array.isArray(museums) ? museums : []
    };

    root.classList.add("muuzee-map-discovery");
    root.innerHTML = controlsMarkup();

    const mapEl = root.querySelector("[data-map-discovery-canvas]");
    const modeButtons = [...root.querySelectorAll("[data-map-mode]")];
    const locateButton = root.querySelector("[data-map-locate]");
    const resultCount = root.querySelector("[data-map-result-count]");
    const resultLabel = root.querySelector("[data-map-result-label]");

    const map = L.map(mapEl,{
      scrollWheelZoom:true,
      zoomControl:true,
      attributionControl:true,
      ...mapOptions
    }).fitBounds(tileConfig().initialBounds,{padding:[24,24],maxZoom:12.5});

    addTileLayer(map);

    const markerLayer = L.layerGroup().addTo(map);

    function currentItems(){
      const items = collections[mode];
      if(typeof filterItems !== "function") return items;

      const filtered = filterItems({mode,items});
      return Array.isArray(filtered) ? filtered : [];
    }

    function renderModeButtons(){
      modeButtons.forEach(button => {
        const active = button.dataset.mapMode === mode;
        button.classList.toggle("is-active",active);
        button.setAttribute("aria-pressed",String(active));
      });
    }

    function render({fit=false} = {}){
      if(destroyed) return;

      markerLayer.clearLayers();
      const items = currentItems();
      const positionedItems = items.filter(item =>
        Number.isFinite(item.lat) && Number.isFinite(item.lng)
      );

      positionedItems.forEach(item => {
        mapUI.addItemMarker({map,mapEl,markerLayer,item});
      });

      resultCount.textContent = items.length;
      resultLabel.textContent = mode === "museum" ? "museums" : "exhibitions";
      renderModeButtons();

      if(fit && positionedItems.length){
        const bounds = L.latLngBounds(
          positionedItems.map(item => [item.lat,item.lng])
        );

        if(bounds.isValid()) map.fitBounds(bounds,{padding:[70,70],maxZoom:13});
      }
    }

    function notifyModeChange(previousMode){
      if(typeof onModeChange === "function"){
        onModeChange({mode,previousMode,discovery:api});
      }
    }

    function setMode(nextMode,{fit=false,notify=true} = {}){
      if(destroyed || !MODES.has(nextMode)) return false;

      const previousMode = mode;
      mode = nextMode;
      render({fit});
      if(notify && previousMode !== mode) notifyModeChange(previousMode);
      return true;
    }

    function invalidateSize(){
      if(!destroyed) map.invalidateSize({pan:false});
    }

    function scheduleInvalidate(delay){
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        invalidateSize();
      },delay);
      timers.add(timer);
    }

    function handleOrientationChange(){
      scheduleInvalidate(240);
    }

    function handleResize(){
      window.requestAnimationFrame(invalidateSize);
    }

    function locate(){
      if(destroyed || !navigator.geolocation || locateButton.classList.contains("is-loading")) return;

      locateButton.classList.add("is-loading");
      locateButton.setAttribute("aria-busy","true");

      const finish = () => {
        locateButton.classList.remove("is-loading");
        locateButton.removeAttribute("aria-busy");
      };

      navigator.geolocation.getCurrentPosition(
        position => {
          if(destroyed) return;

          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          if(currentLocationMarker) map.removeLayer(currentLocationMarker);

          currentLocationMarker = L.marker([lat,lng],{
            icon:L.divIcon({
              className:"",
              html:'<div class="muuzee-current-pin"></div>',
              iconSize:[18,18],
              iconAnchor:[9,9]
            }),
            interactive:false
          }).addTo(map);

          map.setView([lat,lng],14,{animate:true});
          finish();
        },
        finish,
        {enableHighAccuracy:false,timeout:8000,maximumAge:300000}
      );
    }

    function destroy(){
      if(destroyed) return;
      destroyed = true;

      resizeObserver?.disconnect();
      window.removeEventListener("resize",handleResize);
      window.removeEventListener("orientationchange",handleOrientationChange);
      timers.forEach(timer => window.clearTimeout(timer));
      timers.clear();
      map.remove();
      root.replaceChildren();
      root.classList.remove("muuzee-map-discovery");
    }

    const api = Object.freeze({
      getMode(){ return mode; },
      setMode,
      refresh:render,
      invalidateSize,
      destroy
    });

    modeButtons.forEach(button => {
      button.addEventListener("click",() => setMode(button.dataset.mapMode));
    });
    locateButton.addEventListener("click",locate);

    render();
    window.requestAnimationFrame(invalidateSize);
    scheduleInvalidate(180);

    if("ResizeObserver" in window){
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(root);
    }else{
      window.addEventListener("resize",handleResize);
    }
    window.addEventListener("orientationchange",handleOrientationChange);

    return api;
  }

  function mountPlace({mount:mountValue,item,mapOptions={}} = {}){
    const root = resolveMount(mountValue);
    const mapUI = window.MuuzeeMapUI;
    if(
      !root
      || typeof window.L === "undefined"
      || !mapUI
      || !Number.isFinite(item?.lat)
      || !Number.isFinite(item?.lng)
    ) return null;

    root.classList.add("muuzee-map-discovery","muuzee-map-discovery--place");
    root.innerHTML = '<div class="muuzee-map-discovery-canvas" data-map-discovery-canvas></div>';
    const mapEl = root.querySelector("[data-map-discovery-canvas]");
    const map = L.map(mapEl,{
      scrollWheelZoom:false,
      zoomControl:true,
      attributionControl:true,
      ...mapOptions
    }).setView([item.lat,item.lng],tileConfig().detailZoom);

    addTileLayer(map);
    const markerLayer = L.layerGroup().addTo(map);
    mapUI.addItemMarker({map,mapEl,markerLayer,item,openPopup:true});

    const invalidateSize = () => map.invalidateSize({pan:false});
    const resizeObserver = "ResizeObserver" in window
      ? new ResizeObserver(() => window.requestAnimationFrame(invalidateSize))
      : null;
    resizeObserver?.observe(root);
    window.requestAnimationFrame(invalidateSize);

    return Object.freeze({
      invalidateSize,
      destroy(){
        resizeObserver?.disconnect();
        map.remove();
        root.replaceChildren();
        root.classList.remove("muuzee-map-discovery","muuzee-map-discovery--place");
      }
    });
  }

  window.MuuzeeMapDiscovery = Object.freeze({mount,mountPlace});
})();
