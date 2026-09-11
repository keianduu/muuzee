(() => {
  "use strict";

  window.MuuzeeArtWallDataConfig = Object.freeze({
    schemaVersion:2,
    adapter:"prototype",

    seen:Object.freeze({
      queryParam:"seenCount",
      defaultCount:30,
      maxCount:100,
      pageSize:20
    }),

    initialLimit:30,
    maxItems:100
  });
})();
