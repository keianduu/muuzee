(() => {
  "use strict";

  const instances = new WeakMap();
  const resolve = target => typeof target === "string"
    ? document.querySelector(target)
    : target;

  const mount = target => {
    const root = resolve(target);
    if(!root) return null;
    if(instances.has(root)) return instances.get(root);

    const title = root.querySelector("[data-detail-head-title]");
    const sub = root.querySelector("[data-detail-head-sub]");
    const meta = root.querySelector("[data-detail-head-meta]");

    const api = {
      root,
      setTitle(value){
        if(title) title.textContent = value || "";
      },
      setSub(value){
        if(!sub) return;
        sub.textContent = value || "";
        sub.hidden = !value;
      },
      setMeta(items){
        if(!meta) return;
        const values = Array.isArray(items) ? items : [];
        meta.replaceChildren(...values.filter(item => item?.text).map(item => {
          const node = document.createElement("span");
          node.className = "muuzee-detail-head-meta-item";
          if(item.tone) node.classList.add(`is-${item.tone}`);
          node.textContent = item.text;
          return node;
        }));
        meta.hidden = values.length === 0;
      }
    };

    instances.set(root,api);
    return api;
  };

  document.querySelectorAll("[data-muuzee-detail-head]").forEach(mount);

  window.MuuzeeDetailHead = {mount};
})();
