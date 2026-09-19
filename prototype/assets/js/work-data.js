/* Muuzee Work / Collection fixtures — Production relation contract shape */
(() => {
  "use strict";

  const works = [
    {id:"mam-collection-01",title:"MAM Collection 01",yearText:"Collection highlight"},
    {id:"mam-collection-02",title:"MAM Collection 02",yearText:"Collection highlight"},
    {id:"water-lilies",title:"睡蓮",yearText:"Collection highlight"},
    {id:"impressionist-landscape",title:"印象派の風景",yearText:"Collection highlight"},
    {id:"development-of-modern-painting",title:"近代絵画の展開",yearText:"Collection highlight"},
    {id:"impressionist-collection",title:"印象派コレクション",yearText:"Collection highlight"},
    {id:"cezanne-and-modernity",title:"セザンヌと近代",yearText:"Collection highlight"},
    {id:"collection-space",title:"Collection / Space",yearText:"Collection view"},
    {id:"collection-contemporary",title:"Collection / Contemporary",yearText:"Collection view"},
    {id:"european-painting",title:"European Painting",yearText:"Collection view"},
    {id:"modern-reference",title:"Modern Reference",yearText:"Collection view"},
    {id:"modern-collection",title:"Modern Collection",yearText:"Collection view"},
    {id:"modern-painting",title:"Modern Painting",yearText:"Collection view"},
    {id:"the-starry-night",title:"The Starry Night",yearText:"Collection highlight"},
    {id:"modern-masters",title:"Modern Masters",yearText:"Collection highlight"},
    {id:"modern-portrait",title:"Modern Portrait",yearText:"Collection highlight"},
    {id:"contemporary-collection",title:"Contemporary Collection",yearText:"Collection view"},
    {id:"contemporary-masters",title:"Contemporary Masters",yearText:"Collection view"}
  ];

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
  ].map(([workId,artistId],index) => ({workId,artistId,role:"artist",sortOrder:index}));

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
  ].map(([venueId,workId],index) => ({venueId,workId,sortOrder:index}));

  window.MuuzeeWorkCatalog = Object.freeze(works.map(item => Object.freeze({...item})));
  window.MuuzeeWorkArtists = Object.freeze(workArtists.map(item => Object.freeze({...item})));
  window.MuuzeeCollectionHoldings = Object.freeze(collectionHoldings.map(item => Object.freeze({...item})));
})();
