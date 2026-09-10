/* Muuzee MyPage TOP */
(() => {
  "use strict";

  const esc = value => String(value ?? "").replace(/[&<>"']/g,char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));

  const exhibitions = window.MuuzeeExhibitionCatalog || [];
  const museums = window.MuuzeeMuseumCatalog || [];
  const artists = window.MuuzeeArtistCatalog || [];

  const fallbackWall = Array.from({length:9},(_,index) => ({
    id:`wall-${index+1}`,
    title:`ArtWall ${index+1}`,
    src:`./assets/images/exhibitions/exhibition-${String(index+1).padStart(2,"0")}.jpg`,
    href:"./exhibitions.html"
  }));

  /* shared-artwall-store-consumer:start */
  const artwallStore = window.MuuzeeArtWallStore || null;
  const artwallDataSource = window.MuuzeeArtWallDataSource || null;
  const artwallSettings = artwallStore?.get?.() || {schemaVersion:0,columns:4};

  const fallbackBaseItems = exhibitions.length
    ? exhibitions.map(item => ({
        ...item,
        src:item.src,
        href:item.href || `./exhibition.html?id=${encodeURIComponent(item.id)}`
      }))
    : fallbackWall;

  const sourceItems = artwallDataSource?.getAllItems?.() || fallbackBaseItems;
  const hasCommittedMembership =
    Number(artwallSettings.schemaVersion) === Number(artwallStore?.schemaVersion ?? 1)
    && Array.isArray(artwallSettings.exhibitionOrder)
    && artwallSettings.exhibitionOrder.length > 0;

  const selectedItems = hasCommittedMembership
    ? (artwallStore?.selectItems?.(sourceItems) || sourceItems)
    : (artwallDataSource?.getInitialItems?.() || fallbackBaseItems);

  const maxItems = Number(artwallDataSource?.config?.maxItems) || 30;
  const wallItems = selectedItems.slice(0,maxItems).map(item => {
    const imageData = window.Muuzee?.getArtWallImageData?.(item.src);
    return {
      ...item,
      artwallSrc:imageData?.thumb || item.src,
      artwallRatio:Number(imageData?.ratio) || null
    };
  });
  /* shared-artwall-store-consumer:end */

  let renderToken = 0;
  const ARTWALL_IMAGE_READY_TIMEOUT = 12000;

  const waitForWallImage = image => new Promise(resolve => {
    if (image.complete && image.naturalWidth > 0) {
      resolve(true);
      return;
    }

    let finished = false;
    const finish = success => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      image.removeEventListener("load",loaded);
      image.removeEventListener("error",failed);
      resolve(success);
    };
    const loaded = () => finish(image.naturalWidth > 0);
    const failed = () => finish(false);
    const timer = setTimeout(
      () => finish(image.complete && image.naturalWidth > 0),
      ARTWALL_IMAGE_READY_TIMEOUT
    );

    image.addEventListener("load",loaded,{once:true});
    image.addEventListener("error",failed,{once:true});
  });

  const waitForWallImages = async grid => {
    const images = Array.from(grid.querySelectorAll("img"));
    const results = await Promise.all(images.map(waitForWallImage));
    return {
      complete:images.length > 0 && results.every(Boolean),
      count:images.length,
      failed:results.filter(value => !value).length
    };
  };

  async function renderWall(){
    const grid = document.querySelector("[data-mypage-wall-grid]");
    if (!grid || !window.Muuzee?.layoutMasonry) {
      return {complete:false,count:0,failed:0};
    }

    artwallStore?.applyPresentation?.(grid.closest(".artwall"));
    const token = ++renderToken;

    await window.Muuzee.layoutMasonry({
      grid,
      items:wallItems,
      getSrc:item => item.artwallSrc,
      getRatio:item => item.artwallRatio,
      columns:Number(artwallSettings.columns) === 3 ? 3 : 4,
      gapDesktop:8,
      gapMobile:4,
      renderItem:(item,_geometry,index) => {
        if (token !== renderToken) return null;

        const link = document.createElement("a");
        link.className = "wall-item";
        link.href = item.href || "./exhibitions.html";
        if (item.id) link.dataset.exhibitionId = String(item.id);
        link.setAttribute("aria-label",item.title || "ArtWall item");

        const img = document.createElement("img");
        img.src = item.artwallSrc;
        img.alt = item.title || "";
        img.loading = "eager";
        img.decoding = "async";
        try { img.fetchPriority = index < 4 ? "high" : "auto"; } catch (_) {}

        link.appendChild(img);
        return link;
      }
    });

    if (token !== renderToken) return {complete:false,count:0,failed:0};

    const ready = await waitForWallImages(grid);
    if (token !== renderToken) return {complete:false,count:ready.count,failed:ready.failed};

    window.dispatchEvent(new CustomEvent("muuzee:artwall-ready",{
      detail:{...ready,source:"my-art"}
    }));

    return ready;
  }

  const startWallRender = () => {
    const promise = renderWall();
    window.MuuzeeArtWallReady = promise;
    return promise;
  };

  startWallRender();

  const readArray = key => {
    try{
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    }catch{
      return [];
    }
  };


  /* saved-exhibition-schedule:start */
  function parseDatePart(text,fallbackYear){
    const parts = String(text || "")
      .trim()
      .split(/[.\-/]/)
      .map(Number)
      .filter(Number.isFinite);

    if(parts.length === 3){
      return {
        year:parts[0],
        month:parts[1],
        day:parts[2]
      };
    }

    if(parts.length === 2 && fallbackYear){
      return {
        year:fallbackYear,
        month:parts[0],
        day:parts[1]
      };
    }

    return null;
  }

  function parseExhibitionRange(item){
    const raw = String(item?.date || "").trim();
    const parts = raw.split(/\s*[—–]\s*/);

    if(parts.length !== 2) return null;

    const startPart = parseDatePart(parts[0]);
    if(!startPart) return null;

    const endPart = parseDatePart(parts[1],startPart.year);
    if(!endPart) return null;

    return {
      start:new Date(
        startPart.year,
        startPart.month - 1,
        startPart.day,
        0,0,0,0
      ),
      end:new Date(
        endPart.year,
        endPart.month - 1,
        endPart.day,
        23,59,59,999
      )
    };
  }

  function monthStart(date){
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      1
    );
  }

  function addMonths(date,count){
    return new Date(
      date.getFullYear(),
      date.getMonth() + count,
      1
    );
  }

  function monthEnd(date){
    return new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0,
      23,59,59,999
    );
  }

  function overlapsMonth(range,month){
    return (
      range
      && range.start <= monthEnd(month)
      && range.end >= monthStart(month)
    );
  }

  function scheduleStatus(range){
    const now = new Date();

    if(now < range.start){
      return {
        label:"開催前",
        className:"is-upcoming"
      };
    }

    if(now > range.end){
      return {
        label:"終了",
        className:"is-ended"
      };
    }

    return {
      label:"開催中",
      className:"is-now"
    };
  }

  function venueHref(venue){
    const normalized = String(venue || "").trim();

    const museum = museums.find(item =>
      String(item.name || "").trim() === normalized
    );

    if(museum){
      return `./museum.html?id=${encodeURIComponent(museum.id)}`;
    }

    return `./museums.html?keyword=${encodeURIComponent(normalized)}`;
  }

  function renderSavedExhibitionSchedule(){
    const monthsEl = document.querySelector(
      "[data-saved-schedule-months]"
    );
    const listEl = document.querySelector(
      "[data-saved-schedule-list]"
    );

    if(!monthsEl || !listEl) return;

    const savedIds = readArray("muuzee:saved-exhibitions");

    const items = savedIds
      .map(id =>
        exhibitions.find(item =>
          item.id === id || item.title === id
        )
      )
      .filter(Boolean)
      .map(item => ({
        ...item,
        range:parseExhibitionRange(item)
      }))
      .filter(item => item.range)
      .sort((a,b) => a.range.start - b.range.start);

    /*
      Match the reference: previous month + current month + next 2 months.
      On 2026-09-01 this becomes Aug / Sep / Oct / Nov.
    */
    const currentMonth = monthStart(new Date());
    const months = [
      addMonths(currentMonth,-1),
      currentMonth,
      addMonths(currentMonth,1),
      addMonths(currentMonth,2)
    ];

    let activeIndex = 1;

    const renderMonths = () => {
      monthsEl.innerHTML = months.map((month,index) => `
        <button
          class="mypage-schedule-month${index === activeIndex ? " is-active" : ""}"
          type="button"
          data-schedule-month="${index}"
          aria-pressed="${String(index === activeIndex)}"
        >
          <small>${month.getFullYear()}</small>
          <strong>${month.getMonth() + 1}月</strong>
        </button>
      `).join("");
    };

    const renderList = () => {
      const month = months[activeIndex];

      const visible = items.filter(item =>
        overlapsMonth(item.range,month)
      );

      if(!visible.length){
        listEl.innerHTML = `
          <div class="mypage-schedule-empty">
            この月に開催される保存済み展示会はありません。
          </div>
        `;
        return;
      }

      listEl.innerHTML = visible.map(item => {
        const status = scheduleStatus(item.range);

        const exhibitionHref =
          item.href
          || `./exhibition.html?id=${encodeURIComponent(item.id)}`;

        return `
          <article class="mypage-schedule-item">
            <div class="mypage-schedule-date">
              ${esc(item.date || "")}
            </div>

            <div class="mypage-schedule-content">
              <a
                class="mypage-schedule-title"
                href="${esc(exhibitionHref)}"
              >
                ${esc(item.title || "")}
              </a>

              <a
                class="mypage-schedule-venue"
                href="${esc(venueHref(item.venue))}"
              >
                ${esc(item.venue || "")}
              </a>

              <div class="mypage-schedule-row-actions">
                <span
                  class="mypage-schedule-status ${esc(status.className)}"
                >
                  ${esc(status.label)}
                </span>

                <button
                  class="muuzee-personal-action muuzee-personal-action--compact"
                  type="button"
                  data-personal-action="seen"
                  data-personal-type="exhibition"
                  data-personal-id="${esc(item.id)}"
                  aria-pressed="false"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="9"></circle>
                    <path d="m8 12 2.6 2.6L16.5 9"></path>
                  </svg>
                  <span data-personal-action-label>観た</span>
                </button>
              </div>
            </div>
          </article>
        `;
      }).join("");
    };

    monthsEl.addEventListener("click",event => {
      const button = event.target.closest(
        "[data-schedule-month]"
      );

      if(!button) return;

      activeIndex =
        Number(button.dataset.scheduleMonth) || 0;

      renderMonths();
      renderList();
    });

    renderMonths();
    renderList();
  }

  renderSavedExhibitionSchedule();
  /* saved-exhibition-schedule:end */

  const friendRail = document.querySelector("[data-preview-friends]");
  if(friendRail){
    const demo = [
      {name:"Mina",lastActiveDays:2,image:"./assets/images/mypage/friend-mina.jpg"},
      {name:"Ryo",lastActiveDays:5,image:"./assets/images/mypage/friend-ryo.jpg"},
      {name:"Nao",lastActiveDays:42,image:"./assets/images/mypage/friend-nao.jpg"},
      {name:"Saki",lastActiveDays:118,image:"./assets/images/mypage/friend-saki.jpg"},
      {name:"Jun",lastActiveDays:248,image:"./assets/images/mypage/friend-jun.jpg"}
    ];

    const activityState = days => {
      if(days <= 7) return {className:"is-recent",label:"直近1週間以内にアクセス"};
      if(days <= 183) return {className:"is-warm",label:"半年以内にアクセス"};
      return {className:"is-dormant",label:"半年以内のアクセスなし"};
    };

    friendRail.innerHTML = demo.map(friend => {
      const activity = activityState(friend.lastActiveDays);
      return `
        <a class="mypage-preview-person" href="./friends.html" aria-label="${esc(friend.name)}">
          <div class="mypage-friend-avatar">
            <img src="${esc(friend.image)}" alt="${esc(friend.name)}" loading="lazy">
            <i class="mypage-friend-status ${activity.className}" aria-label="${esc(activity.label)}" title="${esc(activity.label)}"></i>
          </div>
          <strong>${esc(friend.name)}</strong>
        </a>
      `;
    }).join("");
  }

  const groupRail = document.querySelector("[data-preview-groups]");
  if(groupRail){
    const groups = [
      {
        title:"Tokyo Contemporary",
        members:124,
        background:"./assets/images/mypage/group-contemporary.jpg",
        hasNewComment:true,
        participants:["./assets/images/mypage/friend-mina.jpg","./assets/images/mypage/friend-ryo.jpg","./assets/images/mypage/friend-nao.jpg","./assets/images/mypage/friend-saki.jpg","./assets/images/mypage/friend-jun.jpg","./assets/images/mypage/friend-ryo.jpg"]
      },
      {
        title:"Weekend Museum Club",
        members:38,
        background:"./assets/images/mypage/group-museum.jpg",
        hasNewComment:false,
        participants:["./assets/images/mypage/friend-jun.jpg","./assets/images/mypage/friend-nao.jpg","./assets/images/mypage/friend-mina.jpg","./assets/images/mypage/friend-saki.jpg"]
      },
      {
        title:"Architecture & Art",
        members:16,
        background:"./assets/images/mypage/group-architecture.jpg",
        hasNewComment:true,
        participants:["./assets/images/mypage/friend-nao.jpg","./assets/images/mypage/friend-mina.jpg","./assets/images/mypage/friend-jun.jpg","./assets/images/mypage/friend-ryo.jpg","./assets/images/mypage/friend-saki.jpg","./assets/images/mypage/friend-mina.jpg","./assets/images/mypage/friend-jun.jpg"]
      }
    ];

    groupRail.innerHTML = groups.map(group => {
      const shown = group.participants.slice(0,5);
      const hasMore = group.participants.length > 5;

      return `
        <a class="mypage-group-card is-rich" href="./groups.html">
          <div class="mypage-group-cover" style="background-image:url('${esc(group.background)}')">
            ${group.hasNewComment ? `
              <span class="mypage-group-comment-badge"><i aria-hidden="true"></i>新着コメントあり</span>
            ` : ""}
          </div>
          <div class="mypage-group-body">
            <strong>${esc(group.title)}</strong>
            <span class="mypage-group-member-count">${esc(String(group.members))} members</span>
            <div class="mypage-group-members" aria-label="参加者">
              ${shown.map((image,index) => `
                <img src="${esc(image)}" alt="" loading="lazy" style="z-index:${shown.length - index}">
              `).join("")}
              ${hasMore ? `<span class="mypage-group-members-more" aria-label="他の参加者">+</span>` : ""}
            </div>
          </div>
        </a>
      `;
    }).join("");
  }



  /* scroll-resize-redraw-guard:start
     Mobile Safari / PWA can emit window.resize while scrolling because
     browser chrome changes viewport height. ArtWall membership must not be
     rebuilt for height-only changes.

     On the dedicated ArtWall editor, artwall-edit-columns.js owns responsive
     relayout after the initial render, so mypage-home must not redraw there.
  */
  if (!document.body.classList.contains("artwall-edit-page")) {
    let resizeTimer;
    let lastWallGridWidth = Math.round(
      document.querySelector("[data-mypage-wall-grid]")?.clientWidth || 0
    );

    window.addEventListener("resize",() => {
      const grid = document.querySelector("[data-mypage-wall-grid]");
      const nextWidth = Math.round(grid?.clientWidth || 0);

      if (
        !nextWidth
        || (
          lastWallGridWidth
          && Math.abs(nextWidth - lastWallGridWidth) < 2
        )
      ) {
        return;
      }

      lastWallGridWidth = nextWidth;

      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(startWallRender,120);
    });
  }
  /* scroll-resize-redraw-guard:end */
})();
