# ORPHE-CORE-INSOLE.js Examples

ORPHE CORE と ORPHE INSOLE の Web Bluetooth サンプル集です。
ORPHE-CORE.js と ORPHE-INSOLE.js にあった examples を集め、ライブラリを共通 SDK の
[ORPHE-CORE-INSOLE.js](https://github.com/Orphe-OSS/ORPHE-CORE-INSOLE.js)（`orphe-core-insole.js`）に置き換えています。

一覧はルートの `index.html`（ギャラリー）から開けます。カテゴリ・デバイス（CORE / INSOLE）・難易度・キーワードで絞り込めます。
`index.html?all=1` を開くと、一覧から外している内部向けの example も表示します。

## ライブラリの読み込み

各 example は jsDelivr から次の 2 ファイルを読み込みます。

```html
<!-- SDK 本体。公開 API はグローバル OrpheCoreInsoleJS に入る -->
<script src="https://cdn.jsdelivr.net/gh/Orphe-OSS/ORPHE-CORE-INSOLE.js@v0.2.1/dist/browser/orphe-core-insole.js"></script>
<!-- 接続 UI（buildCoreToolkit / buildInsoleToolkit / buildCoreCompanionToolkit）。使う example だけ -->
<script src="https://cdn.jsdelivr.net/gh/Orphe-OSS/ORPHE-CORE-INSOLE.js@v0.2.1/dist/browser/orphe-core-insole-toolkit.js"></script>
```

example のコードはすべて新しい共通 API の `OrpheCoreInsole` で書いています。
旧ライブラリ互換の `Orphe` / `OrpheInsole` / `got*` 代入は SDK に残っていますが、example では使いません。

```js
// 接続 UI を使わない場合: 名前空間から取り出して自分で作る
const { OrpheCoreInsole, coreProfile, insoleProfile } = OrpheCoreInsoleJS;
const core = new OrpheCoreInsole({ profile: coreProfile({ namePrefix: 'CR-' }), id: 0 });
core.on('converted_acc', (acc) => console.log(acc.x, acc.y, acc.z));
core.onEvent('onConnect', () => console.log('connected'));
button.onclick = () => core.begin('SENSOR_VALUES');

// 接続 UI を使う場合: toolkit が作る cores[i] / insoles[i]（OrpheCoreInsole）に購読する
buildInsoleToolkit(document.getElementById('toolkit0'), 'INSOLE 01', 0, { streamingMode: 4 });
insoles[0].on('press', (press) => draw(press.values));
```

- `cores`（= `bles`）/ `insoles` / `orpheCore` は toolkit が作ります。example 側で作り直すと、toolkit が接続するインスタンスと別物になり、データが届きません。
- LED や姿勢リセットなどのコマンドは `ble.commands`（例 `cores[0].commands.setLED(true, 2)`）、デバイス情報は `ble.profile.device_information` です。
- 実機が無いときは `OrpheCoreInsoleJS.createInsoleSimulator()` で擬似 INSOLE を使えます（例: `quaternion-validation/?sim=1`）。
- 旧 API との対応表は [ORPHE-CORE-INSOLE.js の README](https://github.com/Orphe-OSS/ORPHE-CORE-INSOLE.js#旧-api-からの移行) にあります。

上記URLは公開済みの `v0.2.1` タグを参照します。未リリースのSDKを検証する場合は、下記のローカル切替手順を使ってください。

## 構成

```
index.html, gallery.js, catalog.json   ギャラリー（catalog.json がカード一覧の正本）
assets/                                共有資産（css / js / images / models / fonts）
_thumbnails/                           ギャラリー用サムネイル（insole-* は ORPHE-INSOLE.js 由来）
VISUALIZE/ SENSOR-DASHBOARD/ TERMINAL/ UDON/
                                       CORE と INSOLE の両方に対応した example（スロットごとに種別を選ぶ）
大文字のディレクトリ                    ORPHE-CORE.js 由来の example
小文字のディレクトリ                    ORPHE-INSOLE.js 由来の example
scripts/                               検証・CDN 切替のスクリプト
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
node scripts/check-links.mjs    # 参照切れ・旧ライブラリ / 互換 API の残り・CDN の版・vendor 参照の残り
node scripts/check-syntax.mjs   # 全 .js と HTML の inline script の構文
```

`check-links.mjs` は相対パスの参照切れ、catalog.json のリンク・サムネイル、旧ライブラリの `<script>`、互換 API（`new Orphe(` や `got* =` など）の残り、`@v0.2.1` 以外の CDN 版、`../vendor/` 参照の戻し忘れを検出します。

## example を追加するとき

1. ルート直下にディレクトリを作り、上記の 2 ファイルを読み込みます。コードは `OrpheCoreInsole` で書きます。共有資産は `../assets/...` で参照します。
2. `catalog.json` の `entries` に追加します。パスはリポジトリルート基準で、`device` に `core` / `insole` / `both` を書きます。
3. 日本語のタイトルと説明は `gallery.js` の `entryTextJa` に追加します。
4. `node scripts/check-links.mjs` と `node scripts/check-syntax.mjs` を実行します。

## 移元から変えたこと

- ライブラリの呼び出しを、旧 `Orphe` / `OrpheInsole` の API から新しい共通 API（`OrpheCoreInsole`）に書き直しました。
- `FOOT ANGLE` を `FOOT-ANGLE` に改名しました（URL の空白を避けるため）。
- 次の 4 組は 1 つにまとめました。
  - CORE の VISUALIZE と INSOLE の VISUALIZE を `VISUALIZE` にまとめました。
  - CORE の GAME-UDON と INSOLE の udon を `UDON` にまとめました。
  - CORE の INFORMATION と INSOLE の terminal を `TERMINAL` にまとめました。
  - CORE の VIEW と INSOLE の sensor-dashboard を `SENSOR-DASHBOARD` にまとめました。
- ORPHE-INSOLE.js の Node テスト（`test-*.mjs`）は、旧 `src/` に依存するため含めていません。元のリポジトリで実行してください。
- ORPHE-CORE.js サイトの starter-templates・docs・ワークショップ資料は example ではないため、ギャラリーから外しました。
- 2 台を使うゲーム（GAME-HURDLE 系・GAME-PINGPONG・MOVEYOURFEET など）は、2 台が接続されてから入力を受け付けます。移行元は接続イベントの回数を数えていたため、1 台目の途中で開始していました。

## 免責

ORPHE INSOLE を使う example は医療機器ではなく、疾病の診断・治療・予防を目的としていません。
