# VISUALIZE — ORPHE CORE / INSOLE

2台までの ORPHE CORE / ORPHE INSOLE のセンサ値を Chart.js でリアルタイム表示するサンプルです。
スロット 01 / 02 それぞれで CORE と INSOLE を選べます（混在も可）。

| 種別 | 表示するチャート | 接続 UI |
|---|---|---|
| ORPHE INSOLE | 圧力(6ch) / 加速度 / ジャイロ / クォータニオン / オイラー角 | InsoleToolkit（streaming mode 4 = 100Hz 全データ、自動再接続） |
| ORPHE CORE | 加速度 / ジャイロ / クォータニオン / オイラー角 | CoreToolkit（`SENSOR_VALUES`、自動再接続） |

## 使い方

1. Chrome / Edge でこのディレクトリの `index.html` を開く（要 HTTPS または localhost）
2. 各スロットのセレクトで `ORPHE CORE` / `ORPHE INSOLE` を選ぶ（切り替えるとページが再読み込みされる。初期値は INSOLE）
3. トグルスイッチを ON にしてデバイスを選択する
   - INSOLE のストリーミングモードは歯車アイコンから変更可能

種別は localStorage に保存されます。URL クエリ `?slot0=core&slot1=insole` でも指定できます。

## 補足

- 装着位置（INSOLE は `mount_position`、CORE は `lr`）が分かると、左足のデバイスを左列、右足を右列に並べ替えます。
- 100Hz × 複数チャートで `chart.update()` を毎回呼ぶとタブが固まるため、受信データはバッファに溜めて
  requestAnimationFrame で約30fpsにまとめて描画しています。
- y 軸レンジは種別ごとに切り替えています（CORE: acc/gyro/quat ±2・euler ±π、INSOLE: acc/gyro ±1・quat ±1.2・euler ±3.2）。
