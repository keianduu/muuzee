/* Muuzee Artist Detail — page-specific profile / works / museum presentation */
(() => {
  "use strict";

  const catalog = window.MuuzeeArtistCatalog || [];
  if(!catalog.length) return;

  const DETAILS = {
    "草間彌生":{
      intro:"水玉や網目、反復するパターンを通して、自己と世界の境界が溶けていくような感覚を表現してきた日本を代表する現代美術家。絵画、彫刻、インスタレーションまで表現領域は広く、強い視覚性と身体的な鑑賞体験を併せ持ちます。",
      works:[["無限の鏡の間","1965–"],["かぼちゃ","1990年代–"],["Infinity Nets","1959–"]]
    },
    "クロード・モネ":{
      intro:"刻々と変化する光や大気、水面の反射を、色彩の重なりと素早い筆触で捉えた印象派を代表する画家。同じモティーフを時間や天候を変えて描く連作によって、見ることそのものの変化を絵画にしました。",
      works:[["印象・日の出","1872"],["睡蓮","1890年代–1920年代"],["散歩、日傘をさす女性","1875"]]
    },
    "フィンセント・ファン・ゴッホ":{
      intro:"強い色彩とリズミカルな筆触によって、風景や人物に自身の感覚を重ねたポスト印象派の画家。短い活動期間に数多くの作品を残し、その後の表現主義や20世紀美術に大きな影響を与えました。",
      works:[["星月夜","1889"],["ひまわり","1888–1889"],["夜のカフェテラス","1888"]]
    },
    "パブロ・ピカソ":{
      intro:"20世紀美術を大きく変えた画家・彫刻家。キュビスムをはじめ、古典的表現から大胆な造形実験まで生涯を通してスタイルを更新し続け、絵画の見方そのものに大きな影響を与えました。",
      works:[["アヴィニョンの娘たち","1907"],["ゲルニカ","1937"],["泣く女","1937"]]
    },
    "奈良美智":{
      intro:"大きな頭部と鋭いまなざしを持つ子どもの像で知られる現代美術家。かわいらしさと反抗心、孤独や静けさが同居する人物像を通して、見る側の記憶や感情を揺さぶります。",
      works:[["Miss Forest","2010"],["Knife Behind Back","2000"],["The Little Ambassador","2000"]]
    },
    "アンディ・ウォーホル":{
      intro:"広告や商品、セレブリティのイメージを反復し、大量消費社会と芸術の境界を問い直したポップアートの代表的存在。シルクスクリーンによる反復と鮮烈な色彩は、現代の視覚文化にも大きな影響を残しています。",
      works:[["Marilyn Diptych","1962"],["Campbell's Soup Cans","1962"],["Shot Marilyns","1964"]]
    }
  };

  const params = new URLSearchParams(location.search);
  const requested = params.get("name");
  const artist = catalog.find(item => item.name === requested) || catalog[0];
  const detail = DETAILS[artist.name] || {
    intro:`${(artist.category || []).join("、")}の文脈で知られる${artist.name}。作品の背景や時代との関係を知ることで、展示で作品に出会ったときの見え方がより立体的になります。Muuzeeでは代表作、展覧会、所蔵美術館を一つのプロフィールとしてまとめます。`,
    works:[[`${artist.name} 代表作 I`,"—"],[`${artist.name} 代表作 II`,"—"],[`${artist.name} 代表作 III`,"—"]]
  };

  const esc = value => String(value ?? "").replace(/[&<>"']/g,char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));

  const hero = document.querySelector("[data-artist-hero]");
  if(hero){
    hero.src = artist.image || artist.img || "";
    hero.alt = artist.name;
    hero.style.setProperty("--artist-position",artist.position || "center");
  }

  document.title = `${artist.name} — Muuzee`;
  window.MuuzeeBreadcrumb?.get("[data-muuzee-breadcrumb]")?.setCurrentLabel(artist.name);
  const detailHead = window.MuuzeeDetailHead?.mount("[data-muuzee-detail-head]");
  detailHead?.setTitle(artist.name);
  detailHead?.setSub([artist.country || "",(artist.eras || []).join(" / ")].filter(Boolean).join(" · "));
  detailHead?.setMeta((artist.category || []).map(category => ({text:category})));
  document.querySelector("[data-artist-style]").textContent = (artist.category || []).join(" / ");
  document.querySelector("[data-artist-country]").textContent = artist.country || "";
  document.querySelector("[data-artist-era]").textContent = (artist.eras || []).join(" / ");
  document.querySelector("[data-artist-intro]").textContent = detail.intro;

  const workStorageKey = `muuzee:saved-works:${artist.name}`;
  const getSavedWorks = () => {
    try{return JSON.parse(localStorage.getItem(workStorageKey) || "[]")}catch{return []}
  };
  const setSavedWorks = works => localStorage.setItem(workStorageKey,JSON.stringify(works));
  const worksEl = document.querySelector("[data-famous-works]");

  const renderWorks = () => {
    if(!worksEl) return;
    const saved = getSavedWorks();
    worksEl.innerHTML = detail.works.map((work,index) => {
      const [name,year] = work;
      const isSaved = saved.includes(name);
      return `<article class="work-item">
        <div class="work-copy"><span class="work-number">${String(index + 1).padStart(2,"0")}</span><h3 class="work-name">${esc(name)}</h3><span class="work-year">${esc(year)}</span></div>
        <button class="work-save${isSaved ? " is-saved" : ""}" type="button" data-work-save="${esc(name)}" aria-label="${esc(name)}を保存" aria-pressed="${isSaved}"><svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4Z"></path></svg></button>
      </article>`;
    }).join("");
  };
  renderWorks();

  worksEl?.addEventListener("click",event => {
    const button = event.target.closest("[data-work-save]");
    if(!button) return;
    const name = button.dataset.workSave;
    const saved = getSavedWorks();
    const next = saved.includes(name) ? saved.filter(item => item !== name) : [...saved,name];
    setSavedWorks(next);
    renderWorks();
  });

  const artistSave = document.querySelector("[data-artist-save]");
  const artistStorageKey = "muuzee:saved-artists";
  const getSavedArtists = () => {
    try{return JSON.parse(localStorage.getItem(artistStorageKey) || "[]")}catch{return []}
  };
  const syncArtistSave = () => {
    if(!artistSave) return;
    const saved = getSavedArtists().includes(artist.name);
    artistSave.classList.toggle("is-saved",saved);
    artistSave.setAttribute("aria-pressed",String(saved));
    const label = artistSave.querySelector("span");
    if(label) label.textContent = saved ? "保存済み" : "保存";
  };
  artistSave?.addEventListener("click",() => {
    const saved = getSavedArtists();
    const next = saved.includes(artist.name) ? saved.filter(name => name !== artist.name) : [...saved,artist.name];
    localStorage.setItem(artistStorageKey,JSON.stringify(next));
    syncArtistSave();
  });
  syncArtistSave();

  const museumsEl = document.querySelector("[data-museums]");
  if(museumsEl){
    const collection = window.MuuzeeArtistCollections?.resolve(artist.id) || {items:[]};
    museumsEl.innerHTML = collection.items.length ? collection.items.map(museum => {
      const titles = museum.works.map(work => work.displayTitle).filter(Boolean).slice(0,3);
      const workSummary = titles.length
        ? ` · ${titles.map(title => `《${esc(title)}》`).join("、")}${museum.workCount > titles.length ? " ほか" : ""}`
        : "";
      return `<article class="museum-card" data-save-type="museum" data-save-id="${esc(museum.id)}">
        <a class="museum-card-main" href="${esc(museum.href)}">
          <small>${esc(museum.location)}</small><h3>${esc(museum.name)}</h3>
          <p>所蔵作品 ${museum.workCount}件${workSummary}</p>
        </a>
      </article>`;
    }).join("") : '<p class="artist-empty-copy">所蔵情報を確認中です。</p>';
    window.Muuzee?.saveControl?.scan?.(museumsEl);
  }

  // Current exhibitions and related artists are owned by MuuzeeSurfaceRuntime.
})();
