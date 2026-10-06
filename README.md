# ORPHE-CORE-INSOLE.js Examples

ORPHE CORE と ORPHE INSOLE の Web Bluetooth サンプル集です。
ORPHE-CORE.js と ORPHE-INSOLE.js にあった examples を集め、ライブラリを共通 SDK の
[ORPHE-CORE-INSOLE.js](https://github.com/Orphe-OSS/ORPHE-CORE-INSOLE.js)（`orphe-core-insole.js`）に置き換えています。

一覧はルートの `index.html`（ギャラリー）から開けます。カテゴリ・デバイス（CORE / INSOLE）・難易度・キーワードで絞り込めます。
`index.html?all=1` を開くと、一覧から外している内部向けの example も表示します。

## ライブラリの読み込み

各 example は jsDelivr から次の 2 ファイルを読み込みます。

```html
<!-- SDK 本体（Orphe / OrpheInsole / OrpheInsoleUtils などをグローバルに置く） -->
<script src="https://cdn.jsdelivr.net/gh/Orphe-OSS/ORPHE-CORE-INSOLE.js@v0.1.0/dist/browser/orphe-core-insole.js"></script>
<!-- 接続 UI（buildCoreToolkit / buildInsoleToolkit / buildCoreCompanionToolkit）。使う example だけ -->
<script src="https://cdn.jsdelivr.net/gh/Orphe-OSS/ORPHE-CORE-INSOLE.js@v0.1.0/dist/browser/orphe-core-insole-toolkit.js"></script>
```

- SDK は旧ライブラリ互換の `Orphe`（CORE）と `OrpheInsole`（INSOLE）を提供します。example のコードは `new Orphe(0)` や `gotAcc = …` のまま動きます。
- `Orphe` は常に CORE のクラスです。INSOLE は `OrpheInsole` を使ってください（旧 ORPHE-INSOLE.js の `Orphe` 別名はありません）。
- Toolkit が作る `cores`（= `bles`）と `insoles` をそのまま使います。example 側で `var bles = [new Orphe(0), …]` と作り直すと、Toolkit が接続するインスタンスと別物になりコールバックが届きません。
- 旧ライブラリで別ファイルだった `float16.min.js`・`quaternion.js`・`BleSharedBridge.js`・`InsoleUtils.js`・`InsoleFifo.js`・`InsoleGait.js`・`InsoleSimulator.js` は SDK に含まれます。

> **注意:** `v0.1.0` のタグが ORPHE-CORE-INSOLE.js に発行されるまで、上の CDN URL は 404 になります。
> それまではローカル検証（下記）で動かしてください。

## 構成

```
index.html, gallery.js, catalog.json   ギャラリー（catalog.json がカード一覧の正本）
assets/                                共有資産（css / js / images / models / fonts）
_thumbnails/                           ギャラリー用サムネイル（insole-* は ORPHE-INSOLE.js 由来）
VISUALIZE/ SENSOR-DASHBOARD/ TERMINAL/ UDON/
                                       CORE と INSOLE の両方に対応した example（スロットごとに種別を選ぶ）
大文字のディレクトリ                    ORPHE-CORE.js 由来の example
小文字のディレクトリ                    ORPHE-INSOLE.js 由来の example
scripts/                               移行・検証用スクリプト
```

CORE / INSOLE の両対応 example は `assets/js/device-slot.js` でデバイス種別を選びます。
種別は URL の `?slot0=core&slot1=insole` でも指定できます。

## ローカルで動かす

Web Bluetooth は https または localhost でのみ動きます（Chrome / Edge）。

```bash
python3 -m http.server 8080
# → http://localhost:8080/
```

### 未リリースの SDK で試す

1. ORPHE-CORE-INSOLE.js で `npm run build:browser` を実行します。
2. 出力された `dist/browser/orphe-core-insole.js` と `orphe-core-insole-toolkit.js` を、このリポジトリの `vendor/` にコピーします（`vendor/` は .gitignore 済み）。
3. 読み込み先を切り替えます。

```bash
node scripts/toggle-cdn.mjs local   # CDN → ../vendor/
node scripts/toggle-cdn.mjs cdn     # 元に戻す（コミット前に必ず実行）
```

## 検証

```bash
node scripts/check-links.mjs
```

相対パスの参照切れ、catalog.json のリンク・サムネイル、旧ライブラリの `<script>` の残りを確認します。

## example を追加するとき

1. ルート直下にディレクトリを作り、上記の 2 ファイルを読み込みます。共有資産は `../assets/...` で参照します。
2. `catalog.json` の `entries` に追加します。パスはリポジトリルート基準で、`device` に `core` / `insole` / `both` を書きます。
3. 日本語のタイトルと説明は `gallery.js` の `entryTextJa` に追加します。
4. `node scripts/check-links.mjs` を実行します。

## 移元から変えたこと

- `FOOT ANGLE` を `FOOT-ANGLE` に改名しました（URL の空白を避けるため）。
- 次の 4 組は 1 つにまとめました。
  - CORE の VISUALIZE と INSOLE の VISUALIZE を `VISUALIZE` にまとめました。
  - CORE の GAME-UDON と INSOLE の udon を `UDON` にまとめました。
  - CORE の INFORMATION と INSOLE の terminal を `TERMINAL` にまとめました。
  - CORE の VIEW と INSOLE の sensor-dashboard を `SENSOR-DASHBOARD` にまとめました。
- ORPHE-INSOLE.js の Node テスト（`test-*.mjs`）は、旧 `src/` に依存するため含めていません。元のリポジトリで実行してください。
- ORPHE-CORE.js サイトの starter-templates・docs・ワークショップ資料は example ではないため、ギャラリーから外しました。

## 免責

ORPHE INSOLE を使う example は医療機器ではなく、疾病の診断・治療・予防を目的としていません。
