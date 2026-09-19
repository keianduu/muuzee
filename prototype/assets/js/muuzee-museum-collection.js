/* Muuzee Museum Collection — shared read model resolver */
(() => {
  "use strict";

  function displayTitle(work,artists){
    const relations = window.MuuzeeCollectionRelations;
    if(relations?.isPublishableWorkTitle(work)) return String(work.title).trim();
    const names = artists.map(artist => artist.name).filter(Boolean);
    return names.length ? `${names.join(" / ")}の作品` : "作品情報を確認中です";
  }

  function resolve(museumId,input){
    const relations = window.MuuzeeCollectionRelations;
    if(!relations || !museumId) return {works:[],artists:[]};
    const index = relations.createIndex(input);

    const artistWorkIds = new Map();
    const seenWorkIds = new Set();
    const works = (index.holdingsByVenueId.get(museumId) || [])
      .filter(holding => relations.isPublishableRelation(holding))
      .map(holding => {
        const work = index.worksById.get(holding.workId);
        if(!work || seenWorkIds.has(work.id)) return null;
        seenWorkIds.add(work.id);
        const seenArtistIds = new Set();
        const artists = (index.workArtistsByWorkId.get(work.id) || [])
          .filter(relation => relations.isPublishableRelation(relation))
          .map(relation => index.artistsById.get(relation.artistId))
          .filter(artist => {
            if(!artist || seenArtistIds.has(artist.id)) return false;
            seenArtistIds.add(artist.id);
            return true;
          })
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
      const artist = index.artistsById.get(artistId);
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
