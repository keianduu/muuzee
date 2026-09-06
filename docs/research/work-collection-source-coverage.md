# Work / Collection Source Coverage

Status: Draft research. Checked 2026-09-06.

## Sources reviewed

### Art Platform Japan — SHŪZŌ

全国の美術館収蔵品を横断検索でき、作品名、作家、制作年、所蔵館等を取得できる。Web検索結果はTargeted Artist候補抽出に利用できるが、検索結果順が代表性を保証するとは確認できない。このためv1では候補保存までとする。

### Tokyo Museum Collection (ToMuCo)

公開API v2.0は作品検索、Artist名、Museum、制作年、limit/offsetを提供し、JSON-LDで取得できる。メタデータ利用条件と画像権利は分離されている。LOCAL CLIから403となる環境があるため、adapterは失敗を可視化し、Source全体を成功扱いしない。

## Coverage test design

- 対象: 現在のTier A Artistから最大20件
- 構成: 日本/海外、近現代/現代/歴史系を含む現行Tier A順
- 上限: 1 ArtistあたりSource横断で3〜5候補
- 計測: Artist found、Work found、Candidate数、Holding Venue、Venue Master match、Year、Permanent、Currently displayed
- 保存: Coverage Dry RunではDB変更なし。候補保存でもWork Masterは変更しない。

## Current assessment

SHŪZŌはTargeted candidate sourceとして利用可能。ToMuCoは仕様上有望だが、実行環境からのアクセス可否を別途確認する必要がある。どちらも単独では「代表作品」の安全な自動ランキング根拠にならないため、Source結果順は診断値としてのみ残し、人による選択を維持する。

### LOCAL result (2026-09-06)

| Metric | Result |
| --- | ---: |
| Sample Tier A Artists | 20 |
| Artist found / Work found | 12 / 20 |
| Representative candidates | 50 |
| Average candidates / found Artist | 4.17 |
| Holding explicitly present | 50 / 50 |
| Venue Master exact match | 25 / 50 |
| Year present | 48 / 50 |
| Permanent display explicitly present | 0 / 50 |
| Currently displayed explicitly present | 0 / 50 |
| Candidates saved locally | 50 |
| Work Masters auto-created | 0 |

SHŪZŌは12 Artistで候補を返した。ToMuCoは20/20リクエストがHTTP 403となったため、今回の数値は実質SHŪZŌ coverageである。展示状態0件は欠陥ではなく、HoldingからDisplayを推測しない設計結果である。

## Decision boundary

Coverageが十分でもGlobal Full Syncへは進まない。代表作品用途ではTargeted importを推奨し、Artist/Venueの画面で必要になった範囲だけ候補化する。
