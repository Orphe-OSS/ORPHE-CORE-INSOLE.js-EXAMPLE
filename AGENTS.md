# AGENTS.md

このリポジトリで example を作成・変更するときのルールです。人と AI エージェントの両方が従います。
example の追加手順と検証コマンドは [README.md](README.md) の「example を追加するとき」「検証」を参照してください。

## README の「作成情報」は必須

各 example の `README.md` には、タイトルと概要の直後に次のブロックを置きます。

```markdown
## 作成情報

| 項目 | 内容 |
|---|---|
| 作成者 | Yuya Kikukawa（kikyu） |
| 対応 FW | CORE: 2026.10.01 以降 |
| 前提にしている仕様 | ORPHE CORE 2 台 / SENSOR_VALUES（Realtime）/ SDK v0.3.0 |

### 動作確認済み FW

| FW | デバイス | 確認者 | 確認日 |
|---|---|---|---|
| 2026.10.01 | ORPHE CORE ×2 | Yuya Kikukawa | 2026-11-20 |
```

- **作成者**
  - 新しく作るときは、コミットする Git ユーザー名（`git config user.name`）を書きます。
  - 既存の example は、移行元の ORPHE-CORE.js / ORPHE-INSOLE.js で最初にコミットした人を書いています。表記は人ごとに揃え、元の Git ユーザー名を括弧で添えます。
  - CORE 版と INSOLE 版を 1 つにまとめた example では、「作成者（CORE 版）」と「作成者（INSOLE 版）」の 2 行に分けます。
- **対応 FW**
  - 分からないときは推測で書かず、作成時または実装時に質問手段でユーザーに聞きます。
- **前提にしている仕様**
  - 次の項目を書きます。
    - 使うデバイス（CORE / INSOLE）と台数
    - データモード（Realtime / FIFO / STEP_ANALYSIS など）
    - streamingMode やプロファイル
    - SDK の版
    - 依存している FW の挙動
- **動作確認済み FW**
  - 作成者が実機で確認した FW だけを、確認者・確認日・デバイスと一緒に追記します。確認していない FW は書きません。
  - 確認する FW が分からないときは、実装時にユーザーに聞きます。
  - 実装が終わったら、どの FW で確認したか（または確認する予定か）を必ずユーザーに聞いてから記録します。
- 不明な項目は「未記入」「（未確認）」のまま残し、推測で埋めません。

## 共通処理はページごとに実装しない

FIFO・欠損判定・serial の連続性解析など、複数の example で使う処理は 1 か所にまとめます。

- **SDK の責務はライブラリで直します。** 対象はライブラリ [ORPHE-CORE-INSOLE.js](https://github.com/Orphe-OSS/ORPHE-CORE-INSOLE.js)（ローカルでは `../ORPHE-CORE-INSOLE.js`）です。
  - SDK の責務の例:
    - プロトコル定数
    - serial の連続性・欠損判定
    - FIFO の統計（lag・dropped・drain）
    - デバイスの挙動の吸収
  - 手順:
    1. ライブラリのリポジトリで `develop` から作業ブランチ（`feat/…` / `fix/…`）を切ります。
    2. 実装とテストを追加し、`npm run check` を通します。
    3. コミット・push して、`gh pr create --base develop` で `develop` への PR を作ります。
    4. リリースされるまで、example 側は [README.md](README.md) の「未リリースの SDK で試す」の手順で確認します。`vendor/` に置いて `node scripts/toggle-cdn.mjs local` で切り替えます。コミット前に `cdn` へ戻します。
- **UI・表示・教材向けの共通処理は `assets/js/` に置きます。**
  - 例: 結果表示、serial マップの描画、i18n 用のラベル
- 新しい example を作る前に、既存の example とライブラリに同じ処理がないか確認します。

### 移行待ちの重複（既知）

次の処理はページごとに重複しています。触るときは、上のルールに沿ってライブラリか `assets/js/` へ寄せます。

- serial の連続性・欠損の解析
  - `fifo-guide/continuity.js` の `analyzeSerials`
  - `lab-recorder/recorder-core.js` の `serialContinuity` と `buildLossReport`
  - `data-modes/metrics.js` の `createSerialTracker`
  - `fifo-vs-realtime/app.js` の `recordSample` と `SERIAL_MOD`
- FIFO コールバックの集計（`handleFifoProgress` / `handleFifoDataLoss` / `handleFifoStopped` など）
  - `fifo-guide/app.js`
  - `lab-recorder/app.js`
  - `data-modes/app.js`
  - `showcase/app.js`
