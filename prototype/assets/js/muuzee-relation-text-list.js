/* Muuzee Shared Relation Text List */
(() => {
  "use strict";

  function mount(target,options = {}){
    const root = typeof target === "string" ? document.querySelector(target) : target;
    if(!root) return null;

    const items = Array.isArray(options.items) ? options.items : [];
    root.classList.add("muuzee-relation-text-list");
    root.replaceChildren();

    if(!items.length){
      const empty = document.createElement("p");
      empty.className = "muuzee-relation-text-list-empty";
      empty.textContent = options.emptyText || "関連情報を確認中です。";
      root.append(empty);
      return root;
    }

    items.forEach(item => {
      const row = document.createElement("article");
      row.className = "muuzee-relation-text-list-row";

      const copy = document.createElement("div");
      copy.className = "muuzee-relation-text-list-copy";

      const primary = document.createElement("strong");
      primary.className = "muuzee-relation-text-list-primary";
      primary.textContent = item.primary || "情報を確認中です";
      copy.append(primary);

      if(item.secondary){
        const secondary = document.createElement("span");
        secondary.className = "muuzee-relation-text-list-secondary";
        secondary.textContent = item.secondary;
        copy.append(secondary);
      }

      row.append(copy);
      if(item.meta){
        const meta = document.createElement("small");
        meta.className = "muuzee-relation-text-list-meta";
        meta.textContent = item.meta;
        row.append(meta);
      }
      root.append(row);
    });
    return root;
  }

  window.MuuzeeRelationTextList = Object.freeze({mount});
})();
