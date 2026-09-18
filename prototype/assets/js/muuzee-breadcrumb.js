/* Muuzee Shared Breadcrumb / BreadcrumbList resolver */
(() => {
  "use strict";

  const mounts = new WeakMap();
  const routeName = () => location.pathname.split("/").pop() || "index.html";
  const absoluteUrl = href => new URL(href || location.href,document.baseURI).href;

  const findPageKey = (config,route = routeName()) =>
    Object.keys(config.pages || {}).find(key => config.pages[key].route === route);

  const normalizeFacets = (page,facets) => (Array.isArray(facets) ? facets : [])
    .filter(facet => facet && facet.label)
    .map((facet,index) => ({
      key:String(facet.key || `facet-${index}`),
      label:String(facet.label),
      href:facet.canonicalHref || "",
      indexable:facet.indexable === true && Boolean(facet.canonicalHref),
      order:Number(page.facets?.[facet.key]?.order ?? 1000),
      inputOrder:index
    }))
    .sort((a,b) => a.order - b.order || a.inputOrder - b.inputOrder);

  const resolve = ({config = window.MuuzeeSeoConfig,pageKey,currentLabel = "",facets = []} = {}) => {
    const key = pageKey || findPageKey(config);
    const page = config?.pages?.[key];
    if(!page || key === "home") return {pageKey:key,page,items:[],structuredData:false,ready:false};

    const chain = [];
    const visited = new Set();
    let cursorKey = key;
    while(cursorKey && !visited.has(cursorKey)){
      visited.add(cursorKey);
      const cursor = config.pages[cursorKey];
      if(!cursor) break;
      chain.unshift({
        key:cursorKey,
        label:cursor.dynamicLabel ? currentLabel : cursor.label,
        href:cursor.dynamicLabel ? location.href : cursor.href,
        indexable:cursor.indexable !== false
      });
      cursorKey = cursor.parent;
    }

    const ready = chain.every(item => Boolean(item.label));
    const baseItems = ready ? chain : chain.filter(item => item.label);
    const facetItems = normalizeFacets(page,facets);
    return {
      pageKey:key,
      page,
      ready,
      structuredData:page.structuredData === true && ready,
      items:[...baseItems,...facetItems]
    };
  };

  const createItem = (item,isCurrent) => {
    const li = document.createElement("li");
    if(!isCurrent && item.href){
      const link = document.createElement("a");
      link.href = item.href;
      link.textContent = item.label;
      li.append(link);
    }else{
      const span = document.createElement("span");
      span.textContent = item.label;
      if(isCurrent) span.setAttribute("aria-current","page");
      li.append(span);
    }
    return li;
  };

  const renderStructuredData = (root,model) => {
    root.querySelector("script[data-muuzee-breadcrumb-jsonld]")?.remove();
    if(!model.structuredData) return;

    const structuredItems = model.items.filter(item => item.indexable !== false && item.href);
    if(!structuredItems.length) return;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.muuzeeBreadcrumbJsonld = "";
    script.textContent = JSON.stringify({
      "@context":"https://schema.org",
      "@type":"BreadcrumbList",
      itemListElement:structuredItems.map((item,index) => ({
        "@type":"ListItem",
        position:index + 1,
        name:item.label,
        item:absoluteUrl(item.href)
      }))
    });
    root.append(script);
  };

  const mount = (root,options = {}) => {
    if(!root) return null;
    const state = {
      config:options.config || window.MuuzeeSeoConfig,
      pageKey:options.pageKey || root.dataset.breadcrumbPage || undefined,
      currentLabel:options.currentLabel || "",
      facets:[]
    };
    const render = () => {
      const model = resolve(state);
      root.replaceChildren();
      if(!model.items.length) return model;
      const nav = document.createElement("nav");
      nav.className = "muuzee-breadcrumb";
      nav.setAttribute("aria-label","パンくずリスト");
      const list = document.createElement("ol");
      model.items.forEach((item,index) => list.append(createItem(item,index === model.items.length - 1)));
      nav.append(list);
      root.append(nav);
      renderStructuredData(root,model);
      return model;
    };
    const api = {
      render,
      setCurrentLabel(label){state.currentLabel = String(label || ""); return render();},
      updateFacets(facets){state.facets = Array.isArray(facets) ? facets : []; return render();},
      setConditionSearch(active,label = "条件検索"){
        state.facets = active ? [{key:"condition",label,indexable:false,canonicalHref:""}] : [];
        return render();
      },
      getModel(){return resolve(state);}
    };
    mounts.set(root,api);
    render();
    return api;
  };

  const get = target => {
    const root = typeof target === "string" ? document.querySelector(target) : target;
    return root ? mounts.get(root) || null : null;
  };

  window.MuuzeeBreadcrumb = {findPageKey,resolve,mount,get};
  document.querySelectorAll("[data-muuzee-breadcrumb]").forEach(root => mount(root));
})();
