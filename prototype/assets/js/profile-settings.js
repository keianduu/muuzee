(() => {
  "use strict";

  const KEY = "muuzee:profile-settings:v1";
  const MAX_AVATAR_SOURCE_BYTES=20*1024*1024;
  const DEFAULTS = {
    avatar:"./assets/images/profile-avatar.jpg",
    nickname:"ashelry",
    email:"ashelry@example.com",
    newsletter:true,
    notifications:true,
    friendSearchVisible:true,
    location:{country:"日本",region:"関東",prefecture:"東京都",city:"多摩市"}
  };

  const REGIONS = {
    "北海道":["北海道"],
    "東北":["青森県","岩手県","宮城県","秋田県","山形県","福島県"],
    "関東":["茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県"],
    "中部":["新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県"],
    "近畿":["三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県"],
    "中国":["鳥取県","島根県","岡山県","広島県","山口県"],
    "四国":["徳島県","香川県","愛媛県","高知県"],
    "九州・沖縄":["福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"]
  };

  const CITIES = {
    "東京都":["千代田区","中央区","港区","新宿区","渋谷区","世田谷区","杉並区","練馬区","八王子市","立川市","武蔵野市","三鷹市","府中市","調布市","町田市","多摩市"],
    "神奈川県":["横浜市","川崎市","相模原市","鎌倉市","藤沢市"],
    "埼玉県":["さいたま市","川越市","川口市","所沢市"],
    "千葉県":["千葉市","船橋市","市川市","柏市"]
  };

  const form=document.querySelector("[data-profile-form]");
  if(!form) return;

  const feedbackDialog=document.querySelector("[data-profile-feedback-dialog]");
  const feedbackTitle=document.querySelector("[data-profile-feedback-title]");
  const feedbackMessage=document.querySelector("[data-profile-feedback-message]");
  const feedbackClose=document.querySelector("[data-profile-feedback-close]");

  const openFeedback=(title,message)=>{
    if(!feedbackDialog) return;
    if(feedbackTitle) feedbackTitle.textContent=title;
    if(feedbackMessage) feedbackMessage.textContent=message;
    feedbackDialog.showModal();
  };

  feedbackClose?.addEventListener("click",()=>feedbackDialog?.close());

  const profileAction=document.querySelector(".mypage-profile-settings");
  if(profileAction){
    profileAction.href="./my-art.html";
    profileAction.textContent="My Artに戻る →";
  }

  const read=()=>{
    try{
      const saved=JSON.parse(localStorage.getItem(KEY)||"{}");
      return {...DEFAULTS,...saved,location:{...DEFAULTS.location,...(saved.location||{})}};
    }catch{return structuredClone(DEFAULTS)}
  };

  let state=read();
  let locationDraft={...state.location};

  const avatar=document.querySelector("[data-avatar-preview]");
  const avatarInput=document.querySelector("[data-avatar-input]");
  const nickname=document.querySelector("[data-nickname]");
  const email=document.querySelector("[data-email]");
  const newsletter=document.querySelector("[data-newsletter]");
  const notifications=document.querySelector("[data-notifications]");
  const friendSearch=document.querySelector("[data-friend-search]");
  const locationSummary=document.querySelector("[data-location-summary]");
  const countries=document.querySelector("[data-countries]");
  const regions=document.querySelector("[data-regions]");
  const prefectures=document.querySelector("[data-prefectures]");
  const cities=document.querySelector("[data-cities]");
  const prefectureGroup=document.querySelector("[data-prefecture-group]");
  const cityGroup=document.querySelector("[data-city-group]");

  const setToggleLabel=input=>{
    const label=input.closest(".profile-toggle")?.querySelector("[data-toggle-text]");
    if(label) label.textContent=input.checked?"ON":"OFF";
  };

  const locationText=location=>[
    location.country,location.region,location.prefecture,location.city
  ].filter(Boolean).join(" / ")||"未設定";

  const makeChip=(value,selected,dataKey)=>{
    const button=document.createElement("button");
    button.type="button";
    button.className=`filter-chip${selected?" is-selected":""}`;
    button.dataset[dataKey]=value;
    button.textContent=value;
    return button;
  };

  const renderLocation=()=>{
    countries.replaceChildren(
      makeChip("日本",locationDraft.country==="日本","country"),
      makeChip("海外",locationDraft.country==="海外","country")
    );

    const isJapan=locationDraft.country==="日本";
    const regionGroup=regions.closest(".filter-group");

    if(regionGroup) regionGroup.hidden=!isJapan;
    prefectureGroup.hidden=!isJapan;
    cityGroup.hidden=!isJapan;

    if(!isJapan){
      regions.replaceChildren();
      prefectures.replaceChildren();
      cities.replaceChildren();
      return;
    }

    regions.replaceChildren(...Object.keys(REGIONS).map(value=>
      makeChip(value,locationDraft.region===value,"region")
    ));

    const prefList=locationDraft.region?REGIONS[locationDraft.region]||[]:[];
    prefectures.replaceChildren(...prefList.map(value=>
      makeChip(value,locationDraft.prefecture===value,"prefecture")
    ));
    prefectureGroup.hidden=!prefList.length;

    const cityList=CITIES[locationDraft.prefecture]||[];
    cities.replaceChildren(...cityList.map(value=>
      makeChip(value,locationDraft.city===value,"city")
    ));
    cityGroup.hidden=!cityList.length;
  };

  const render=()=>{
    avatar.src=state.avatar;
    nickname.value=state.nickname;
    email.value=state.email;
    newsletter.checked=state.newsletter!==false;
    notifications.checked=state.notifications!==false;
    friendSearch.checked=state.friendSearchVisible!==false;
    locationSummary.textContent=locationText(state.location);
    [newsletter,notifications,friendSearch].forEach(setToggleLabel);
  };
  /* profile-avatar-normalize:start */
  const normalizeAvatarFile=file=>new Promise((resolve,reject)=>{
    const reader=new FileReader();

    reader.onerror=()=>reject(new Error("read-failed"));

    reader.onload=()=>{
      const image=new Image();

      image.onerror=()=>reject(new Error("decode-failed"));

      image.onload=()=>{
        const sourceWidth=image.naturalWidth||image.width;
        const sourceHeight=image.naturalHeight||image.height;

        if(!sourceWidth||!sourceHeight){
          reject(new Error("invalid-size"));
          return;
        }

        const sourceSize=Math.min(sourceWidth,sourceHeight);
        const sourceX=Math.max(0,(sourceWidth-sourceSize)/2);
        const sourceY=Math.max(0,(sourceHeight-sourceSize)/2);

        const canvas=document.createElement("canvas");
        canvas.width=256;
        canvas.height=256;

        const context=canvas.getContext("2d");

        if(!context){
          reject(new Error("canvas-failed"));
          return;
        }

        context.imageSmoothingEnabled=true;
        context.imageSmoothingQuality="high";

        context.drawImage(
          image,
          sourceX,
          sourceY,
          sourceSize,
          sourceSize,
          0,
          0,
          256,
          256
        );

        resolve(canvas.toDataURL("image/webp",.92));
      };

      image.src=String(reader.result||"");
    };

    reader.readAsDataURL(file);
  });
  /* profile-avatar-normalize:end */

  /* profile-avatar-preset-selection:start */
  window.addEventListener(
    "muuzee:profile-avatar-select",
    event => {
      const source =
        String(
          event.detail?.src
          || ""
        );

      if (!source) {
        return;
      }

      state.avatar =
        source;

      avatar.src =
        source;

      form.dispatchEvent(
        new Event(
          "input",
          {
            bubbles:true
          }
        )
      );
    }
  );
  /* profile-avatar-preset-selection:end */

  avatarInput?.addEventListener("change",()=>{
    const file=avatarInput.files?.[0];
    if(!file||!file.type.startsWith("image/")) return;

    if(file.size>MAX_AVATAR_SOURCE_BYTES){
      alert("画像は20MB以下のものを選択してください。");
      avatarInput.value="";
      return;
    }
    const reader=new FileReader();
    reader.onload=()=>{
      if(typeof reader.result!=="string") return;
      state.avatar=reader.result;
      avatar.src=state.avatar;
    };
    reader.readAsDataURL(file);
  });

  [newsletter,notifications,friendSearch].forEach(input=>
    input.addEventListener("change",()=>setToggleLabel(input))
  );

  document.querySelector("[data-location-open]")?.addEventListener("click",()=>{
    locationDraft={...state.location};
    renderLocation();
  });

  countries.addEventListener("click",event=>{
    const button=event.target.closest("[data-country]");
    if(!button) return;

    locationDraft.country=button.dataset.country;
    locationDraft.region="";
    locationDraft.prefecture="";
    locationDraft.city="";
    renderLocation();
  });

  regions.addEventListener("click",event=>{
    const button=event.target.closest("[data-region]");
    if(!button) return;
    locationDraft.region=button.dataset.region;
    locationDraft.prefecture="";
    locationDraft.city="";
    renderLocation();
  });

  prefectures.addEventListener("click",event=>{
    const button=event.target.closest("[data-prefecture]");
    if(!button) return;
    locationDraft.prefecture=button.dataset.prefecture;
    locationDraft.city="";
    renderLocation();
  });

  cities.addEventListener("click",event=>{
    const button=event.target.closest("[data-city]");
    if(!button) return;
    locationDraft.city=button.dataset.city;
    renderLocation();
  });

  document.querySelector("[data-location-clear]")?.addEventListener("click",()=>{
    locationDraft={country:"日本",region:"",prefecture:"",city:""};
    renderLocation();
  });

  document.querySelector("[data-location-apply]")?.addEventListener("click",()=>{
    state.location={...locationDraft};
    locationSummary.textContent=locationText(state.location);
    window.Muuzee?.filterSheet?.close?.();
  });

  document.querySelector("[data-password]")?.addEventListener("click",()=>{
    alert("パスワード変更画面へ進みます（Prototype）。");
  });

  document.querySelector("[data-withdraw]")?.addEventListener("click",()=>{
    if(confirm("退会手続きへ進みますか？")){
      alert("退会確認画面へ進みます（Prototype）。");
    }
  });

  form.addEventListener("submit",event=>{
    event.preventDefault();
    if(!form.reportValidity()) return;

    state={
      ...state,
      nickname:nickname.value.trim(),
      email:email.value.trim(),
      newsletter:newsletter.checked,
      notifications:notifications.checked,
      friendSearchVisible:friendSearch.checked
    };

    try{
      localStorage.setItem(KEY,JSON.stringify(state));
      window.dispatchEvent(new CustomEvent("muuzee:profile-settings-change",{detail:{...state}}));
    }catch{
      alert("保存できませんでした。画像サイズを小さくして再度お試しください。");
    }
  });

  render();
  renderLocation();
})();

/* profile-avatar-delete-behavior:start */
(() => {








  const preview =
    document.querySelector(
      "[data-avatar-preview]"
    );

  const input =
    document.querySelector(
      "[data-avatar-input]"
    );

  if (
    !deleteButton
    || !dialog
    || !preview
  ) {
    return;
  }

  const DEFAULT_AVATAR =
    "./assets/images/profile-avatar.jpg";






})();
/* profile-avatar-delete-behavior:end */
