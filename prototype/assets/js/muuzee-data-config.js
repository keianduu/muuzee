/* Muuzee User Front Data Source — central configuration */
(() => {
  "use strict";

  const existing = window.MuuzeeDataConfig || {};
  const withDefault = key => ({
    source:"fixtures",
    ...(existing[key] || {})
  });

  window.MuuzeeDataConfig = {
    exhibitions:withDefault("exhibitions"),
    artists:withDefault("artists"),
    museums:withDefault("museums")
  };
})();
