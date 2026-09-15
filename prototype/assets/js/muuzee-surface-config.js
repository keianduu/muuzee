/* Muuzee Discovery Surface — policy/config only; entity data lives in MuuzeeDataSource */
(() => {
  "use strict";

  const existing = window.MuuzeeSurfaceConfig || {};

  const surface = (group,key,defaults) => {
    const override = existing[group]?.[key];
    const merged = {
      ...defaults,
      ...(override && typeof override === "object" ? override : {})
    };
    if(Array.isArray(merged.ids)) merged.ids = [...merged.ids];
    return merged;
  };

  window.MuuzeeSurfaceConfig = {
    home:{
      recommendedExhibitions:surface("home","recommendedExhibitions",{
        mode:"curated",entity:"exhibitions",ids:[],limit:6
      }),
      guestArtWall:surface("home","guestArtWall",{
        mode:"curated",entity:"exhibitions",ids:[
          "storytelling",
          "noise",
          "light-path",
          "urushi-body",
          "dream-river",
          "mori-future-city",
          "nmwa-impressionism-dialogue",
          "mot-contemporary-signals",
          "uchiuchi",
          "nact-immersive-lines",
          "threshold",
          "yumeji",
          "storytelling-afterimage",
          "artizon-modern-dialogue",
          "mot-material-memory",
          "storytelling-paper-memory",
          "mori-light-space",
          "nmwa-modern-lines",
          "nact-color-fields",
          "mori-pop-dialogue"
        ],limit:30
      }),
      featuredArtists:surface("home","featuredArtists",{
        mode:"curated",entity:"artists",ids:[],limit:8
      }),
      popularMuseums:surface("home","popularMuseums",{
        mode:"curated",entity:"museums",ids:[],limit:10
      })
    },
    exhibitionDetail:{
      sameVenueExhibitions:surface("exhibitionDetail","sameVenueExhibitions",{
        mode:"derived",entity:"exhibitions",resolver:"sameVenueExhibitions",limit:3
      })
    },
    artistDetail:{
      currentExhibitions:surface("artistDetail","currentExhibitions",{
        mode:"derived",entity:"exhibitions",resolver:"artistCurrentExhibitions",limit:6
      }),
      relatedArtists:surface("artistDetail","relatedArtists",{
        mode:"derived",entity:"artists",resolver:"relatedArtists",limit:6
      })
    },
    museumDetail:{
      exhibitions:surface("museumDetail","exhibitions",{
        mode:"derived",entity:"exhibitions",resolver:"venueExhibitions",limit:12
      })
    }
  };
})();
