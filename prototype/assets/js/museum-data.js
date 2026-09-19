/* Muuzee Museum Data — shared source of truth */
(() => {
  "use strict";

  const BASE = [
    {id:"nact",name:"国立新美術館",scope:"jp",region:"関東",prefecture:"東京都",city:"港区",location:"六本木",category:"企画展 / 建築",image:"https://www.nact.jp/english/tips/media/01_tips_Exteriorview%20_Facade.jpg",lat:35.6653,lng:139.7264,popularRank:1},
    {id:"mori",name:"森美術館",scope:"jp",region:"関東",prefecture:"東京都",city:"港区",location:"六本木",category:"現代美術",image:"https://cdn.cheapoguides.com/wp-content/uploads/sites/2/2025/04/AB782347-3FBF-4960-AEFE-EA1E4EC664F1_1_201_a-770x578.jpeg",lat:35.6605,lng:139.7292,popularRank:2},
    {id:"tnm",name:"東京国立博物館",scope:"jp",region:"関東",prefecture:"東京都",city:"台東区",location:"上野",category:"日本美術 / 東洋美術",image:"https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&fm=jpg&q=82&w=1200",lat:35.7188,lng:139.7765},
    {id:"nmwa",name:"国立西洋美術館",scope:"jp",region:"関東",prefecture:"東京都",city:"台東区",location:"上野",category:"西洋美術 / 近代美術",image:"https://images.unsplash.com/photo-1545987796-200677ee1011?auto=format&fit=crop&fm=jpg&q=82&w=1200",lat:35.7154,lng:139.7759},
    {id:"artizon",name:"アーティゾン美術館",scope:"jp",region:"関東",prefecture:"東京都",city:"中央区",location:"京橋",category:"近現代美術",image:"https://images.unsplash.com/photo-1554907984-15263bfd63bd?auto=format&fit=crop&fm=jpg&q=82&w=1200",lat:35.6786,lng:139.7717},
    {id:"mot",name:"東京都現代美術館",scope:"jp",region:"関東",prefecture:"東京都",city:"江東区",location:"清澄白河",category:"現代美術",image:"https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&fm=jpg&q=82&w=1200",lat:35.6797,lng:139.8086},
    {id:"hokusai",name:"すみだ北斎美術館",scope:"jp",region:"関東",prefecture:"東京都",city:"墨田区",location:"両国",category:"日本美術 / 葛飾北斎",image:"https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&fm=jpg&q=82&w=1200",lat:35.6967,lng:139.8004},
    {id:"21kanazawa",name:"金沢21世紀美術館",scope:"jp",region:"中部",prefecture:"石川県",city:"金沢市",location:"金沢",category:"現代美術 / 建築",image:"https://visitkanazawa.jp/lsc/upfile/articleDetail/0000/0906/906_2_xl.jpg",lat:36.5609,lng:136.6581,popularRank:3},
    {id:"kyocera",name:"京都市京セラ美術館",scope:"jp",region:"関西",prefecture:"京都府",city:"京都市",location:"岡崎",category:"近現代美術 / 日本美術",image:"https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&fm=jpg&q=82&w=1200",lat:35.0129,lng:135.7830},
    {id:"nakanoshima",name:"大阪中之島美術館",scope:"jp",region:"関西",prefecture:"大阪府",city:"大阪市",location:"中之島",category:"近現代美術",image:"https://images.unsplash.com/photo-1554907984-15263bfd63bd?auto=format&fit=crop&fm=jpg&q=82&w=1200",lat:34.6910,lng:135.4905},
    {id:"chichu",name:"地中美術館",scope:"jp",region:"中国・四国",prefecture:"香川県",city:"直島町",location:"直島",category:"現代美術 / 建築",image:"https://img.hankyung.com/photo/202402/01.36007592.1.jpg",lat:34.4492,lng:133.9915,popularRank:4},
    {id:"adachi",name:"足立美術館",scope:"jp",region:"中国・四国",prefecture:"島根県",city:"安来市",location:"安来",category:"日本画 / 庭園",image:"https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&fm=jpg&q=82&w=1200",lat:35.3806,lng:133.1944},

    {id:"louvre",name:"ルーヴル美術館",scope:"overseas",country:"フランス",city:"パリ",location:"Paris",category:"古典 / 西洋美術",image:"https://images.unsplash.com/photo-1500039436846-25ae2f11882e?auto=format&fit=crop&fm=jpg&q=82&w=1200",lat:48.8606,lng:2.3376,popularRank:5},
    {id:"pompidou",name:"Centre Pompidou",scope:"overseas",country:"フランス",city:"パリ",location:"Paris",category:"近現代美術 / 建築",image:"https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&fm=jpg&q=82&w=1200",lat:48.8606,lng:2.3522,popularRank:9},
    {id:"moma",name:"MoMA",scope:"overseas",country:"アメリカ",city:"ニューヨーク",location:"New York",category:"近現代美術",image:"https://images.unsplash.com/photo-1576531946810-5b358dc8d545?auto=format&fit=crop&fm=jpg&q=82&w=1200",lat:40.7614,lng:-73.9776,popularRank:6},
    {id:"met",name:"The Metropolitan Museum of Art",scope:"overseas",country:"アメリカ",city:"ニューヨーク",location:"New York",category:"古代 / 西洋美術 / 現代美術",image:"https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&fm=jpg&q=82&w=1200",lat:40.7794,lng:-73.9632},
    {id:"tate",name:"Tate Modern",scope:"overseas",country:"イギリス",city:"ロンドン",location:"London",category:"近現代美術",image:"https://images.unsplash.com/photo-1671668943401-c296f0009358?auto=format&fit=crop&fm=jpg&q=82&w=1200",lat:51.5076,lng:-0.0994,popularRank:7},
    {id:"guggenheim",name:"Guggenheim Museum Bilbao",scope:"overseas",country:"スペイン",city:"ビルバオ",location:"Bilbao",category:"現代美術 / 建築",image:"https://images.unsplash.com/photo-1748790485676-b36207bd1cb7?auto=format&fit=crop&fm=jpg&q=82&w=1200",lat:43.2687,lng:-2.9340,popularRank:8},
    {id:"rijks",name:"Rijksmuseum",scope:"overseas",country:"オランダ",city:"アムステルダム",location:"Amsterdam",category:"西洋美術 / オランダ絵画",image:"https://images.unsplash.com/photo-1545987796-200677ee1011?auto=format&fit=crop&fm=jpg&q=82&w=1200",lat:52.3600,lng:4.8852},
    {id:"prado",name:"Museo del Prado",scope:"overseas",country:"スペイン",city:"マドリード",location:"Madrid",category:"西洋美術 / 古典",image:"https://images.unsplash.com/photo-1500039436846-25ae2f11882e?auto=format&fit=crop&fm=jpg&q=82&w=1200",lat:40.4138,lng:-3.6921}
  ];

  const DETAILS = {
    nact:{
      description:"六本木の文化拠点として、多彩な企画展・公募展を開催する美術館。波打つガラスファサードを持つ建築空間も大きな特徴で、特定のコレクションを持たず、展覧会活動そのものを中心に据えています。",
      address:"東京都港区六本木7-22-2",
      access:["東京メトロ千代田線 乃木坂駅 青山霊園方面改札6出口直結","東京メトロ日比谷線・都営大江戸線 六本木駅から徒歩約5分"],
      hours:"10:00 — 18:00",
      closed:"火曜日",
      openingNote:"展覧会によって金・土曜の夜間開館があります。",
      collectionNote:"国立新美術館は特定のコレクションを持たない美術館です。"
    },
    mori:{
      description:"六本木ヒルズ森タワー最上層に位置し、現代美術を軸に世界各地のアート、建築、デザインを紹介する美術館。都市と文化を横断する国際的な展覧会を継続的に展開しています。",
      address:"東京都港区六本木6-10-1 六本木ヒルズ森タワー53F",
      access:["東京メトロ日比谷線 六本木駅1C出口から徒歩約3分","都営大江戸線 六本木駅3出口から徒歩約6分"],
      hours:"10:00 — 22:00",
      closed:"会期中無休を基本",
      openingNote:"火曜日など一部曜日は閉館時刻が異なる場合があります。"
    },
    nmwa:{
      description:"上野公園に位置する西洋美術専門の国立美術館。松方コレクションを核に、ルネサンス以降の絵画やロダンを中心とした彫刻などを収蔵し、ル・コルビュジエ設計の本館も重要な見どころです。",
      address:"東京都台東区上野公園7-7",
      access:["JR上野駅 公園口から徒歩約1分","京成上野駅から徒歩約7分"],
      hours:"9:30 — 17:30",
      closed:"月曜日",
      openingNote:"曜日・展覧会により夜間開館があります。"
    },
    artizon:{
      description:"石橋財団コレクションを中心に、印象派、日本近代洋画、20世紀美術から現代美術までを横断して紹介する美術館。東京・京橋で作品との近い距離感を意識した展示を展開しています。",
      address:"東京都中央区京橋1-7-2",
      access:["JR東京駅 八重洲中央口から徒歩約5分","東京メトロ銀座線 京橋駅から徒歩約5分"],
      hours:"10:00 — 18:00",
      closed:"月曜日",
      openingNote:"展覧会によって開館日・時間が変更される場合があります。"
    },
    "21kanazawa":{
      description:"金沢の中心部にある現代美術館。SANAAによる円形の建築は街に開かれた構成を持ち、恒久展示作品と企画展を行き来しながら、日常の延長で現代美術に触れられる場をつくっています。",
      address:"石川県金沢市広坂1-2-1",
      access:["金沢駅から路線バスで「広坂・21世紀美術館」下車","兼六園・金沢城公園から徒歩圏"],
      hours:"10:00 — 18:00",
      closed:"月曜日",
      openingNote:"交流ゾーンは展覧会ゾーンと開館時間が異なります。"
    },
    chichu:{
      description:"瀬戸内海・直島の景観と一体化するように地中に建てられた美術館。安藤忠雄の建築空間の中で、クロード・モネをはじめとする作品を自然光とともに体験できます。",
      address:"香川県香川郡直島町3449-1",
      access:["宮浦港から町営バス・シャトルバス等を利用","ベネッセアートサイト直島エリア"],
      hours:"10:00 — 18:00",
      closed:"月曜日",
      openingNote:"季節によって開館時間が異なります。日時指定予約制の場合があります。"
    },
    louvre:{
      description:"パリ中心部の旧王宮を舞台に、古代文明から19世紀までの膨大な作品を収蔵する世界有数の美術館。建築そのものの歴史とコレクションを一体で体験できます。",
      address:"Rue de Rivoli, 75001 Paris, France",
      access:["Métro Palais Royal – Musée du Louvre","セーヌ川右岸、チュイルリー庭園隣接"],
      hours:"9:00 — 18:00",
      closed:"火曜日",
      openingNote:"曜日により夜間開館があります。最新情報は公式案内を確認してください。"
    },
    moma:{
      description:"ニューヨーク近代美術館。絵画、彫刻、写真、映画、建築、デザインまで、近現代の表現を横断するコレクションと展覧会で知られています。",
      address:"11 W 53rd St, New York, NY 10019, USA",
      access:["Subway E / M 5 Av–53 St","Midtown Manhattan"],
      hours:"10:30 — 17:30",
      closed:"原則毎日開館",
      openingNote:"特別開館・イベント日は時間が変更される場合があります。"
    },
    tate:{
      description:"ロンドンの旧発電所を転用した現代美術館。巨大なタービンホールを中心に、20世紀以降の国際的な現代美術をテーマ別に紹介しています。",
      address:"Bankside, London SE1 9TG, United Kingdom",
      access:["Blackfriars駅・Southwark駅から徒歩圏","Millennium Bridge南側"],
      hours:"10:00 — 18:00",
      closed:"原則毎日開館",
      openingNote:"特別日を除き入館無料のコレクション展示があります。"
    },
    guggenheim:{
      description:"フランク・ゲーリー設計の建築で知られるビルバオの現代美術館。彫刻的な建築と大規模な展示空間を生かし、20世紀から現代までの作品を紹介しています。",
      address:"Abandoibarra Etorb., 2, 48009 Bilbao, Spain",
      access:["Bilbao中心部からトラム・徒歩でアクセス","Nervión川沿い"],
      hours:"10:00 — 20:00",
      closed:"季節・曜日により異なる",
      openingNote:"開館日は時期によって変わるため公式案内を確認してください。"
    },
    pompidou:{
      description:"パリの文化複合施設。近現代美術の大規模なコレクションを核に、建築、デザイン、映像などを横断する文化拠点として機能しています。",
      address:"Place Georges-Pompidou, 75004 Paris, France",
      access:["Métro Rambuteau / Hôtel de Ville","マレ地区から徒歩圏"],
      hours:"11:00 — 21:00",
      closed:"火曜日",
      openingNote:"改修・運営状況により公開範囲が変わる場合があります。"
    }
  };

  const fallbackDescription = museum => {
    const place = museum.scope === "jp"
      ? [museum.prefecture,museum.city,museum.location].filter(Boolean).join("・")
      : [museum.city,museum.country].filter(Boolean).join("・");
    return `${place}にある${museum.category}を中心とした美術館。Muuzeeでは開催展覧会、アクセス、開館情報、コレクションをまとめて確認できます。`;
  };

  window.MuuzeeMuseumCatalog = BASE.map(museum => ({
    ...museum,
    description:fallbackDescription(museum),
    address:museum.scope === "jp"
      ? [museum.prefecture,museum.city,museum.location].filter(Boolean).join(" ")
      : [museum.city,museum.country].filter(Boolean).join(", "),
    access:["公共交通機関からのアクセス情報を掲載予定"],
    hours:"施設情報を確認",
    closed:"施設情報を確認",
    openingNote:"開館情報は変更される場合があります。",
    ...DETAILS[museum.id]
  }));
})();
