(() => {
  "use strict";

  const instances = new WeakMap();

  const resolveInstance = target => {
    if (!target) return null;
    if (instances.has(target)) return instances.get(target);

    const root = target.closest?.("[data-muuzee-personal-edit-toolbar]");
    return root ? instances.get(root) || null : null;
  };

  const mount = (target, options = {}) => {
    const root = typeof target === "string"
      ? document.querySelector(target)
      : target;

    if (!root) return null;
    if (instances.has(root)) return instances.get(root);

    root.dataset.muuzeePersonalEditToolbar = "";
    root.classList.add(
      "muuzee-personal-edit-toolbar",
      "muuzee-personal-section-head"
    );

    const copy = document.createElement("div");
    copy.className = "muuzee-personal-edit-toolbar-copy muuzee-personal-section-head-copy";

    const eyebrow = document.createElement("small");
    eyebrow.textContent = options.eyebrow || "Edit";

    const title = document.createElement("h2");
    title.textContent = options.title || "編集";

    const actions = document.createElement("div");
    actions.className = "muuzee-personal-edit-toolbar-actions muuzee-personal-section-head-actions";

    const saveButton = document.createElement("button");
    saveButton.type = options.saveType || "button";
    saveButton.className = "muuzee-personal-edit-toolbar-action muuzee-personal-edit-toolbar-save muuzee-personal-section-head-action is-primary";
    saveButton.textContent = options.saveLabel || "保存";
    saveButton.disabled = true;
    saveButton.setAttribute("aria-disabled", "true");

    Object.entries(options.saveAttributes || {}).forEach(([name, value]) => {
      saveButton.setAttribute(name, value === "" ? "" : String(value));
    });

    const closeLink = document.createElement("a");
    closeLink.className = "muuzee-personal-edit-toolbar-action muuzee-personal-edit-toolbar-close muuzee-personal-section-head-action is-secondary";
    closeLink.href = options.closeHref || "./my-art.html";
    closeLink.textContent = options.closeLabel || "閉じる";

    Object.entries(options.closeAttributes || {}).forEach(([name, value]) => {
      closeLink.setAttribute(name, value === "" ? "" : String(value));
    });

    copy.append(eyebrow, title);
    actions.append(saveButton, closeLink);
    root.replaceChildren(copy, actions);

    const mobilePresenter = window.MuuzeeMobileSaveAction?.mount(
      options.mobileTarget,
      {
        label:options.saveLabel || "保存",
        onSave:() => saveButton.click()
      }
    ) || null;

    let dirty = false;
    let busy = false;

    const sync = () => {
      const disabled = !dirty || busy;
      saveButton.disabled = disabled;
      saveButton.setAttribute("aria-disabled", disabled ? "true" : "false");
      saveButton.setAttribute("aria-busy", busy ? "true" : "false");
      saveButton.dataset.hasChanges = dirty ? "true" : "false";
      root.classList.toggle("is-dirty", dirty);
      root.classList.toggle("is-busy", busy);
      mobilePresenter?.setDisabled(disabled);
      mobilePresenter?.setBusy(busy);
    };

    const api = {
      root,
      saveButton,
      closeLink,
      mobilePresenter,
      setDirty(value) {
        dirty = Boolean(value);
        sync();
      },
      setBusy(value) {
        busy = Boolean(value);
        sync();
      },
      isDirty() {
        return dirty;
      },
      isBusy() {
        return busy;
      }
    };

    instances.set(root, api);
    instances.set(saveButton, api);
    instances.set(closeLink, api);
    sync();

    return api;
  };

  window.MuuzeePersonalEditToolbar = {
    mount,
    get: resolveInstance,
    setDirty(target, value) {
      resolveInstance(target)?.setDirty(value);
    },
    setBusy(target, value) {
      resolveInstance(target)?.setBusy(value);
    }
  };
})();
