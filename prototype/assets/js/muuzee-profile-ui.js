/*
  Muuzee Profile UI — prototype avatar sync

  Source of truth:
    localStorage["muuzee:profile-settings:v1"].avatar

  Targets:
    - global header avatar
    - My Art profile avatar
    - ArtWall avatar

  Production:
    replace localStorage read with authenticated user profile data.
*/
(() => {
  "use strict";

  const KEY =
    "muuzee:profile-settings:v1";

  const DEFAULT_AVATAR =
    "./assets/images/profile-avatar.jpg";

  const readAvatar =
    () => {
      try {
        const state =
          JSON.parse(
            localStorage.getItem(
              KEY
            ) || "{}"
          );

        return (
          typeof state.avatar
            === "string"
          && state.avatar
        )
          ? state.avatar
          : DEFAULT_AVATAR;
      } catch (_) {
        return DEFAULT_AVATAR;
      }
    };

  const sync =
    avatar => {
      const src =
        avatar
        || readAvatar();

      [
        ".site-header .avatar img",
        ".mypage-profile-avatar-link img",
        ".artwall-user-avatar img"
      ]
        .forEach(
          selector => {
            document
              .querySelectorAll(
                selector
              )
              .forEach(
                image => {
                  if (
                    image.src
                    !== src
                  ) {
                    image.src =
                      src;
                  }
                }
              );
          }
        );
    };

  const start =
    () => {
      sync();

      window.addEventListener(
        "muuzee:profile-settings-change",
        event => {
          sync(
            event.detail
              ?.avatar
          );
        }
      );
    };

  if (
    document.readyState
    === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      start,
      {
        once:true
      }
    );
  } else {
    start();
  }

  window.MuuzeeProfileUI = {
    sync
  };
})();
