/* Muuzee Museum List — dynamic prototype data and filtering */
(async () => {
  "use strict";

  const MUSEUMS = window.MuuzeeDataSource
    ? await window.MuuzeeDataSource.loadMuseums()
    : (window.MuuzeeMuseumCatalog || []);

  const grid = document.querySelector("[data-museum-grid]");
  const countEl = document.querySelector("[data-museum-count]");
  const empty = document.querySelector("[data-museum-empty]");
  const emptyReset = document.querySelector("[data-empty-reset]");
  const resultLabel = document.querySelector("[data-result-label]");
  const activeFilters = document.querySelector("[data-active-filters]");
  const keywordInput = document.querySelector("[data-keyword]");
  const applyButton = document.querySelector("[data-filter-apply]");
  const resetButton = document.querySelector("[data-filter-reset]");
  const tabs = [...document.querySelectorAll("[data-museum-tab]")];
  const scopeButtons = [...document.querySelectorAll("[data-scope-value]")];

  const regionGroup = document.querySelector("[data-japan-region-group]");
  const prefectureGroup = document.querySelector("[data-prefecture-group]");
  const cityGroup = document.querySelector("[data-city-group]");
  const overseasCityGroup = document.querySelector("[data-overseas-city-group]");

  const regionOptions = document.querySelector("[data-region-options]");
  const prefectureOptions = document.querySelector("[data-prefecture-options]");
  const cityOptions = document.querySelector("[data-city-options]");
  const overseasCityOptions = document.querySelector("[data-overseas-city-options]");

  if(!grid) return;

  const esc = value => String(value ?? "").replace(/[&<>"']/g,char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));

  const normalize = value => String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g,"");

  const params = new URLSearchParams(location.search);
  const initialKeyword = params.get("q") || "";

  let applied = {
    scope:"jp",
    keyword:initialKeyword,
    region:"",
    prefecture:"",
    city:""
  };

  let draft = {...applied};

  if(keywordInput) keywordInput.value = initialKeyword;

  const scopeName = scope => scope === "jp" ? "日本" : "海外";

  function searchableText(museum){
    return normalize([
      museum.name,
      museum.region,
      museum.prefecture,
      museum.city,
      museum.country,
      museum.location,
      museum.category
    ].filter(Boolean).join(" "));
  }

  function matchesKeyword(museum,keyword){
    const q = normalize(keyword);
    return !q || searchableText(museum).includes(q);
  }

  function matchesState(museum,state){
    if(museum.scope !== state.scope) return false;
    if(!matchesKeyword(museum,state.keyword)) return false;

    if(state.scope === "jp"){
      if(state.region && museum.region !== state.region) return false;
      if(state.prefecture && museum.prefecture !== state.prefecture) return false;
      if(state.city && museum.city !== state.city) return false;
    }else{
      if(state.city && museum.city !== state.city) return false;
    }

    return true;
  }

  function filteredMuseums(state = applied){
    return MUSEUMS.filter(museum => matchesState(museum,state));
  }

  function uniqueCounts(items,key){
    const counts = new Map();
    items.forEach(item => {
      const value = item[key];
      if(!value) return;
      counts.set(value,(counts.get(value) || 0) + 1);
    });
    return [...counts.entries()]
      .sort((a,b) => a[0].localeCompare(b[0],"ja"));
  }

  function chipMarkup(value,count,selected,attr){
    return `<button type="button" class="filter-chip${selected ? " is-selected" : ""}" ${attr}="${esc(value)}">
      <span>${esc(value)}</span><em>${count}</em>
    </button>`;
  }

  function draftBase(extra = {}){
    return {...draft,...extra};
  }

  function optionsSourceForRegion(){
    return MUSEUMS.filter(museum =>
      museum.scope === "jp" &&
      matchesKeyword(museum,draft.keyword)
    );
  }

  function optionsSourceForPrefecture(){
    return MUSEUMS.filter(museum =>
      museum.scope === "jp" &&
      matchesKeyword(museum,draft.keyword) &&
      (!draft.region || museum.region === draft.region)
    );
  }

  function optionsSourceForCity(){
    return MUSEUMS.filter(museum =>
      museum.scope === "jp" &&
      matchesKeyword(museum,draft.keyword) &&
      (!draft.region || museum.region === draft.region) &&
      (!draft.prefecture || museum.prefecture === draft.prefecture)
    );
  }

  function optionsSourceForOverseasCity(){
    return MUSEUMS.filter(museum =>
      museum.scope === "overseas" &&
      matchesKeyword(museum,draft.keyword)
    );
  }

  function renderFilterOptions(){
    const jp = draft.scope === "jp";

    regionGroup.hidden = !jp;
    prefectureGroup.hidden = !jp;
    cityGroup.hidden = !jp;
    overseasCityGroup.hidden = jp;

    scopeButtons.forEach(button => {
      button.classList.toggle("is-selected",button.dataset.scopeValue === draft.scope);
    });

    if(jp){
      const regions = uniqueCounts(optionsSourceForRegion(),"region");
      const prefectures = uniqueCounts(optionsSourceForPrefecture(),"prefecture");
      const cities = uniqueCounts(optionsSourceForCity(),"city");

      regionOptions.innerHTML = regions.map(([value,count]) =>
        chipMarkup(value,count,draft.region === value,"data-region-value")
      ).join("");

      prefectureOptions.innerHTML = prefectures.map(([value,count]) =>
        chipMarkup(value,count,draft.prefecture === value,"data-prefecture-value")
      ).join("");

      cityOptions.innerHTML = cities.map(([value,count]) =>
        chipMarkup(value,count,draft.city === value,"data-city-value")
      ).join("");

      prefectureGroup.hidden = prefectures.length === 0;
      cityGroup.hidden = cities.length === 0;
    }else{
      const cities = uniqueCounts(optionsSourceForOverseasCity(),"city");

      overseasCityOptions.innerHTML = cities.map(([value,count]) =>
        chipMarkup(value,count,draft.city === value,"data-overseas-city-value")
      ).join("");
    }
  }

  function renderCounts(){
    const jpCount = MUSEUMS.filter(museum => museum.scope === "jp").length;
    const overseasCount = MUSEUMS.filter(museum => museum.scope === "overseas").length;

    document.querySelectorAll('[data-tab-count="jp"],[data-scope-count="jp"]').forEach(el => el.textContent = jpCount);
    document.querySelectorAll('[data-tab-count="overseas"],[data-scope-count="overseas"]').forEach(el => el.textContent = overseasCount);
  }

  function renderTabs(){
    tabs.forEach(tab => {
      const active = tab.dataset.museumTab === applied.scope;
      tab.classList.toggle("is-active",active);
      tab.setAttribute("aria-selected",String(active));
    });
  }

  function renderActiveFilters(){
    if(!activeFilters) return;

    const entries = [];
    if(applied.keyword) entries.push(["keyword",applied.keyword,`「${applied.keyword}」`]);

    if(applied.scope === "jp"){
      if(applied.region) entries.push(["region",applied.region,applied.region]);
      if(applied.prefecture) entries.push(["prefecture",applied.prefecture,applied.prefecture]);
      if(applied.city) entries.push(["city",applied.city,applied.city]);
    }else if(applied.city){
      entries.push(["city",applied.city,applied.city]);
    }

    activeFilters.hidden = entries.length === 0;
    activeFilters.innerHTML = entries.map(([group,value,label]) =>
      `<button class="active-filter" type="button" data-remove-group="${group}" data-remove-value="${esc(value)}">${esc(label)}</button>`
    ).join("");
  }

  function render(){
    const museums = filteredMuseums();

    grid.innerHTML = museums.map(museum => {
      const place = museum.scope === "jp"
        ? [museum.prefecture,museum.city,museum.location].filter(Boolean).join(" · ")
        : [museum.country,museum.city].filter(Boolean).join(" · ");

      return `<a class="museum-list-card" data-save-type="museum" data-save-id="${esc(museum.id)}" href="./museum.html?id=${encodeURIComponent(museum.id)}" data-museum-id="${esc(museum.id)}">
        <div class="museum-list-image">
          <img src="${esc(museum.image)}" alt="${esc(museum.name)}" loading="lazy">
        </div>
        <small>${esc(place)}</small>
        <h2>${esc(museum.name)}</h2>
        <p>${esc(museum.category)}</p>
      </a>`;
    }).join("");

    countEl.textContent = museums.length;
    grid.hidden = museums.length === 0;
    empty.hidden = museums.length !== 0;

    resultLabel.textContent = applied.scope === "jp"
      ? `日本の美術館 · ${museums.length}件`
      : `海外の美術館 · ${museums.length}件`;

    renderTabs();
    renderActiveFilters();
  }

  function selectScope(scope,applyImmediately = false){
    const changed = draft.scope !== scope;

    draft.scope = scope;

    if(changed){
      draft.region = "";
      draft.prefecture = "";
      draft.city = "";
    }

    renderFilterOptions();

    if(applyImmediately){
      applied = {...draft};
      render();
    }
  }

  tabs.forEach(tab => {
    tab.addEventListener("click",() => {
      draft = {...applied};
      selectScope(tab.dataset.museumTab,true);
    });
  });

  scopeButtons.forEach(button => {
    button.addEventListener("click",() => {
      selectScope(button.dataset.scopeValue,false);
    });
  });

  regionOptions.addEventListener("click",event => {
    const button = event.target.closest("[data-region-value]");
    if(!button) return;
    const value = button.dataset.regionValue;
    draft.region = draft.region === value ? "" : value;
    draft.prefecture = "";
    draft.city = "";
    renderFilterOptions();
  });

  prefectureOptions.addEventListener("click",event => {
    const button = event.target.closest("[data-prefecture-value]");
    if(!button) return;
    const value = button.dataset.prefectureValue;
    draft.prefecture = draft.prefecture === value ? "" : value;
    draft.city = "";
    renderFilterOptions();
  });

  cityOptions.addEventListener("click",event => {
    const button = event.target.closest("[data-city-value]");
    if(!button) return;
    const value = button.dataset.cityValue;
    draft.city = draft.city === value ? "" : value;
    renderFilterOptions();
  });

  overseasCityOptions.addEventListener("click",event => {
    const button = event.target.closest("[data-overseas-city-value]");
    if(!button) return;
    const value = button.dataset.overseasCityValue;
    draft.city = draft.city === value ? "" : value;
    renderFilterOptions();
  });

  keywordInput?.addEventListener("input",() => {
    draft.keyword = keywordInput.value.trim();
    renderFilterOptions();
  });

  keywordInput?.addEventListener("keydown",event => {
    if(event.key !== "Enter") return;
    event.preventDefault();
    applied = {...draft,keyword:keywordInput.value.trim()};
    render();
    window.Muuzee?.filterSheet?.close?.();
  });

  applyButton?.addEventListener("click",() => {
    draft.keyword = keywordInput?.value.trim() || "";
    applied = {...draft};
    render();
    window.Muuzee?.filterSheet?.close?.();
  });

  resetButton?.addEventListener("click",() => {
    draft = {
      scope:applied.scope,
      keyword:"",
      region:"",
      prefecture:"",
      city:""
    };
    if(keywordInput) keywordInput.value = "";
    renderFilterOptions();
  });

  emptyReset?.addEventListener("click",() => {
    applied = {
      scope:applied.scope,
      keyword:"",
      region:"",
      prefecture:"",
      city:""
    };
    draft = {...applied};
    if(keywordInput) keywordInput.value = "";
    renderFilterOptions();
    render();
  });

  activeFilters?.addEventListener("click",event => {
    const button = event.target.closest("[data-remove-group]");
    if(!button) return;

    const group = button.dataset.removeGroup;

    if(group === "keyword"){
      applied.keyword = "";
      if(keywordInput) keywordInput.value = "";
    }else{
      applied[group] = "";

      if(group === "region"){
        applied.prefecture = "";
        applied.city = "";
      }

      if(group === "prefecture"){
        applied.city = "";
      }
    }

    draft = {...applied};
    renderFilterOptions();
    render();
  });

  document.addEventListener("click",event => {
    if(!event.target.closest("[data-filter-open]")) return;
    draft = {...applied};
    if(keywordInput) keywordInput.value = draft.keyword;
    renderFilterOptions();
  });

  renderCounts();
  renderFilterOptions();
  render();
})();
