# Venue Official AI Enrichment Coverage

Date: 2026-09-05  
Environment: LOCAL  
Sample size: 20  
Crawler run: `ae858b38-8cd2-45d3-9883-ea1a35b71fe4`

## Result

| Field | Crawler only | Crawler + AI | Change |
|---|---:|---:|---:|
| Address | 2/20 | 4/20 | +2 |
| Postal code | 5/20 | 5/20 | 0 |
| Opening hours | 3/20 | 7/20 | +4 |
| Closed days | 2/20 | 5/20 | +3 |
| Access | 1/20 | 5/20 | +4 |
| Description | 0/20 | 10/20 | +10 |

Description source自体は14/20で取得でき、十分な施設説明を対象施設へ安全に帰属できた10件で独自要約を生成した。Crawlerの取得結果はsuccess 1、partialまたはno relevant 15、fetch failed 4だった。

## Failure classification

- Fetch failure: DENZAI環境科学館、Amami Wildlife Center、ARTS ISOZAKI、ATELIER MUJI GINZA。AIに渡せる本文がない。
- Wrong / unsafe content: CCA北九州は取得domainの本文が対象施設ではなくオンラインカジノ内容だったため全Fieldを不採用。
- No relevant page: COMBINE/BAMI galleryは構造化に使える対象Venue本文がなかった。
- Mixed entities / pages: Bunkamuraは複数施設の情報が混在し、恒常値を一意に帰属できなかった。Bunkamuraザ・ミュージアムの郵便番号候補も別施設のため不採用。
- Event-specific data: CONTEMPORARY HEISは当該Galleryと別会場の会期別情報が混在し、恒常の営業時間・休廊日として採用できなかった。
- Insufficient venue-specific description: CCGA、BIZEN中南米美術館などは取得本文が財団全体または来館者コメント中心で、説明生成の根拠として不十分な部分があった。

## Preview

AI Structured CSVを既存Venue Master CSV Previewへ投入した結果は、total 20、update 11、unchanged 9、invalid 0、conflicts 0。DBへのConfirmは実行していない。

## Assessment

Official Website Crawler + AI構造化は、公式本文内に存在する営業時間・休館日・Access・Descriptionの回収率を改善する。ただし、住所4/20、営業時間7/20、Access 5/20に留まり、Source B単独でVenue Masterを完了扱いにはできない。

Source Cでは、公式サイトの取得失敗・情報不足を補うAddress、Postal code、Coordinates、Opening hours、Closed days、Accessを優先する必要がある。公式Source本文が誤domain・別施設・期間限定情報を含む場合の対象判定も継続課題である。
