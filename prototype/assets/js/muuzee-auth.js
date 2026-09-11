/* Muuzee Prototype Auth
   Prototype-only authentication facade.
   Current state: URL ?loginID=...
   Future production adapter: session/cookie/token + API/DB. */
(() => {
  "use strict";

  const LOCAL_USERS_KEY = "muuzee:prototype-users:v1";
  const PROFILE_KEY = "muuzee:profile-settings:v1";
  const LOGIN_PARAM = "loginID";
  const PROTECTED_PAGES = new Set([
    "my-art.html",
    "profile-settings.html"
  ]);

  const scriptUrl = document.currentScript?.src || "";
  const jsBase = scriptUrl
    ? new URL(".", scriptUrl)
    : new URL("./assets/js/", location.href);

  let users = [];
  let currentUser = null;
  let pendingAfterAuthHref = "";
  let dialog = null;
  let tooltip = null;
  let homeArtWallOriginal = null;
  let routingInstalled = false;

  const clone = value => JSON.parse(JSON.stringify(value));

  const normalizeEmail = value =>
    String(value || "").trim().toLowerCase();

  const pageName = pathname =>
    String(pathname || "")
      .split("/")
      .filter(Boolean)
      .pop()
      || "index.html";

  const readLocalUsers = () => {
    try{
      const value = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    }catch{
      return [];
    }
  };

  const writeLocalUsers = value => {
    localStorage.setItem(
      LOCAL_USERS_KEY,
      JSON.stringify(Array.isArray(value) ? value : [])
    );
  };

  const staticUsers = () =>
    Array.isArray(window.MuuzeePrototypeUserConfig?.users)
      ? window.MuuzeePrototypeUserConfig.users
      : [];

  const rebuildUsers = () => {
    const byId = new Map();

    [...staticUsers(), ...readLocalUsers()].forEach(user => {
      if(!user?.loginID) return;
      byId.set(String(user.loginID), {
        ...user,
        loginID:String(user.loginID),
        email:normalizeEmail(user.email)
      });
    });

    users = [...byId.values()];
    return users;
  };

  const loadConfig = () => {
    if(window.MuuzeePrototypeUserConfig){
      return Promise.resolve(window.MuuzeePrototypeUserConfig);
    }

    return new Promise(resolve => {
      const node = document.createElement("script");
      node.src = new URL(
        "muuzee-user-config.js?v=20260911-login-prototype-02",
        jsBase
      ).href;
      node.async = true;
      node.onload = () => resolve(window.MuuzeePrototypeUserConfig || null);
      node.onerror = () => resolve(null);
      document.head.appendChild(node);
    });
  };

  const userByLoginID = loginID =>
    users.find(user => user.loginID === String(loginID || "")) || null;

  const userByCredentials = (email,password) =>
    users.find(user =>
      normalizeEmail(user.email) === normalizeEmail(email)
      && String(user.password || "") === String(password || "")
    ) || null;

  const cleanUnknownLoginID = () => {
    const url = new URL(location.href);
    if(!url.searchParams.has(LOGIN_PARAM)) return;

    url.searchParams.delete(LOGIN_PARAM);
    history.replaceState(
      history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  };

  const refreshFromLocation = () => {
    rebuildUsers();

    const requested = new URLSearchParams(location.search).get(LOGIN_PARAM);
    currentUser = requested ? userByLoginID(requested) : null;

    if(requested && !currentUser){
      cleanUnknownLoginID();
    }

    return currentUser;
  };

  const isLoggedIn = () => Boolean(currentUser);

  const currentLoginID = () => currentUser?.loginID || "";

  const withLoginParam = href => {
    if(!isLoggedIn()) return String(href || "");

    try{
      const url = new URL(href, location.href);
      if(url.origin !== location.origin) return String(href || "");
      url.searchParams.set(LOGIN_PARAM, currentLoginID());
      return url.href;
    }catch{
      return String(href || "");
    }
  };

  const dispatchAuthChange = () => {
    syncAuthDependentUI();

    window.dispatchEvent(
      new CustomEvent("muuzee:auth-change",{
        detail:{
          loggedIn:isLoggedIn(),
          loginID:currentLoginID(),
          user:currentUser ? clone(currentUser) : null
        }
      })
    );
  };

  const setCurrentUser = user => {
    currentUser = user || null;

    const url = new URL(location.href);

    if(currentUser?.loginID){
      url.searchParams.set(LOGIN_PARAM,currentUser.loginID);
    }else{
      url.searchParams.delete(LOGIN_PARAM);
    }

    history.replaceState(
      history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );

    dispatchAuthChange();
  };

  const syncSeenButtons = () => {
    document
      .querySelectorAll('[data-personal-action="seen"]')
      .forEach(button => {
        button.hidden = !isLoggedIn();
      });
  };

  const protectedPage = () =>
    PROTECTED_PAGES.has(pageName(location.pathname));

  const syncProtectedPage = () => {
    const blocked = protectedPage() && !isLoggedIn();
    document.body?.classList.toggle("muuzee-auth-protected",blocked);

    if(blocked){
      window.requestAnimationFrame(() => {
        openLogin({mode:"login"});
      });
    }
  };

  const captureHomeArtWall = section => {
    if(homeArtWallOriginal) return homeArtWallOriginal;

    const title = section.querySelector(".section-head h2");
    const cta = section.querySelector(".section-head .muuzee-section-cta");
    const copy = section.querySelector(".artwall-copy");

    if(!title || !cta || !copy) return null;

    homeArtWallOriginal = {
      title:title.textContent,
      ctaText:cta.textContent,
      ctaHref:cta.getAttribute("href") || "./my-art.html",
      copyHtml:copy.innerHTML
    };

    return homeArtWallOriginal;
  };

  const syncHomeArtWall = () => {
    const section = document.querySelector("#artwall");
    if(!section) return;

    const original = captureHomeArtWall(section);
    if(!original) return;

    const title = section.querySelector(".section-head h2");
    const cta = section.querySelector(".section-head .muuzee-section-cta");
    const copy = section.querySelector(".artwall-copy");

    if(!title || !cta || !copy) return;

    if(isLoggedIn()){
      section.classList.remove("is-muuzee-auth-guest");
      title.textContent = original.title;
      cta.textContent = original.ctaText;
      cta.setAttribute("href",original.ctaHref);
      cta.removeAttribute("role");
      cta.removeAttribute("data-muuzee-login-trigger");
      cta.removeAttribute("data-muuzee-auth-after");
      copy.innerHTML = original.copyHtml;
      window.MuuzeeProfileUI?.sync?.();
      return;
    }

    section.classList.add("is-muuzee-auth-guest");
    title.textContent = "自分だけのArtWallをつくろう";
    cta.textContent = "自分のArtWallを作る →";
    cta.setAttribute("href","#");
    cta.setAttribute("role","button");
    cta.dataset.muuzeeLoginTrigger = "";
    cta.dataset.muuzeeAuthAfter = "./my-art.html#artwall";

    copy.innerHTML = `
      <div class="muuzee-artwall-guest-copy">
        <span class="artwall-owner-label">YOUR ART PROFILE</span>
        <h2>観たアートを、自分だけの壁に。</h2>
        <p>訪れた展示や出会った作品が少しずつ積み上がり、あなただけのArtWallになります。</p>
      </div>
    `;
  };

  const syncAuthDependentUI = () => {
    if(!document.body) return;
    document.body.classList.toggle(
      "muuzee-auth-guest",
      !isLoggedIn()
    );
    syncSeenButtons();
    syncProtectedPage();
    syncHomeArtWall();
  };

  const setMode = mode => {
    if(!dialog) return;

    const next = mode === "register" ? "register" : "login";

    dialog
      .querySelectorAll('input[name="muuzee-auth-mode"]')
      .forEach(input => {
        input.checked = input.value === next;
      });

    const registerOnly = dialog.querySelector("[data-muuzee-auth-register-only]");
    if(registerOnly) registerOnly.hidden = next !== "register";

    const submit = dialog.querySelector("[data-muuzee-auth-submit]");
    if(submit){
      submit.textContent = next === "register" ? "新規登録" : "ログイン";
    }

    const error = dialog.querySelector("[data-muuzee-auth-error]");
    if(error) error.textContent = "";
  };

  const createDialog = () => {
    if(dialog?.isConnected) return dialog;

    dialog = document.createElement("dialog");
    dialog.className = "muuzee-auth-dialog";
    dialog.dataset.muuzeeAuthDialog = "";

    dialog.innerHTML = `
      <div class="muuzee-auth-panel">
        <button class="muuzee-auth-close" type="button" aria-label="閉じる" data-muuzee-auth-close>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19"></path></svg>
        </button>

        <div class="muuzee-auth-heading">
          <small>ACCOUNT</small>
          <h2>Muuzeeをもっと便利に</h2>
          <p>保存したアートをまとめたり、自分だけのArtWallを作れます。</p>
        </div>

        <form class="muuzee-auth-form" data-muuzee-auth-form>
          <fieldset class="muuzee-auth-mode" aria-label="ログイン方法">
            <label>
              <input type="radio" name="muuzee-auth-mode" value="login" checked>
              <span>ログイン</span>
            </label>
            <label>
              <input type="radio" name="muuzee-auth-mode" value="register">
              <span>新規登録</span>
            </label>
          </fieldset>

          <label class="muuzee-auth-field">
            <span>メールアドレス</span>
            <input type="email" autocomplete="email" inputmode="email" required data-muuzee-auth-email>
          </label>

          <label class="muuzee-auth-field">
            <span>パスワード</span>
            <input type="password" autocomplete="current-password" minlength="6" required data-muuzee-auth-password>
          </label>

          <div class="muuzee-auth-register-only" data-muuzee-auth-register-only hidden>
            <label class="muuzee-auth-agreement">
              <input type="checkbox" data-muuzee-auth-agree>
              <span>
                <button type="button" class="muuzee-auth-text-link" data-muuzee-auth-terms>利用規約</button>
                と
                <a class="muuzee-auth-text-link" href="./privacy-policy.html">プライバシーポリシー</a>
                に同意する
              </span>
            </label>
          </div>

          <p class="muuzee-auth-error" data-muuzee-auth-error aria-live="polite"></p>

          <button class="muuzee-auth-submit" type="submit" data-muuzee-auth-submit>
            ログイン
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelector("[data-muuzee-auth-close]")?.addEventListener("click",() => {
      pendingAfterAuthHref = "";
      dialog.close();
    });

    dialog.querySelectorAll('input[name="muuzee-auth-mode"]').forEach(input => {
      input.addEventListener("change",() => {
        setMode(input.value);
        const password = dialog.querySelector("[data-muuzee-auth-password]");
        if(password){
          password.autocomplete =
            input.value === "register"
              ? "new-password"
              : "current-password";
        }
      });
    });

    dialog.querySelector("[data-muuzee-auth-terms]")?.addEventListener("click",() => {
      alert("利用規約ページは別途作成予定です（Prototype）。");
    });

    dialog.querySelector("[data-muuzee-auth-form]")?.addEventListener("submit",event => {
      event.preventDefault();

      const form = event.currentTarget;
      if(!form.reportValidity()) return;

      const mode =
        form.querySelector('input[name="muuzee-auth-mode"]:checked')?.value
        || "login";

      const email =
        form.querySelector("[data-muuzee-auth-email]")?.value
        || "";

      const password =
        form.querySelector("[data-muuzee-auth-password]")?.value
        || "";

      const error = form.querySelector("[data-muuzee-auth-error]");

      if(error) error.textContent = "";

      if(mode === "register"){
        const agreed =
          form.querySelector("[data-muuzee-auth-agree]")?.checked
          === true;

        if(!agreed){
          if(error){
            error.textContent = "新規登録には規約への同意が必要です。";
          }
          return;
        }

        const result = register(email,password);

        if(!result.ok){
          if(error) error.textContent = result.message;
        }
        return;
      }

      const result = login(email,password);

      if(!result.ok){
        if(error) error.textContent = result.message;
      }
    });

    return dialog;
  };

  const openLogin = ({mode="login",afterAuthHref=""}={}) => {
    createDialog();
    pendingAfterAuthHref = String(afterAuthHref || "");
    setMode(mode);

    if(!dialog.open){
      dialog.showModal();
    }

    window.requestAnimationFrame(() => {
      dialog.querySelector("[data-muuzee-auth-email]")?.focus({
        preventScroll:true
      });
    });
  };

  const closeLogin = () => {
    pendingAfterAuthHref = "";
    if(dialog?.open) dialog.close();
  };

  const finishLogin = user => {
    const next = pendingAfterAuthHref;
    pendingAfterAuthHref = "";

    setCurrentUser(user);

    if(dialog?.open) dialog.close();

    if(next){
      location.href = withLoginParam(next);
    }
  };

  const login = (email,password) => {
    const normalized = normalizeEmail(email);

    if(!normalized || !String(password || "")){
      return {
        ok:false,
        message:"メールアドレスとパスワードを入力してください。"
      };
    }

    rebuildUsers();
    const user = userByCredentials(normalized,password);

    if(!user){
      return {
        ok:false,
        message:"メールアドレスまたはパスワードが正しくありません。"
      };
    }

    finishLogin(user);
    return {ok:true,user:clone(user)};
  };

  const register = (email,password) => {
    const normalized = normalizeEmail(email);
    const rawPassword = String(password || "");

    if(!normalized){
      return {ok:false,message:"メールアドレスを入力してください。"};
    }

    if(rawPassword.length < 6){
      return {ok:false,message:"パスワードは6文字以上で入力してください。"};
    }

    rebuildUsers();

    if(users.some(user => normalizeEmail(user.email) === normalized)){
      return {
        ok:false,
        message:"このメールアドレスはすでに登録されています。"
      };
    }

    const user = {
      loginID:`user-${Date.now().toString(36)}`,
      email:normalized,
      password:rawPassword,
      nickname:"",
      createdAt:new Date().toISOString(),
      prototype:true
    };

    const localUsers = readLocalUsers();
    localUsers.push(user);
    writeLocalUsers(localUsers);
    rebuildUsers();

    try{
      const currentProfile = JSON.parse(
        localStorage.getItem(PROFILE_KEY) || "{}"
      );

      localStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({
          ...(currentProfile && typeof currentProfile === "object"
            ? currentProfile
            : {}),
          email:normalized,
          nickname:""
        })
      );
    }catch{
      localStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({email:normalized,nickname:""})
      );
    }

    currentUser = user;

    const target = new URL("./profile-settings.html",location.href);
    target.searchParams.set(LOGIN_PARAM,user.loginID);
    location.href = target.href;

    return {ok:true,user:clone(user)};
  };

  const removeTooltip = () => {
    tooltip?.remove();
    tooltip = null;
  };

  const notifyAnonymousSave = () => {
    if(isLoggedIn()) return;

    removeTooltip();

    tooltip = document.createElement("div");
    tooltip.className = "muuzee-save-login-tooltip";
    tooltip.setAttribute("role","status");
    tooltip.innerHTML = `
      <div class="muuzee-save-login-tooltip-copy">
        <strong>会員になると便利に使えます</strong>
        <span>保存したアートからMy ArtやArtWallを楽しめます。</span>
      </div>
      <button class="muuzee-save-login-tooltip-action" type="button" data-muuzee-login-trigger>
        ログイン
      </button>
      <button class="muuzee-save-login-tooltip-close" type="button" aria-label="閉じる" data-muuzee-save-tooltip-close>
        ×
      </button>
    `;

    document.body.appendChild(tooltip);

    tooltip.querySelector("[data-muuzee-save-tooltip-close]")?.addEventListener(
      "click",
      removeTooltip
    );
  };

  const protectedHref = href => {
    try{
      const url = new URL(href,location.href);
      return (
        url.origin === location.origin
        && PROTECTED_PAGES.has(pageName(url.pathname))
      );
    }catch{
      return false;
    }
  };

  const installRouting = () => {
    if(routingInstalled) return;
    routingInstalled = true;

    document.addEventListener("click",event => {
      const logoutTrigger = event.target.closest?.(
        "[data-muuzee-logout-trigger]"
      );

      if(logoutTrigger){
        event.preventDefault();
        event.stopPropagation();
        removeTooltip();
        logout();
        return;
      }

      const trigger = event.target.closest?.("[data-muuzee-login-trigger]");

      if(trigger){
        event.preventDefault();
        event.stopPropagation();

        removeTooltip();

        openLogin({
          mode:trigger.dataset.muuzeeAuthMode || "login",
          afterAuthHref:trigger.dataset.muuzeeAuthAfter || ""
        });
        return;
      }

      const anchor = event.target.closest?.("a[href]");
      if(!anchor) return;

      const href = anchor.getAttribute("href") || "";

      if(!isLoggedIn() && protectedHref(href)){
        event.preventDefault();
        openLogin({
          mode:"login",
          afterAuthHref:href
        });
        return;
      }

      if(!isLoggedIn()) return;

      try{
        const url = new URL(href,location.href);

        if(
          url.origin === location.origin
          && /^https?:$/.test(url.protocol)
          && !anchor.hasAttribute("download")
        ){
          url.searchParams.set(LOGIN_PARAM,currentLoginID());
          anchor.href = url.href;
        }
      }catch{}
    },true);
  };

  const logout = () => {
    currentUser = null;

    const url = new URL(location.href);
    url.searchParams.delete(LOGIN_PARAM);

    if(PROTECTED_PAGES.has(pageName(url.pathname))){
      const home = new URL("./index.html",location.href);
      location.href = home.href;
      return;
    }

    history.replaceState(
      history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );

    dispatchAuthChange();
  };

  const bootstrap = async () => {
    await loadConfig();
    refreshFromLocation();

    if(document.readyState === "loading"){
      await new Promise(resolve => {
        document.addEventListener("DOMContentLoaded",resolve,{once:true});
      });
    }

    createDialog();
    installRouting();
    syncAuthDependentUI();

    window.addEventListener("load",syncHomeArtWall,{once:true});

    window.addEventListener("popstate",() => {
      refreshFromLocation();
      dispatchAuthChange();
    });
  };

  const ready = bootstrap();

  window.MuuzeeAuth = Object.freeze({
    ready,
    isLoggedIn,
    currentUser:() => currentUser ? clone(currentUser) : null,
    loginID:currentLoginID,
    open:openLogin,
    close:closeLogin,
    login,
    register,
    logout,
    notifyAnonymousSave,
    withLoginParam
  });
})();
