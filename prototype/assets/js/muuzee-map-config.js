/* Muuzee Map Config — data-only place and presentation defaults */
(() => {
  "use strict";

  const museumIds = [
    "nact","mori","tnm","nmwa","artizon","mot","hokusai","21kanazawa",
    "kyocera","nakanoshima","chichu","adachi","takehisa-yumeji-museum","louvre","pompidou","moma",
    "met","tate","guggenheim","rijks","prado"
  ];

  window.MuuzeeMapConfig = Object.freeze({
    tile:Object.freeze({
      url:"https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      options:Object.freeze({
        subdomains:"abcd",
        maxZoom:20,
        attribution:"&copy; OpenStreetMap contributors &copy; CARTO"
      }),
      initialBounds:Object.freeze([[35.645,139.735],[35.728,139.825]]),
      detailZoom:15
    }),
    media:Object.freeze({
      neutral:"./assets/images/placeholders/museum-map-neutral.svg",
      museum:Object.freeze({
        nact:"https://www.nact.jp/english/tips/media/01_tips_Exteriorview%20_Facade.jpg",
        mori:"https://cdn.cheapoguides.com/wp-content/uploads/sites/2/2025/04/AB782347-3FBF-4960-AEFE-EA1E4EC664F1_1_201_a-770x578.jpeg",
        "21kanazawa":"https://visitkanazawa.jp/lsc/upfile/articleDetail/0000/0906/906_2_xl.jpg",
        chichu:"https://img.hankyung.com/photo/202402/01.36007592.1.jpg"
      })
    }),
    actions:Object.freeze({
      map:Object.freeze({label:"地図を開く",tone:"secondary"}),
      museum:Object.freeze({label:"美術館を見る",tone:"primary"}),
      exhibition:Object.freeze({label:"詳細を見る",tone:"primary"})
    }),
    places:Object.freeze({
      ...Object.fromEntries(museumIds.map(id => [id,Object.freeze({source:"museum",entityId:id})])),
      "sprout-books-art":Object.freeze({
        source:"venue",entityId:"sprout-books-art",name:"Sprout Books and Art",
        lat:35.6742,lng:139.7631,address:"東京都中央区銀座",meta:"Gallery",sub:"東京都・銀座"
      }),
      "gallery-mumon":Object.freeze({
        source:"venue",entityId:"gallery-mumon",name:"Gallery MUMON",
        lat:35.6651,lng:139.7274,address:"東京都港区南青山",meta:"Gallery",sub:"東京都・南青山"
      }),
      "hagiwara-projects":Object.freeze({
        source:"venue",entityId:"hagiwara-projects",name:"HAGIWARA PROJECTS",
        lat:35.6810,lng:139.8061,address:"東京都内",meta:"Gallery",sub:"東京都"
      }),
      "whitestone-ginza":Object.freeze({
        source:"venue",entityId:"whitestone-ginza",name:"ホワイトストーンギャラリー銀座新館",
        lat:35.6711,lng:139.7648,address:"東京都中央区銀座",meta:"Gallery",sub:"東京都・銀座"
      }),
      "art-factory-jonanjima":Object.freeze({
        source:"venue",entityId:"art-factory-jonanjima",name:"ART FACTORY城南島",
        lat:35.5748,lng:139.7484,address:"東京都大田区城南島2-4-10",meta:"Art space",sub:"東京都・城南島"
      }),
      "good-design-marunouchi":Object.freeze({
        source:"venue",entityId:"good-design-marunouchi",name:"GOOD DESIGN Marunouchi",
        lat:35.6800,lng:139.7630,address:"東京都千代田区丸の内3-4-1",meta:"Design space",sub:"東京都・丸の内"
      }),
      "issey-miyake-ginza-cube":Object.freeze({
        source:"venue",entityId:"issey-miyake-ginza-cube",name:"ISSEY MIYAKE GINZA | CUBE",
        lat:35.6701,lng:139.7644,address:"東京都中央区銀座4-4-5",meta:"Art space",sub:"東京都・銀座"
      }),
      "cave-ayumi-gallery":Object.freeze({
        source:"venue",entityId:"cave-ayumi-gallery",name:"CAVE-AYUMI GALLERY",
        lat:35.6763,lng:139.7705,address:"東京都中央区日本橋",meta:"Gallery",sub:"東京都・日本橋"
      })
    })
  });
})();
