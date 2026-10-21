# TERMINAL

ORPHE CORE / ORPHE INSOLE の BLE 通信を hex のまま確認するためのターミナルです。旧 ORPHE-INSOLE.js の `terminal` と ORPHE-CORE.js の `INFORMATION` を統合しています。

## 使い方

1. 上部のセレクトで `ORPHE CORE` / `ORPHE INSOLE` を選びます（変更するとページを再読込します。既定は INSOLE）。
   URL クエリ `?slot0=core` / `?slot0=insole` でも指定できます。
2. 接続オプションを選んで `Connect Device` を押します。
   - CORE: notification（`STEP_ANALYSIS` / `SENSOR_VALUES` / `STEP_ANALYSIS_AND_SENSOR_VALUES`）
   - INSOLE: streamingMode（1 / 3 / 4、既定 4）
3. 各カードの機能
   - **Device Information**: `Read` で `commands.readDeviceInformation()` を呼び、デコード済みテーブル（CORE と INSOLE で項目が異なる）と生 hex を表示します。`Send` は入力した hex（例 `01,02,03`）を `transport.write()` で書き込みます。
   - **Date Time**: `Read` で `readDateTime()` の生 hex・デコード日時・往復時間を表示します。`Send` で hex を書き込みます。
   - **Update Sensor Values**: `onRaw()` で受けた notify の生データを hex で表示します。CORE の `STEP_ANALYSIS_AND_SENSOR_VALUES` では先頭列に UUID 名が入ります。
   - **Lost Data**: `on('lost_data')` で通し番号の欠落を表示します。
   - 各ログは `Download CSV` で保存できます。

## 動作環境

- Web Bluetooth に対応した Chrome（macOS / Windows / Linux / Android）
- ライブラリ: [ORPHE-CORE-INSOLE.js](https://github.com/Orphe-OSS/ORPHE-CORE-INSOLE.js) v0.2.0（`orphe-core-insole.js` の `OrpheCoreInsole`）
