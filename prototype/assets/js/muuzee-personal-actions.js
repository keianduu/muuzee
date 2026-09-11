/* Muuzee Shared Personal Actions — Save / Seen */
(() => {
  "use strict";

  const readArray = key => {
    try{
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    }catch{
      return [];
    }
  };

  const writeArray = (key,value) => {
    localStorage.setItem(key,JSON.stringify(value));
  };

  const saveKey = type => ({
    exhibition:"muuzee:saved-exhibitions",
    museum:"muuzee:saved-museums",
    artist:"muuzee:saved-artists"
  }[type] || "");

  const today = () => {
    const date = new Date();
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2,"0"),
      String(date.getDate()).padStart(2,"0")
    ].join(".");
  };

  function currentId(type){
    const requested = new URLSearchParams(location.search).get("id");

    if(type === "exhibition"){
      const catalog = window.MuuzeeExhibitionCatalog || [];
      return (
        catalog.find(item => item.id === requested)?.id
        || requested
        || catalog[0]?.id
        || ""
      );
    }

    if(type === "museum"){
      const catalog = window.MuuzeeMuseumCatalog || [];
      return (
        catalog.find(item => item.id === requested)?.id
        || requested
        || catalog[0]?.id
        || ""
      );
    }

    return requested || "";
  }

  function resolveId(button){
    if(button.dataset.personalId) return button.dataset.personalId;

    if(button.hasAttribute("data-personal-current")){
      const id = currentId(button.dataset.personalType);
      if(id) button.dataset.personalId = id;
      return id;
    }

    return "";
  }

  function isSaved(type,id){
    const key = saveKey(type);
    return Boolean(key && id && readArray(key).includes(id));
  }

  function isSeen(type,id){
    return readArray("muuzee:seen-items").some(item =>
      item?.type === type && item?.id === id
    );
  }

  function toggleSaved(type,id){
    const key = saveKey(type);
    if(!key || !id) return false;

    const values = readArray(key);
    const active = values.includes(id);

    writeArray(
      key,
      active
        ? values.filter(value => value !== id)
        : [...values,id]
    );

    return !active;
  }

  function toggleSeen(type,id){
    if(!type || !id) return false;

    const values = readArray("muuzee:seen-items");
    const active = values.some(item =>
      item?.type === type && item?.id === id
    );

    writeArray(
      "muuzee:seen-items",
      active
        ? values.filter(item =>
            !(item?.type === type && item?.id === id)
          )
        : [...values,{type,id,date:today()}]
    );

    return !active;
  }

  function syncButton(button){
    const action = button.dataset.personalAction;
    const type = button.dataset.personalType;
    const id = resolveId(button);

    const active = action === "save"
      ? isSaved(type,id)
      : isSeen(type,id);

    button.classList.toggle("is-active",active);
    button.setAttribute("aria-pressed",String(active));

    const label = button.querySelector("[data-personal-action-label]");
    if(!label) return;

    label.textContent =
      action === "save"
        ? (active ? "保存済" : "保存")
        : "観た";
  }

  function syncAll(){
    document
      .querySelectorAll("[data-personal-action]")
      .forEach(syncButton);
  }

  document.addEventListener("click",event => {
    const button = event.target.closest("[data-personal-action]");
    if(!button) return;

    const action = button.dataset.personalAction;
    const type = button.dataset.personalType;
    const id = resolveId(button);

    if(!action || !type || !id) return;

    event.preventDefault();
    event.stopPropagation();

    const active = action === "save"
      ? toggleSaved(type,id)
      : toggleSeen(type,id);

    syncAll();

    if(action === "save" && active){
      window.MuuzeeAuth?.notifyAnonymousSave?.();
    }

    window.dispatchEvent(
      new CustomEvent("muuzee:personal-change",{
        detail:{action,type,id,active}
      })
    );
  });

  const observer = new MutationObserver(mutations => {
    const added = mutations.some(mutation =>
      [...mutation.addedNodes].some(node =>
        node.nodeType === 1
        && (
          node.matches?.("[data-personal-action]")
          || node.querySelector?.("[data-personal-action]")
        )
      )
    );

    if(added) syncAll();
  });

  function init(){
    syncAll();

    observer.observe(document.body,{
      childList:true,
      subtree:true
    });

    window.addEventListener("storage",syncAll);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded",init,{once:true});
  }else{
    init();
  }

  window.MuuzeePersonalActions = Object.freeze({
    syncAll,
    isSaved,
    isSeen
  });
})();