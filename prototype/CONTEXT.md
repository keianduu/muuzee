# Muuzee Prototype Context

Last reviewed: 2026-09-11

このファイルは、Muuzee Prototype開発を新しいChatGPT / Codexセッションへ引き継ぐためのCurrent Contextです。

過去ログを蓄積するためのファイルではありません。
仕様変更時は古い情報を残して追記するのではなく、原則として現在の状態へ更新してください。

---

## 1. Muuzee

Muuzeeは、アート・展覧会・美術館・アーティストとの出会いを支援する Art Discovery / Art Profile サービスです。

Brand message:

`Discover art. Broaden your world.`

基本思想:

`Art first. UI stays quiet.`

初期提供形態:

- 日本向け
- Web
- PWA

---

## 2. Prototypeの位置づけ

Prototypeは正式Production実装ではなく、UI / UX / Interaction / Product仕様を探索するための環境です。

役割:

- `prototype/` = Exploration
- Notion = Approved What / Why / Decisions
- `src/` = Future Production Implementation

Prototypeで実装・検証しただけの内容を、自動的に正式仕様へ昇格させないでください。

以下のような明示的な判断があった場合に正式仕様として扱います。

- 採用
- これで行く
- 仕様にする
- Productionへ反映する
- 正式化する

---

## 3. 実装時のSource of Truth

Prototypeを修正する際は、過去チャットの記憶より現在のRepositoryを優先してください。

確認優先順位:

1. `prototype/design-guide.html`
2. `prototype/assets/css/muuzee-global.css`
3. `prototype/assets/js/muuzee-global.js`
4. その他の既存Shared CSS / JS
5. 関連する既存ページ
6. 対象ページ固有実装

古い会話をもとに、Selector、関数名、DOM構造、Component構造を推測して変更しないでください。

まず現行ファイルを確認してください。

---

## 4. Context参照ルール

新しいChatGPT / Codexセッションでは、まずこの `prototype/CONTEXT.md` を確認してください。

その後、今回の作業に必要なファイルだけを確認してください。

原則:

- Repository全体を無条件に読まない
- Notion全体を無条件に読まない
- 過去チャット全体を無条件に参照しない
- `prototype/` 以下を優先する
- 今回の作業に必要な範囲から確認する
- 不足した場合のみ参照範囲を広げる

Notionは、Approved仕様、Why、Decision、Production影響の確認が必要な場合に参照します。

---

## 5. Global / Page Responsibility

役割を以下のように分離します。

### HTML

ページ固有の構造・コンテンツ。

### Global CSS

全ページ共通のDesign Rule、Shared Component、Layout Rule。

### Global JS

全ページ共通のInteraction、State、Shared Behavior。

### Page CSS / JS

そのページだけに必要な実装。

Shared Componentを各ページにコピーして個別実装しないでください。

Global Ruleを変更した場合は、必要に応じて `design-guide.html` も更新してください。

---

## 6. Implementation Principle

要件を満たす最も単純で保守しやすい実装を優先してください。

避けるもの:

- 不要なObserver
- 二重State
- 不要なState Layer
- 推論ベースの複雑な処理
- 不要な抽象化
- 重複ロジック
- ページごとのShared Componentコピー
- タイトル一致による例外処理
- 特定画像に依存する処理
- 特定IDに依存する処理
- 特定件数に依存する処理

既存の以下で解決できる場合は、それを優先します。

- Existing Event
- Existing State
- Shared Component
- Direct Mapping
- Existing Utility

入力データが変化しても成立する汎用的な実装を優先してください。

---

## 7. Design Guide / Typography

基本Font Sizeは原則:

- 14px
- 12px
- 10px

都合だけで以下のような中間サイズを増やさないでください。

- 9px
- 11px
- 13px

既存Token、Shared Component、Design Guideを優先してください。

Font Audit等の確認プロセスが存在する場合は、完了前に確認してください。

---

## 8. Shared Components

以下は原則Shared Componentとして扱います。

- Header
- Hamburger Menu
- Footer Navigation
- Save
- Save / Seen
- Save Control
- Map UI
- タイトル右側CTA
- その他Global化済みUI

ページ固有の見た目にする必要がない限り、既存Global Componentを再利用してください。

---

## 9. Interaction Rules

Interactive elementを不正にネストしないでください。

特に禁止:

`<a>` の中に `<button>` を配置する構造。

Mobile / SP実機相当のInteractionを重視します。

重点確認対象:

- Header
- Drawer
- Overlay
- Map
- Safe Area
- Horizontal Scroll
- Touch Interaction
- z-index
- Fixed UI
- Bottom UI

CSS / JSを更新した場合は、必要に応じて `?v=` を更新してCache Bustしてください。

---

## 10. User Area Naming

ユーザー個人領域のUI名称は:

`My Art`

を使用します。

今後、UI上では原則として以下を使用しません。

- マイページ
- MyPage

ただし、既存技術名称は明示的なRefactor依頼がない限り維持して構いません。

例:

- `mypage-*`
- 既存File Name
- Existing Class Name

---

## 11. My Art

基本構成:

- 左: User Icon + Name
- 右: Profile Setting CTA
- ArtWall
- 保存
- 見た
- 推し

各Section:

- Horizontal Scroll
- 一覧への導線
- 不要な説明文は置かない

「推し」の対象:

- Artist
- Venue

保存解除時:

- Confirmation Popupを表示

---

## 12. ArtWall

ArtWallはPrototype内のShared Storeとして管理します。

Store:

`MuuzeeArtWallStore`

Prototype Persistenceとして以下を保持します。

- `exhibitionOrder`
- `background`
- `columns`
- `wallHeightMode`
- `schemaVersion`
- `savedAt`

`exhibitionOrder` はArtWallのメンバーシップと表示順を兼ねます。

Current Default:

- 4 columns

Requirements:

- 再描画後も状態を復元
- localStorageへ保存
- TOP側にも状態を反映

---

## 13. Save UI

Save Controlはデータ内容に依存しないShared UIとして実装します。

基本Rule:

- Card右上
- Image上に配置
- ON Colorは全ページ統一
- Animationあり

Interactive elementのネストを避けるため、Card Link内では原則:

`span.muuzee-card-save`

等のShared Patternを使用します。

対象:

- Exhibition
- Artist
- Venue
- その他Save可能Entity

タイトル、画像、ID、件数等に依存した個別実装を作らないでください。

---

## 14. Footer Navigation

原則として全ページ共通です。

Items:

1. ホーム
2. 展示会一覧
3. アーティスト一覧
4. 美術館一覧

特別な理由がない限りページ単位の例外を作りません。

---

## 15. TOP

主なSection:

- 人気の美術館
- 近くの美術館
- おすすめ展示会

近くの美術館:

- Map Searchへの導線

各Section:

- 一覧CTAあり
- Warm系Background
- Detail / ListとのCard UI共通化を優先

---

## 16. Artist

### Artist List

SP:

- 3 columns

### Artist Detail

- Main Imageは横幅いっぱい
- Related Exhibition / 開催情報はTOPおすすめ展示会UIと揃える
- Bottom Sheet等もShared Designへ合わせる

---

## 17. Exhibition

Exhibition DetailにはArtist情報を表示します。

Artist情報:

- Icon
- Name
- Category
- 出身地
- Artist Save Control

Artistが5名以上の場合:

- 「もっと見る」を使用

「同じ施設の展覧会」はTOPの「おすすめ展示会」と同じUIを使用します。

Image Layoutは以下の両方で成立するようにします。

- Portrait
- Landscape

特定画像だけに合わせた処理は作らないでください。

---

## 18. Venue

Venue Detailの主な情報:

- 解説
- 住所
- Access
- Map
- 開館情報
- 開催中の展覧会
- 開催予定の展覧会
- Schedule
- 所蔵作品
- 所蔵Artist

TOP / List / Detail間で以下をできるだけShared化します。

- Card
- Save
- Image behavior
- Typography
- CTA

---

## 19. Map Search

Global Header / Footerを使用します。

Map上部:

- 展示会
- 美術館

の切替UI。

Tooltip:

- 横長
- 左: Image
- 右: Information

Requirements:

- Saved ItemをHighlight
- Detailへ遷移
- 右下に検索CTA

特にSPで確認するもの:

- CTA Layer
- Overlay
- z-index
- Safe Area
- Touch
- Tooltip Position

---

## 20. Terminal / Git Operation

Terminal Commandは原則として一括Copy & Paste可能な形式で提示してください。

Command内には不要な以下を混ぜません。

- コメント行
- 説明文
- 不要なOutput

複数FileをArtifactとして渡す必要がある場合は、Repository Relative Pathを維持したZIPも選択肢です。

変更後は、必要に応じてGitHub Pages等で確認できるところまで案内します。

---

## 21. Shell Script Rule

Prototype作業用 `.sh` は、正常完了した場合だけ自分自身を削除します。

例:

`6/6 完成`

まで到達した場合:

- 自分自身を削除

途中でError終了した場合:

- `.sh` を残す
- 再実行・原因調査に使用できる状態にする

---

## 22. Notion

Notionは以下を記録する場所です。

- Approved Change
- Product Decision
- Why
- Productionに影響する仕様
- Global Design Rule変更
- Shared Componentの正式変更

一方、以下のような探索段階の小変更では毎回Notion更新を強制しません。

- Prototype上の微調整
- 一時的CSS検証
- 採用未確定のUI探索

---

## 23. AGENTS.mdとの役割分担

`AGENTS.md`

- AIが継続的に守る恒久Rule
- Coding / Repository Operation Rule
- Design / Implementationの基本原則

`prototype/CONTEXT.md`

- Prototypeの現在地
- Current Product / UI仕様
- 新しいSessionへの引き継ぎ情報

`prototype/design-guide.html`

- Current UI / Design Source of Truth

Notion

- Approved What
- Why
- Decisions

---

## 24. Current Exploration Status

Friend Card / Group Card等の具体的な見た目は現在もExploration段階です。

そのため、未確定のVisual Detailを恒久Ruleとして `AGENTS.md` 等へ固定しないでください。

---

## 25. 新しいSession開始時の推奨指示

新しいChatGPT / Codex Sessionでは、以下の方針で開始します。

1. `prototype/CONTEXT.md` を読む
2. `AGENTS.md` を確認する
3. 今回の依頼に関連するCurrent Fileだけを確認する
4. 必要なら `prototype/design-guide.html` を確認する
5. 必要な場合のみNotionやPrototype外へ参照範囲を広げる

Repository全体、Notion全体、過去Conversation全体を無条件に読み込まないでください。

修正時は過去の記憶だけでPatchを作らず、Current FileをSource of Truthとして扱ってください。

<!-- login-prototype-exploration:start -->
## Login / Guest Save — Approved Product Behavior

- Status: **Approved**（2026-09-11）
- Product Requirement: https://app.notion.com/p/3d8c2c71037681328744d322da2c851e
- Design & Implementation Log: https://app.notion.com/p/3d8c2c71037681118960ed5057ee8557
- Product Behaviorとして、未ログインでもSaveと保存一覧を利用可能とする。
- Save成功後はFooter付近から会員導線Tooltipを下から静かにSlide Up表示する。Save解除時は表示しない。
- Footer「保存」は未ログインでも `saved.html` へ遷移する。
- 未ログインのSavedではProfile Headerと保存 / 観た / 推しのPrimary Navigationを非表示にし、展示会 / 美術館 / アーティスト / 作品のCategory以降を表示する。
- My Art / Profile Settingsは認証必須。未ログイン直アクセス時はPersonal Contentを表示せずShared Login Popupを開く。
- Detailの「観た」は未ログイン時のみ非表示。
- TOP ArtWallは未ログイン時もVisual Previewを表示し、「自分のArtWallを作る」CTAからLogin Popupへ誘導する。
- Login / RegisterはShared Popup。Radio semantics + Segmented Control visualとし、Register選択時のみ利用規約・プライバシーポリシー同意を表示する。
- Register成功後はProfile Settingsへ遷移する。
- ログイン中のHamburger Personal Navigationは My Art / 保存 / ログアウト。ArtWall単独導線は置かない。
- Prototypeでは認証状態をURL `?loginID=...` で表現し、Static User Config + localStorage Overlayを使用する。不明な `loginID` は未ログイン扱い。
- URL Parameter / localStorage CredentialはPrototype検証用であり、Production Auth方式としては採用しない。Productionでは正式なAuthentication / Session / User DBへ置換する。
- Guest SaveをAccountへ引き継ぐ方式はProduction設計時に定義する。
<!-- login-prototype-exploration:end -->

## ArtWall 「観た」展示会 Editor Test Mode

- `artwall-edit.html?seenCount=N` で、Prototype用の「観た」展示会件数を `0〜100` の任意件数で確認できる。
- Fixtureは `prototype/assets/js/artwall-seen-fixtures.js` に100件保持する。展示会IDは一意、画像重複は許容する。
- `seenCount` 指定時はその件数を正確なmembershipとして扱い、最低件数へのダミー補完はしない。
- 「観た」展示会Popupは全件orderをデータ側で保持し、表示は20件ずつ追加する。
- 各アイテムはDragで個別並び替えでき、複数選択時はFooterから「先頭へ / 末尾へ」を実行できる。
- 一括移動時は選択アイテム同士の相対順を維持する。

## Shared ArtWall Prototype Data

- TOPのGuest / Logged-in ArtWallは同じ `MuuzeeArtWallDataSource` を利用する。認証状態で変えるのはCopy / CTA等のPersonal UIであり、展示会Data Sourceは分けない。
- 通常のArtWall Data Sourceは `MuuzeeExhibitionCatalog` を優先し、不足分を `MuuzeeArtWallSeenFixtures` のfile-backed fixtureで補う。旧Base64 Dummyは通常表示Data Sourceに含めない。
- Prototype Fixtureの画像は `./assets/...` のpage-relative pathで保持し、Shared ArtWall Component側で `document.baseURI` を基準に解決する。LOCALの `/prototype/` とGitHub PagesのRepository subpathの両方に対応する。
- 「観た」展示会Editorの選択は専用Checkbox/Circleを表示せず、Row tapによる背景切替で表現する。選択件数と「先頭へ / 末尾へ」はFooterに表示する。
