/* Muuzee Artist List — page specific */
(async () => {
  "use strict";

  const ARTISTS = window.MuuzeeDataSource
    ? await window.MuuzeeDataSource.loadArtists()
    : (window.MuuzeeArtistCatalog || []);

  const grid = document.querySelector("[data-artist-grid]");
  const count = document.querySelector("[data-artist-count]");
  const empty = document.querySelector("[data-artist-empty]");
  const activeFilters = document.querySelector("[data-active-filters]");
  const keyword = document.querySelector("[data-keyword]");
  const applyButton = document.querySelector("[data-filter-apply]");
  const resetButton = document.querySelector("[data-filter-reset]");
  const emptyReset = document.querySelector("[data-empty-reset]");
  const countrySection = document.querySelector("[data-country-section]");
  const groups = [...document.querySelectorAll("[data-filter-group]")];

  if(!grid) return;

  const esc = value => String(value).replace(/[&<>"']/g,char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));

  function selectedValues(groupName){
    const group = document.querySelector(`[data-filter-group="${groupName}"]`);
    if(!group) return [];
    return [...group.querySelectorAll(".filter-chip.is-selected")].map(button => button.dataset.value);
  }

  function currentFilters(){
    return {
      keyword:(keyword?.value || "").trim().toLowerCase(),
      category:selectedValues("category"),
      origin:selectedValues("origin"),
      country:selectedValues("country"),
      era:selectedValues("era")
    };
  }

  function matchesAny(source, selected){
    if(!selected.length) return true;
    const values = Array.isArray(source) ? source : [source];
    return selected.some(value => values.includes(value));
  }

  function filteredArtists(){
    const filters = currentFilters();
    return ARTISTS.filter(artist => {
      if(filters.keyword && !artist.name.toLowerCase().includes(filters.keyword)) return false;
      if(!matchesAny(artist.category,filters.category)) return false;
      if(!matchesAny(artist.origin,filters.origin)) return false;
      if(!matchesAny(artist.country,filters.country)) return false;
      if(!matchesAny(artist.eras,filters.era)) return false;
      return true;
    });
  }

  function primaryMeta(artist){
    if(artist.origin === "日本人") return `${artist.category[0]} · 日本`;
    return `${artist.category[0]} · ${artist.country}`;
  }

  function render(){
    const artists = filteredArtists();
    grid.innerHTML = artists.map(artist => `
      <a class="artist-card" data-save-type="artist" data-save-id="${esc(artist.name)}" href="./artist.html?name=${encodeURIComponent(artist.name)}" aria-label="${esc(artist.name)}">
        <div class="artist-avatar"><img src="${esc(artist.image)}" alt="" loading="lazy" style="object-position:${esc(artist.position || 'center')}"></div>
        <strong>${esc(artist.name)}</strong>
        <span>${esc(primaryMeta(artist))}</span>
      </a>
    `).join("");

    if(count) count.textContent = artists.length;
    if(empty) empty.hidden = artists.length !== 0;
    grid.hidden = artists.length === 0;
    renderActiveFilters();
  }

  function renderActiveFilters(){
    if(!activeFilters) return;
    const filters = currentFilters();
    const entries = [];
    if(filters.keyword) entries.push({group:"keyword",value:keyword.value,label:`「${keyword.value}」`});
    ["category","origin","country","era"].forEach(group => {
      filters[group].forEach(value => entries.push({group,value,label:value}));
    });

    activeFilters.hidden = entries.length === 0;
    activeFilters.innerHTML = entries.map(entry => `
      <button class="active-filter" type="button" data-remove-group="${esc(entry.group)}" data-remove-value="${esc(entry.value)}">${esc(entry.label)}</button>
    `).join("");
  }

  function syncCountrySection(){
    const japaneseSelected = selectedValues("origin").includes("日本人");
    const foreignSelected = selectedValues("origin").includes("外国人");
    const japaneseOnly = japaneseSelected && !foreignSelected;
    if(countrySection) countrySection.hidden = japaneseOnly;
    if(japaneseOnly){
      countrySection?.querySelectorAll(".filter-chip.is-selected").forEach(button => button.classList.remove("is-selected"));
    }
  }

  groups.forEach(group => {
    group.addEventListener("click",event => {
      const button = event.target.closest(".filter-chip");
      if(!button) return;
      const single = group.hasAttribute("data-single-select");
      if(single){
        const wasSelected = button.classList.contains("is-selected");
        group.querySelectorAll(".filter-chip").forEach(chip => chip.classList.remove("is-selected"));
        if(!wasSelected) button.classList.add("is-selected");
      }else{
        button.classList.toggle("is-selected");
      }
      syncCountrySection();
    });
  });

  function resetFilters(){
    groups.forEach(group => group.querySelectorAll(".filter-chip.is-selected").forEach(button => button.classList.remove("is-selected")));
    if(keyword) keyword.value = "";
    if(countrySection) countrySection.hidden = false;
    render();
  }

  applyButton?.addEventListener("click",() => {
    render();
    window.Muuzee?.filterSheet?.close();
  });
  resetButton?.addEventListener("click",resetFilters);
  emptyReset?.addEventListener("click",resetFilters);

  activeFilters?.addEventListener("click",event => {
    const button = event.target.closest("[data-remove-group]");
    if(!button) return;
    const group = button.dataset.removeGroup;
    const value = button.dataset.removeValue;
    if(group === "keyword"){
      if(keyword) keyword.value = "";
    }else{
      document.querySelector(`[data-filter-group="${group}"] .filter-chip[data-value="${CSS.escape(value)}"]`)?.classList.remove("is-selected");
    }
    syncCountrySection();
    render();
  });

  keyword?.addEventListener("keydown",event => {
    if(event.key === "Enter"){
      event.preventDefault();
      render();
      window.Muuzee?.filterSheet?.close();
    }
  });

  render();
})();
