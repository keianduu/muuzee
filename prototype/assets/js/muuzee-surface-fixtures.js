/* Muuzee Discovery Surface — normalized prototype relation fixtures */
(() => {
  "use strict";

  const exhibitions = window.MuuzeeExhibitionCatalog || [];
  const artists = window.MuuzeeArtistCatalog || [];

  const artistFixtures = [
    {id:"yayoi-kusama",name:"草間彌生",tagIds:["contemporary","installation","japan"]},
    {id:"claude-monet",name:"クロード・モネ",tagIds:["impressionism","painting","france"]},
    {id:"vincent-van-gogh",name:"フィンセント・ファン・ゴッホ",tagIds:["post-impressionism","painting","europe"]},
    {id:"pablo-picasso",name:"パブロ・ピカソ",tagIds:["modernism","painting","europe"]},
    {id:"yoshitomo-nara",name:"奈良美智",tagIds:["contemporary","painting","japan"]},
    {id:"andy-warhol",name:"アンディ・ウォーホル",tagIds:["pop","contemporary","usa"]},
    {id:"takashi-murakami",name:"村上隆",tagIds:["pop","contemporary","japan"]},
    {id:"chiharu-shiota",name:"塩田千春",tagIds:["contemporary","installation","japan"]},
    {id:"gerhard-richter",name:"ゲルハルト・リヒター",tagIds:["contemporary","painting","europe"]},
    {id:"david-hockney",name:"デイヴィッド・ホックニー",tagIds:["contemporary","painting","europe"]},
    {id:"edgar-degas",name:"エドガー・ドガ",tagIds:["impressionism","painting","france"]},
    {id:"pierre-auguste-renoir",name:"ピエール＝オーギュスト・ルノワール",tagIds:["impressionism","painting","france"]},
    {id:"paul-cezanne",name:"ポール・セザンヌ",tagIds:["post-impressionism","painting","france"]},
    {id:"ayune-shojima",name:"庄島歩音",tagIds:["contemporary","illustration","japan"]}
  ];

  const artistById = new Map(artists.map(item => [item.id,item]));
  artistFixtures.forEach(fixture => {
    const artist = artistById.get(fixture.id);
    if(!artist) return;
    artist.tagIds = [...fixture.tagIds];
  });

  const existingRelationById = {
    storytelling:{venueId:"sprout-books-art",artistIds:["ayune-shojima"],start:"2026-09-12",end:"2026-09-27"},
    uchiuchi:{venueId:"gallery-mumon",artistIds:["kumiko-koyama"],start:"2026-09-18",end:"2026-10-03"},
    yumeji:{venueId:"takehisa-yumeji-museum",artistIds:["takehisa-yumeji"],start:"2026-10-03",end:"2026-12-20"},
    noise:{venueId:"hagiwara-projects",artistIds:["zak-prekop"],start:"2026-09-12",end:"2026-10-17"},
    "light-path":{venueId:"whitestone-ginza",artistIds:["nobuko-watahiki"],start:"2026-09-10",end:"2026-10-03"},
    threshold:{venueId:"art-factory-jonanjima",artistIds:[],start:"2026-09-26",end:"2026-10-25"},
    "curious-matters":{venueId:"good-design-marunouchi",artistIds:[],start:"2026-09-02",end:"2026-09-12"},
    "urushi-body":{venueId:"issey-miyake-ginza-cube",artistIds:[],start:"2026-09-01",end:"2026-09-27"},
    "dream-river":{venueId:"cave-ayumi-gallery",artistIds:["taichi-nakamura"],start:"2026-08-23",end:"2026-09-22"}
  };

  const dateStatus = (start,end) => {
    const today = "2026-09-15";
    if(start && start > today) return ["upcoming","開催予定"];
    if(end && end < today) return ["past","終了"];
    return ["now","開催中"];
  };

  exhibitions.forEach(item => {
    const relation = existingRelationById[item.id];
    if(!relation) return;
    item.venueId = relation.venueId;
    item.artistIds = [...relation.artistIds];
    item.start = relation.start;
    item.end = relation.end;
    [item.status,item.statusLabel] = dateStatus(item.start,item.end);
  });

  const demoExhibitions = [
    {
      id:"storytelling-afterimage",title:"Afterimage — 記憶の輪郭",venue:"Sprout Books and Art",venueId:"sprout-books-art",
      city:"東京",area:"銀座・丸の内",date:"2026.10.04 — 10.18",start:"2026-10-04",end:"2026-10-18",
      category:"企画展",expressionCategory:"イラストレーション",status:"upcoming",statusLabel:"開催予定",
      artistIds:["ayune-shojima"],src:"./assets/images/exhibitions/exhibition-02.jpg",href:"./exhibition.html?id=storytelling-afterimage",
      description:"線と余白を手がかりに、記憶の残像をたどるPrototype relation fixture。"
    },
    {
      id:"storytelling-paper-memory",title:"Paper Memory",venue:"Sprout Books and Art",venueId:"sprout-books-art",
      city:"東京",area:"銀座・丸の内",date:"2026.11.01 — 11.22",start:"2026-11-01",end:"2026-11-22",
      category:"企画展",expressionCategory:"イラストレーション",status:"upcoming",statusLabel:"開催予定",
      artistIds:["ayune-shojima"],src:"./assets/images/exhibitions/exhibition-05.jpg",href:"./exhibition.html?id=storytelling-paper-memory",
      description:"紙の質感と小さな物語をテーマにしたPrototype relation fixture。"
    },
    {
      id:"mori-future-city",title:"Future City / 身体と都市",venue:"森美術館",venueId:"mori",
      city:"東京",area:"六本木・青山",date:"2026.08.28 — 10.25",start:"2026-08-28",end:"2026-10-25",
      category:"企画展",expressionCategory:"現代美術",status:"now",statusLabel:"開催中",
      artistIds:["yayoi-kusama","takashi-murakami","chiharu-shiota"],src:"./assets/images/exhibitions/exhibition-04.jpg",href:"./exhibition.html?id=mori-future-city",
      description:"都市、身体、反復を横断するPrototype relation fixture。"
    },
    {
      id:"mori-light-space",title:"Light / Space / Trace",venue:"森美術館",venueId:"mori",
      city:"東京",area:"六本木・青山",date:"2026.11.07 — 2027.01.11",start:"2026-11-07",end:"2027-01-11",
      category:"企画展",expressionCategory:"現代美術",status:"upcoming",statusLabel:"開催予定",
      artistIds:["chiharu-shiota","gerhard-richter"],src:"./assets/images/exhibitions/exhibition-06.jpg",href:"./exhibition.html?id=mori-light-space",
      description:"光と空間の痕跡を扱うPrototype relation fixture。"
    },
    {
      id:"mori-pop-dialogue",title:"Pop Dialogue",venue:"森美術館",venueId:"mori",
      city:"東京",area:"六本木・青山",date:"2026.12.05 — 2027.02.14",start:"2026-12-05",end:"2027-02-14",
      category:"企画展",expressionCategory:"現代美術",status:"upcoming",statusLabel:"開催予定",
      artistIds:["takashi-murakami","andy-warhol"],src:"./assets/images/exhibitions/exhibition-08.jpg",href:"./exhibition.html?id=mori-pop-dialogue",
      description:"ポップ表現の接続を確認するPrototype relation fixture。"
    },
    {
      id:"nmwa-impressionism-dialogue",title:"印象派 — 光の対話",venue:"国立西洋美術館",venueId:"nmwa",
      city:"東京",area:"上野・谷中",date:"2026.09.05 — 11.08",start:"2026-09-05",end:"2026-11-08",
      category:"企画展",expressionCategory:"絵画",status:"now",statusLabel:"開催中",
      artistIds:["claude-monet","pierre-auguste-renoir","edgar-degas"],src:"./assets/images/exhibitions/exhibition-03.jpg",href:"./exhibition.html?id=nmwa-impressionism-dialogue",
      description:"印象派のArtist relationを確認するPrototype fixture。"
    },
    {
      id:"nmwa-modern-lines",title:"Modern Lines",venue:"国立西洋美術館",venueId:"nmwa",
      city:"東京",area:"上野・谷中",date:"2026.11.21 — 2027.02.07",start:"2026-11-21",end:"2027-02-07",
      category:"企画展",expressionCategory:"絵画",status:"upcoming",statusLabel:"開催予定",
      artistIds:["paul-cezanne","pablo-picasso"],src:"./assets/images/exhibitions/exhibition-07.jpg",href:"./exhibition.html?id=nmwa-modern-lines",
      description:"近代絵画の展開を確認するPrototype relation fixture。"
    },
    {
      id:"mot-contemporary-signals",title:"Contemporary Signals",venue:"東京都現代美術館",venueId:"mot",
      city:"東京",area:"清澄白河・湾岸",date:"2026.09.01 — 10.18",start:"2026-09-01",end:"2026-10-18",
      category:"企画展",expressionCategory:"現代美術",status:"now",statusLabel:"開催中",
      artistIds:["yoshitomo-nara","yayoi-kusama","takashi-murakami"],src:"./assets/images/exhibitions/exhibition-04.jpg",href:"./exhibition.html?id=mot-contemporary-signals",
      description:"現代美術の複数Artist relationを確認するPrototype fixture。"
    },
    {
      id:"mot-material-memory",title:"Material Memory",venue:"東京都現代美術館",venueId:"mot",
      city:"東京",area:"清澄白河・湾岸",date:"2026.10.31 — 2027.01.17",start:"2026-10-31",end:"2027-01-17",
      category:"企画展",expressionCategory:"インスタレーション",status:"upcoming",statusLabel:"開催予定",
      artistIds:["chiharu-shiota","yoshitomo-nara"],src:"./assets/images/exhibitions/exhibition-09.jpg",href:"./exhibition.html?id=mot-material-memory",
      description:"素材と記憶を扱うPrototype relation fixture。"
    },
    {
      id:"artizon-modern-dialogue",title:"Modern Dialogue",venue:"アーティゾン美術館",venueId:"artizon",
      city:"東京",area:"銀座・丸の内",date:"2026.10.10 — 12.13",start:"2026-10-10",end:"2026-12-13",
      category:"企画展",expressionCategory:"絵画",status:"upcoming",statusLabel:"開催予定",
      artistIds:["claude-monet","paul-cezanne"],src:"./assets/images/exhibitions/exhibition-01.jpg",href:"./exhibition.html?id=artizon-modern-dialogue",
      description:"印象派から近代への接続を確認するPrototype fixture。"
    },
    {
      id:"nact-immersive-lines",title:"Immersive Lines",venue:"国立新美術館",venueId:"nact",
      city:"東京",area:"六本木・青山",date:"2026.09.20 — 11.15",start:"2026-09-20",end:"2026-11-15",
      category:"企画展",expressionCategory:"インスタレーション",status:"upcoming",statusLabel:"開催予定",
      artistIds:["chiharu-shiota","yayoi-kusama"],src:"./assets/images/exhibitions/exhibition-05.jpg",href:"./exhibition.html?id=nact-immersive-lines",
      description:"線と空間の体験を確認するPrototype relation fixture。"
    },
    {
      id:"nact-color-fields",title:"Color Fields",venue:"国立新美術館",venueId:"nact",
      city:"東京",area:"六本木・青山",date:"2026.11.28 — 2027.02.07",start:"2026-11-28",end:"2027-02-07",
      category:"企画展",expressionCategory:"絵画",status:"upcoming",statusLabel:"開催予定",
      artistIds:["gerhard-richter","david-hockney"],src:"./assets/images/exhibitions/exhibition-02.jpg",href:"./exhibition.html?id=nact-color-fields",
      description:"色面と絵画表現を確認するPrototype relation fixture。"
    },
    {
      id:"yumeji-modern-girls",title:"夢二 モダンガールのまなざし",venue:"竹久夢二美術館",venueId:"takehisa-yumeji-museum",
      city:"東京",area:"上野・谷中",date:"2027.01.09 — 03.28",start:"2027-01-09",end:"2027-03-28",
      category:"企画展",expressionCategory:"日本画",status:"upcoming",statusLabel:"開催予定",
      artistIds:["takehisa-yumeji"],src:"./assets/images/exhibitions/exhibition-03.jpg",href:"./exhibition.html?id=yumeji-modern-girls",
      description:"竹久夢二美術館の同一Venue relationを確認するPrototype fixture。"
    },
    {
      id:"threshold-material-shift",title:"Material Shift",venue:"ART FACTORY城南島",venueId:"art-factory-jonanjima",
      city:"東京",area:"清澄白河・湾岸",date:"2026.11.08 — 12.06",start:"2026-11-08",end:"2026-12-06",
      category:"企画展",expressionCategory:"インスタレーション",status:"upcoming",statusLabel:"開催予定",
      artistIds:["chiharu-shiota"],src:"./assets/images/exhibitions/exhibition-06.jpg",href:"./exhibition.html?id=threshold-material-shift",
      description:"同一Venue relationのEmpty / populated表示を確認するPrototype fixture。"
    }
  ];

  const existingIds = new Set(exhibitions.map(item => item.id));
  demoExhibitions.forEach(item => {
    if(!existingIds.has(item.id)) exhibitions.push(item);
  });

  window.MuuzeeSurfaceConfig = {
    ...(window.MuuzeeSurfaceConfig || {}),
    home:{
      ...window.MuuzeeSurfaceConfig?.home,
      recommendedExhibitions:{mode:"curated",entity:"exhibitions",ids:[
        "storytelling","dream-river","mori-future-city","nmwa-impressionism-dialogue","mot-contemporary-signals","nact-immersive-lines"
      ],limit:6},
      featuredArtists:{mode:"curated",entity:"artists",ids:[
        "yayoi-kusama","yoshitomo-nara","takashi-murakami","chiharu-shiota","claude-monet","pablo-picasso","andy-warhol","gerhard-richter"
      ],limit:8},
      popularMuseums:{mode:"curated",entity:"museums",ids:[
        "nact","mori","nmwa","mot","artizon","21kanazawa"
      ],limit:6}
    }
  };

  window.MuuzeeSurfaceFixturesReady = true;
})();
