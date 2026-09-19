/* Muuzee Work / Collection fixtures — Production relation contract shape */
(() => {
  "use strict";

  const works = [
    ["mam-collection-01","MAM Collection 01","Collection highlight","placeholder"],
    ["mam-collection-02","MAM Collection 02","Collection highlight","placeholder"],
    ["water-lilies","睡蓮","Collection highlight","unverified"],
    ["impressionist-landscape","印象派の風景","Collection highlight","placeholder"],
    ["development-of-modern-painting","近代絵画の展開","Collection highlight","placeholder"],
    ["impressionist-collection","印象派コレクション","Collection highlight","placeholder"],
    ["cezanne-and-modernity","セザンヌと近代","Collection highlight","placeholder"],
    ["collection-space","Collection / Space","Collection view","placeholder"],
    ["collection-contemporary","Collection / Contemporary","Collection view","placeholder"],
    ["european-painting","European Painting","Collection view","placeholder"],
    ["modern-reference","Modern Reference","Collection view","placeholder"],
    ["modern-collection","Modern Collection","Collection view","placeholder"],
    ["modern-painting","Modern Painting","Collection view","placeholder"],
    ["the-starry-night","The Starry Night","Collection highlight","unverified"],
    ["modern-masters","Modern Masters","Collection highlight","placeholder"],
    ["modern-portrait","Modern Portrait","Collection highlight","placeholder"],
    ["contemporary-collection","Contemporary Collection","Collection view","placeholder"],
    ["contemporary-masters","Contemporary Masters","Collection view","placeholder"]
  ].map(([id,title,yearText,titleStatus]) => ({
    id,
    title,
    yearText,
    publication:{titleStatus,source:null,sourceUrl:null,sourceRecordId:null}
  }));

  const workArtists = [
    ["mam-collection-01","yayoi-kusama"],
    ["mam-collection-02","gerhard-richter"],
    ["water-lilies","claude-monet"],
    ["impressionist-landscape","pierre-auguste-renoir"],
    ["development-of-modern-painting","paul-cezanne"],
    ["impressionist-collection","claude-monet"],
    ["cezanne-and-modernity","paul-cezanne"],
    ["collection-space","yayoi-kusama"],
    ["collection-contemporary","gerhard-richter"],
    ["european-painting","claude-monet"],
    ["modern-reference","edgar-degas"],
    ["modern-collection","pablo-picasso"],
    ["modern-painting","frida-kahlo"],
    ["the-starry-night","vincent-van-gogh"],
    ["modern-masters","pablo-picasso"],
    ["modern-portrait","frida-kahlo"],
    ["contemporary-collection","gerhard-richter"],
    ["contemporary-masters","gerhard-richter"]
  ].map(([workId,artistId],index) => ({
    workId,
    artistId,
    role:"artist",
    sortOrder:index,
    verification:{status:"unverified",source:null,sourceUrl:null,sourceRecordId:null,verifiedAt:null}
  }));

  const collectionHoldings = [
    ["mori","mam-collection-01"],["mori","mam-collection-02"],
    ["nmwa","water-lilies"],["nmwa","impressionist-landscape"],["nmwa","development-of-modern-painting"],
    ["artizon","impressionist-collection"],["artizon","cezanne-and-modernity"],
    ["21kanazawa","collection-space"],["21kanazawa","collection-contemporary"],
    ["chichu","water-lilies"],
    ["louvre","european-painting"],["louvre","modern-reference"],
    ["pompidou","modern-collection"],["pompidou","modern-painting"],
    ["moma","the-starry-night"],["moma","modern-masters"],["moma","modern-portrait"],
    ["tate","modern-collection"],["tate","contemporary-collection"],
    ["guggenheim","contemporary-masters"]
  ].map(([venueId,workId],index) => ({
    venueId,
    workId,
    holdingType:"collection",
    sortOrder:index,
    verification:{status:"unverified",source:null,sourceUrl:null,sourceRecordId:null,verifiedAt:null}
  }));

  window.MuuzeeWorkCatalog = Object.freeze(works.map(item => Object.freeze({...item,publication:Object.freeze({...item.publication})})));
  window.MuuzeeWorkArtists = Object.freeze(workArtists.map(item => Object.freeze({...item,verification:Object.freeze({...item.verification})})));
  window.MuuzeeCollectionHoldings = Object.freeze(collectionHoldings.map(item => Object.freeze({...item,verification:Object.freeze({...item.verification})})));
})();
