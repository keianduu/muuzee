/* Muuzee Collection Relations — verified relation publication boundary */
(() => {
  "use strict";

  const text = value => String(value ?? "").trim();

  function hasEvidence(record){
    return Boolean(text(record?.source) && (text(record?.sourceUrl) || text(record?.sourceRecordId)));
  }

  function isPublishableRelation(relation){
    const verification = relation?.verification;
    return verification?.status === "verified" && hasEvidence(verification);
  }

  function isPublishableWorkTitle(work){
    const publication = work?.publication;
    return publication?.titleStatus === "verified" && hasEvidence(publication) && Boolean(text(work?.title));
  }

  function relationEvidence(relation){
    const verification = relation?.verification || {};
    return {
      source:text(verification.source),
      sourceUrl:text(verification.sourceUrl),
      sourceRecordId:text(verification.sourceRecordId),
      verifiedAt:text(verification.verifiedAt)
    };
  }

  function ordered(items){
    return [...(items || [])]
      .map((item,index) => ({item,index}))
      .sort((left,right) => {
        const leftOrder = Number.isFinite(left.item?.sortOrder) ? left.item.sortOrder : left.index;
        const rightOrder = Number.isFinite(right.item?.sortOrder) ? right.item.sortOrder : right.index;
        return leftOrder - rightOrder || left.index - right.index;
      })
      .map(entry => entry.item);
  }

  function addToIndex(index,key,value){
    if(!key) return;
    const values = index.get(key) || [];
    values.push(value);
    index.set(key,values);
  }

  function createIndex(input = {}){
    const works = input.works || window.MuuzeeWorkCatalog || [];
    const workArtists = ordered(input.workArtists || window.MuuzeeWorkArtists || []);
    const holdings = ordered(input.holdings || window.MuuzeeCollectionHoldings || []);
    const artists = input.artists || window.MuuzeeArtistCatalog || [];
    const museums = input.museums || window.MuuzeeMuseumCatalog || [];
    const workArtistsByWorkId = new Map();
    const workArtistsByArtistId = new Map();
    const holdingsByWorkId = new Map();
    const holdingsByVenueId = new Map();

    workArtists.forEach(relation => {
      addToIndex(workArtistsByWorkId,relation.workId,relation);
      addToIndex(workArtistsByArtistId,relation.artistId,relation);
    });
    holdings.forEach(holding => {
      addToIndex(holdingsByWorkId,holding.workId,holding);
      addToIndex(holdingsByVenueId,holding.venueId,holding);
    });

    return {
      worksById:new Map(works.map(work => [work.id,work])),
      artistsById:new Map(artists.map(artist => [artist.id,artist])),
      museumsById:new Map(museums.map(museum => [museum.id,museum])),
      workArtistsByWorkId,
      workArtistsByArtistId,
      holdingsByWorkId,
      holdingsByVenueId
    };
  }

  window.MuuzeeCollectionRelations = Object.freeze({
    createIndex,
    hasEvidence,
    isPublishableRelation,
    isPublishableWorkTitle,
    relationEvidence
  });
})();
