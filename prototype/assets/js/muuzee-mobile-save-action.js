(() => {
  "use strict";

  const instances = new WeakMap();

  const mount = (target, options = {}) => {
    const root = typeof target === "string"
      ? document.querySelector(target)
      : target;

    if(!root) return null;
    if(instances.has(root)) return instances.get(root);

    root.classList.add("muuzee-mobile-save-action");

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = options.label || "保存";
    button.disabled = true;
    button.setAttribute("aria-disabled","true");
    button.addEventListener("click",event => options.onSave?.(event));
    root.replaceChildren(button);

    const api = {
      root,
      button,
      setDisabled(value){
        const disabled = Boolean(value);
        button.disabled = disabled;
        button.setAttribute("aria-disabled",String(disabled));
      },
      setBusy(value){
        const busy = Boolean(value);
        button.setAttribute("aria-busy",String(busy));
        root.classList.toggle("is-busy",busy);
      }
    };

    instances.set(root,api);
    return api;
  };

  window.MuuzeeMobileSaveAction = {mount};
})();
