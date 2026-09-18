/* Muuzee Shared List Intro */
(() => {
  "use strict";

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[character]));

  function mount(options = {}){
    const mountPoint = typeof options.mount === "string"
      ? document.querySelector(options.mount)
      : options.mount;

    if(!(mountPoint instanceof HTMLElement)) return null;

    const tabs = Array.isArray(options.tabs) ? options.tabs : [];
    let count = options.count ?? 0;

    mountPoint.classList.add("muuzee-list-intro");
    mountPoint.innerHTML = `
      <div class="shell">
        <div class="muuzee-list-intro-heading">
          <div class="muuzee-list-intro-copy">
            <div class="muuzee-list-intro-eyebrow">${escapeHtml(options.eyebrow)}</div>
            <h1>${escapeHtml(options.title)}</h1>
          </div>
          <p class="muuzee-list-intro-count" aria-live="polite">
            <strong data-muuzee-list-intro-count>${escapeHtml(count)}</strong>
            <span>${escapeHtml(options.countLabel)}</span>
          </p>
        </div>
        ${tabs.length ? `
          <div class="muuzee-list-intro-tabs" role="tablist" aria-label="${escapeHtml(options.tabsLabel || "表示範囲")}">
            ${tabs.map(tab => `
              <button class="muuzee-list-intro-tab${tab.active ? " is-active" : ""}" type="button" role="tab" aria-selected="${tab.active ? "true" : "false"}" data-muuzee-list-intro-tab="${escapeHtml(tab.id)}">
                <span>${escapeHtml(tab.label)}</span>
                <em data-muuzee-list-intro-tab-count="${escapeHtml(tab.id)}">${escapeHtml(tab.count ?? 0)}</em>
              </button>
            `).join("")}
          </div>
        ` : ""}
        <div class="muuzee-list-intro-divider" aria-hidden="true"></div>
      </div>
    `;

    const countElement = mountPoint.querySelector("[data-muuzee-list-intro-count]");

    function setCount(value){
      count = value ?? 0;
      if(countElement) countElement.textContent = count;
    }

    function getCount(){
      return count;
    }

    function setActiveTab(id){
      let found = false;
      mountPoint.querySelectorAll("[data-muuzee-list-intro-tab]").forEach(tab => {
        const active = tab.dataset.muuzeeListIntroTab === id;
        found = found || active;
        tab.classList.toggle("is-active",active);
        tab.setAttribute("aria-selected",String(active));
      });
      return found;
    }

    function setTabCount(id,value){
      const element = [...mountPoint.querySelectorAll("[data-muuzee-list-intro-tab-count]")]
        .find(item => item.dataset.muuzeeListIntroTabCount === String(id));
      if(element) element.textContent = value ?? 0;
    }

    mountPoint.addEventListener("click",event => {
      const tab = event.target.closest("[data-muuzee-list-intro-tab]");
      if(!tab || !mountPoint.contains(tab)) return;
      const id = tab.dataset.muuzeeListIntroTab;
      setActiveTab(id);
      options.onTabChange?.(id);
    });

    return {setCount,getCount,setActiveTab,setTabCount};
  }

  window.MuuzeeListIntro = {mount};
})();
