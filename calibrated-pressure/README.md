# Calibrated Pressure [N]

ORPHE INSOLE の 6ch 圧力を、**デバイスに保存された校正値で荷重[N]に換算**して表示する最小サンプルです。
1〜2台を接続でき、各インソールについて次の2つを表示します。

- 6ch の荷重[N]の折れ線グラフ（直近100サンプル）
- 接続時に取得した 6ch 分の校正係数（換算式の種類と係数 a〜e）

校正値を取得できないデバイスでは、SDK 内蔵の既定係数で換算します。

> 医療機器ではなく、診断・治療・予防を目的としません。

## サンプルの使い方

### 必要なもの

- Web Bluetooth に対応したブラウザ（Chrome / Edge。Safari・Firefox は非対応）
- ORPHE INSOLE 1〜2台（実機が必要です。シミュレータには対応していません）

### 起動

公開版: https://orphe-oss.github.io/ORPHE-INSOLE.js/examples/calibrated-pressure/

ローカルで動かす場合は、**リポジトリ直下**から配信してください
（`index.html` が `../vendor/` の SDK を相対パスで読み込むため）。

```bash
cd ORPHE-CORE-INSOLE.js-EXAMPLE
python3 -m http.server 8080
# → http://127.0.0.1:8080/calibrated-pressure/ を開く
```

### 操作

1. `INSOLE 01`（または `INSOLE 02`）の Toolkit のトグルを ON にして、デバイスを選択します。
2. 接続すると校正値が自動で読み出され、グラフ下の表に 6ch 分の係数が表示されます。
3. インソールに荷重をかけると、グラフに荷重[N]が流れます。

グラフタイトルと表の上の状態表示で、どの係数で換算しているかが分かります。

| 状態表示 | 意味 |
|---|---|
| 未接続・校正値未取得 | 接続していない |
| 接続中・校正値未取得 | 接続処理中（自動再接続中を含む） |
| 校正値未取得・荷重は既定係数で換算 | 接続済みだが、校正値を取得できなかった（非対応FW・タイムアウトなど） |
| デバイスから取得した6chの校正値 | 校正値で換算している |

切断すると係数表は消え、再接続すると校正値を取得し直して表示します。

## コードの説明

ファイル構成は `index.html`（レイアウト）と `sketch.js`（処理）の2つです。

### index.html

Chart.js・Bootstrap と、SDK の `orphe-core-insole.js`・`orphe-core-insole-toolkit.js` を読み込みます。
デバイスごとに Toolkit の置き場所（`toolkit0/1`）、グラフ（`chart0/1`）、
校正値の状態表示（`calibration-status0/1`）、係数表（`calibration-body0/1`）を用意しています。

### sketch.js

**1. 接続 UI と受信コールバック**

```javascript
buildInsoleToolkit(document.getElementById(`toolkit${id}`), `INSOLE 0${id + 1}`, id, {
  streamingMode: 4,      // 圧力を含むモード（3 または 4）
  autoReconnect: true,
});
const insole = insoles[id];   // toolkit が用意した OrpheCoreInsole

insole.on('converted_press', (press) => {
  pending[id].push(press.values);   // 荷重[N]を溜めるだけ
});
```

- グローバルの `insoles[0]` / `insoles[1]` は toolkit が用意した `OrpheCoreInsole` です。自分で作り直さずにそのまま使います。
- `on('converted_press', …)` は 100Hz で呼ばれるため、ここでは描画せず `pending` に溜めます。
- `on()` は解除関数を返します。ここでは 1 回だけ登録し、ページを閉じるまで購読し続けます。

**2. 描画ループ**

`render()` を `requestAnimationFrame` で回し、溜まったサンプルをまとめてグラフに追加してから
`chart.update()` を1回だけ呼びます。`HISTORY`（100）を超えた古いサンプルは削除します。

**3. 校正値の表示（`renderCalibration(id)`）**

```javascript
const connected = insole.isConnected();
const calibration = connected ? pressureCalibrationOf(insole) : null;   // insole.profile.pressure_calibrations を表示用に整形
const key = JSON.stringify([connected, insole.connectionState, calibration]);
if (calibrationKeys[id] === key) return false;   // 変化がなければ何もしない
```

- 接続状態と `insole.profile.pressure_calibrations` を毎フレーム確認し、**変化したときだけ**状態表示・表・グラフタイトルを更新します。
  圧力の通知が無いとき（取得完了直後・切断時）も表示を反映できます。
- 表の1行が1センサーです。`func === 0`（指数関数）では d・e を使わないため「（未使用）」と表示します。
- 係数は桁の幅が大きいので `toExponential()` で表示します。

## 校正値の取得方法

### 自動取得（通常はこれだけ）

`await insole.begin()` は、対応 FW であれば 6ch 分の校正値を自動で読み出し、
`insole.profile.pressure_calibrations` に保存します。Toolkit 経由の接続でも同じです。

```javascript
const { OrpheCoreInsole, insoleProfile } = OrpheCoreInsoleJS;
const insole = new OrpheCoreInsole({ profile: insoleProfile(), id: 0 });
await insole.begin('SENSOR_VALUES', { streamingMode: 4 });
console.log(insole.profile.pressure_calibrations);
// [
//   { func: 1, coefficients: [a, b, c, d, e] },   // index = センサー番号 0〜5
//   null,                                         // 取得できなかった ch は null
//   ...
// ]
```

| 項目 | 内容 |
|---|---|
| 配列の index | センサー番号 0〜5（`press.values[i]` に対応。公式番号は `i + 1`） |
| `func` | 換算式の種類。`0` = 指数関数、`1` = 4次多項式 |
| `coefficients` | 係数 `[a, b, c, d, e]`（float64） |

換算式（`ADC` は圧力の生値、結果の単位は N）:

- `func = 0`: `N = a × exp(b × ADC) + c`（d・e は未使用）
- `func = 1`: `N = a × ADC⁴ + b × ADC³ + c × ADC² + d × ADC + e`

非対応FWでは配列全体が `null` になります。応答が無い ch・係数が書き込まれていない ch はその要素だけ `null` になり、
その ch は既定係数で換算します。いずれもエラーにはならず（`onError` も呼ばれません）、接続は続きます。
1ch あたりの待ち時間・試行回数は `insoleProfile({ pressureCalibration: { timeoutMs, retries } })` で変えられます。

### 再取得する

校正値は `begin()`（自動再接続を含む）のたびに取得し直します。手動で取り直したいときは接続し直してください。

### 校正値が破棄・再取得されるタイミング

校正値は各インスタンスの `profile` のメモリ内にだけ保持します。`begin()` の開始時に `null` に戻り、
自動再接続を含む再接続時に取得し直します。このサンプルは `isConnected()` が false の間は校正値を表示しません。

### 通信の流れ（参考）

各センサーについて、DEVICE_INFORMATION characteristic に `0x10 0x00 <センサー番号>` を書き込み、
SENSOR_VALUES の通知でヘッダ `0x39` の応答（センサー番号・func・float64 ×5、ビッグエンディアン）を受け取ります。
これを 0〜5 の順に6回繰り返します。仕様は
[insole_client](https://github.com/no-new-folk/insole_client/tree/e342620f9830c4d91ad5542b21212662b192ad58) に合わせています。
TypeScript の型は `PressureCalibration`（`func` / `coefficients`）です。

## 校正済みの値の取得方法

荷重[N]は `on('converted_press', …)`、ADC 生値は `on('press', …)` で受け取ります。

```javascript
insole.on('press', (press) => {
  console.log('ADC生値:', press.values);
});
let latestNewtons = null;
insole.on('converted_press', (press) => {
  // press.values: 6ch の荷重[N]（values[0] = センサー1 … values[5] = センサー6）
  // press.timestamp / serial_number / packet_number は同じサンプルの生値と同じ
  latestNewtons = press.values;   // 任意のタイミングで最新値を使うなら自分で保存する
  console.log('荷重[N]:', press.values);
});
await insole.begin('SENSOR_VALUES', { streamingMode: 4 });
```

換算のルール:

- 校正値があればその式と係数で換算します。
- 校正値の取得中・`null`・換算結果が有限値にならない場合は、センサー別の既定係数（insole_client と同じ値）で換算します。
  そのため、接続直後の数百msは既定係数の値になり、6ch の取得が終わると校正値の換算に切り替わります。
- 負の結果は 0 にします。

注意点:

- 圧力を含む Realtime モード（`streamingMode` 3 / 4）でのみ呼ばれます。mode 1 は圧力を含みません。
- FIFO 収録（`FifoRecorder`）のサンプルは ADC 生値のままです。FIFO の CSV は従来の固定係数で N に換算します。

## 関連

- ルートの [README](../../README.md)「圧力校正値の自動取得と荷重への換算」
- 実装: SDK の `src/profiles/insole.ts`（校正値の取得）と `src/protocol/pressure-calibration.ts`（換算式）
