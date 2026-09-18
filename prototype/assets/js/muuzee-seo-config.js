/* Muuzee Prototype SEO page configuration — data only */
window.MuuzeeSeoConfig = Object.freeze({
  version:1,
  pages:Object.freeze({
    home:{route:"index.html",label:"ホーム",href:"./index.html",parent:null,structuredData:true,indexable:true},
    exhibitions:{route:"exhibitions.html",label:"展覧会",href:"./exhibitions.html",parent:"home",structuredData:true,indexable:true,facets:{
      area:{order:10},
      category:{order:20}
    }},
    exhibition:{route:"exhibition.html",label:"",href:"",parent:"exhibitions",structuredData:true,indexable:true,dynamicLabel:true},
    artists:{route:"artists.html",label:"アーティスト",href:"./artists.html",parent:"home",structuredData:true,indexable:true},
    artist:{route:"artist.html",label:"",href:"",parent:"artists",structuredData:true,indexable:true,dynamicLabel:true},
    museums:{route:"museums.html",label:"美術館",href:"./museums.html",parent:"home",structuredData:true,indexable:true,facets:{
      area:{order:10},
      category:{order:20}
    }},
    museum:{route:"museum.html",label:"",href:"",parent:"museums",structuredData:true,indexable:true,dynamicLabel:true},
    map:{route:"map.html",label:"地図から探す",href:"./map.html",parent:"home",structuredData:true,indexable:true},
    myArt:{route:"my-art.html",label:"My Art",href:"./my-art.html",parent:"home",structuredData:false,indexable:false},
    artwallEdit:{route:"artwall-edit.html",label:"ArtWallを編集",href:"./artwall-edit.html",parent:"myArt",structuredData:false,indexable:false},
    profileSettings:{route:"profile-settings.html",label:"プロフィール設定",href:"./profile-settings.html",parent:"myArt",structuredData:false,indexable:false},
    notifications:{route:"notifications.html",label:"通知",href:"./notifications.html",parent:"myArt",structuredData:false,indexable:false},
    notificationSettings:{route:"notification-settings.html",label:"通知設定",href:"./notification-settings.html",parent:"myArt",structuredData:false,indexable:false},
    friends:{route:"friends.html",label:"フレンド",href:"./friends.html",parent:"myArt",structuredData:false,indexable:false},
    groups:{route:"groups.html",label:"グループ",href:"./groups.html",parent:"myArt",structuredData:false,indexable:false},
    seen:{route:"seen.html",label:"見た",href:"./seen.html",parent:"myArt",structuredData:false,indexable:false},
    favorites:{route:"favorites.html",label:"お気に入り",href:"./favorites.html",parent:"myArt",structuredData:false,indexable:false},
    saved:{route:"saved.html",label:"保存",href:"./saved.html",parent:"home",structuredData:false,indexable:false},
    contact:{route:"contact.html",label:"お問い合わせ",href:"./contact.html",parent:"home",structuredData:true,indexable:true},
    privacyPolicy:{route:"privacy-policy.html",label:"プライバシーポリシー",href:"./privacy-policy.html",parent:"home",structuredData:true,indexable:true},
    disclaimer:{route:"disclaimer.html",label:"免責事項",href:"./disclaimer.html",parent:"home",structuredData:true,indexable:true}
  })
});
