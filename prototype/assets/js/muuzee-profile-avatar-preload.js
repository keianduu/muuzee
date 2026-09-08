/*
  Muuzee Profile Avatar — early reveal

  Purpose:
  prevent default-avatar flash without risking permanently hidden avatars.

  This script is loaded synchronously in <head>.
*/
(() => {
  "use strict";

  const KEY =
    "muuzee:profile-settings:v1";

  const DEFAULT_AVATAR =
    "./assets/images/profile-avatar.jpg";

  let avatar =
    DEFAULT_AVATAR;

  try {
    const state =
      JSON.parse(
        localStorage.getItem(
          KEY
        ) || "{}"
      );

    if (
      typeof state.avatar
        === "string"
      && state.avatar
    ) {
      avatar =
        state.avatar;
    }
  } catch (_) {
    avatar =
      DEFAULT_AVATAR;
  }

  const reveal =
    () => {
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
                  image.src =
                    avatar;
                }
              );
          }
        );

      document.documentElement
        .dataset
        .profileAvatarReady =
          "true";
    };

  if (
    document.readyState
      === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      reveal,
      {
        once:true
      }
    );
  } else {
    reveal();
  }
})();
