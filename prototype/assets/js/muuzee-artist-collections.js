/* Muuzee Artist Collections — verified Artist → Work → Museum read model */
(() => {
  "use strict";

  function resolve(artistId,input){
    const relations = window.MuuzeeCollectionRelations;
    if(!relations || !artistId) return {items:[],metrics:{museumCount:0,verifiedWorkCount:0}};

    const index = relations.createIndex(input);
    const groups = new Map();
    const seenWorkIds = new Set();
    const seenHoldingKeys = new Set();
    const metrics = {
      verifiedWorkArtistCount:0,
      verifiedHoldingCount:0,
      verifiedWorkCount:0,
      museumCount:0,
      missingWorkCount:0,
      missingVenueCount:0
    };

    (index.workArtistsByArtistId.get(artistId) || []).forEach(workArtist => {
      if(!relations.isPublishableRelation(workArtist)) return;
      if(seenWorkIds.has(workArtist.workId)) return;
      seenWorkIds.add(workArtist.workId);
      metrics.verifiedWorkArtistCount += 1;
      const work = index.worksById.get(workArtist.workId);
      if(!work){
        metrics.missingWorkCount += 1;
        return;
      }

      (index.holdingsByWorkId.get(work.id) || []).forEach(holding => {
        if(!relations.isPublishableRelation(holding)) return;
        const holdingKey = `${work.id}|${holding.venueId}`;
        if(seenHoldingKeys.has(holdingKey)) return;
        seenHoldingKeys.add(holdingKey);
        metrics.verifiedHoldingCount += 1;
        const museum = index.museumsById.get(holding.venueId);
        if(!museum){
          metrics.missingVenueCount += 1;
          return;
        }

        const group = groups.get(museum.id) || {
          id:museum.id,
          name:museum.name,
          location:museum.location || museum.area || "",
          href:`./museum.html?id=${encodeURIComponent(museum.id)}`,
          works:new Map(),
          sources:[]
        };
        if(!group.works.has(work.id)){
          group.works.set(work.id,{
            id:work.id,
            displayTitle:relations.isPublishableWorkTitle(work) ? work.title : null,
            yearText:work.yearText || ""
          });
        }
        group.sources.push(
          {relationType:"work_artist",...relations.relationEvidence(workArtist)},
          {relationType:"collection_holding",...relations.relationEvidence(holding)}
        );
        groups.set(museum.id,group);
      });
    });

    const items = [...groups.values()].map(group => {
      const works = [...group.works.values()];
      const sourceKeys = new Set();
      const sources = group.sources.filter(source => {
        const key = [source.relationType,source.source,source.sourceUrl,source.sourceRecordId].join("|");
        if(sourceKeys.has(key)) return false;
        sourceKeys.add(key);
        return true;
      });
      return {
        id:group.id,
        name:group.name,
        location:group.location,
        href:group.href,
        workCount:works.length,
        works,
        verificationLevel:"verified",
        sources
      };
    });

    metrics.museumCount = items.length;
    metrics.verifiedWorkCount = items.reduce((total,item) => total + item.workCount,0);
    return {items,metrics};
  }

  window.MuuzeeArtistCollections = Object.freeze({resolve});
})();
