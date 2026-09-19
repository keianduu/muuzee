/* Muuzee Museum Collection — shared read model resolver */
(() => {
  "use strict";

  function displayTitle(work,artists){
    const title = String(work?.title || "").trim();
    if(title) return title;
    const names = artists.map(artist => artist.name).filter(Boolean);
    return names.length ? `${names.join(" / ")}の作品` : "作品情報を確認中です";
  }

  function resolve(museumId){
    const workCatalog = window.MuuzeeWorkCatalog || [];
    const workArtists = window.MuuzeeWorkArtists || [];
    const holdings = window.MuuzeeCollectionHoldings || [];
    const artistCatalog = window.MuuzeeArtistCatalog || [];

    const worksById = new Map(workCatalog.map(work => [work.id,work]));
    const artistsById = new Map(artistCatalog.map(artist => [artist.id,artist]));
    const relationsByWorkId = new Map();
    workArtists.forEach(relation => {
      const relations = relationsByWorkId.get(relation.workId) || [];
      relations.push(relation);
      relationsByWorkId.set(relation.workId,relations);
    });

    const artistWorkIds = new Map();
    const works = holdings
      .filter(holding => holding.venueId === museumId)
      .sort((a,b) => a.sortOrder - b.sortOrder)
      .map(holding => {
        const work = worksById.get(holding.workId);
        if(!work) return null;
        const artists = (relationsByWorkId.get(work.id) || [])
          .sort((a,b) => a.sortOrder - b.sortOrder)
          .map(relation => artistsById.get(relation.artistId))
          .filter(Boolean)
          .map(artist => ({id:artist.id,name:artist.name}));
        artists.forEach(artist => {
          const ids = artistWorkIds.get(artist.id) || [];
          if(!ids.includes(work.id)) ids.push(work.id);
          artistWorkIds.set(artist.id,ids);
        });
        return {
          id:work.id,
          displayTitle:displayTitle(work,artists),
          yearText:work.yearText || "",
          artists
        };
      })
      .filter(Boolean);

    const artists = [...artistWorkIds.entries()].map(([artistId,workIds]) => {
      const artist = artistsById.get(artistId);
      return {
        id:artistId,
        displayName:artist?.name || "Artist情報を確認中です",
        workCount:workIds.length
      };
    });

    return {works,artists};
  }

  window.MuuzeeMuseumCollection = Object.freeze({resolve,displayTitle});
})();
