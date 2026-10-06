# おいしいうどんを作ろう！（UDON）

その場で足踏みして、うどんの生地をこねるゲームです。**ORPHE CORE / ORPHE INSOLE の両方に対応**しています。
タイトル横の2つのスロットで、それぞれ CORE / INSOLE を選んで接続します（左右1台ずつ、1台でも遊べます）。

旧 ORPHE-INSOLE.js の `udon` と旧 ORPHE-CORE.js の `GAME-UDON` を統合し、INSOLE 版をベースにしています。

## 踏み込みの判定

| 種別 | 足上げ | 踏み込み | 強度の配点 |
| --- | --- | --- | --- |
| INSOLE | 加速度・ジャイロ | 6ch圧力の増分（無負荷ベースライン比） | 足上げ時の \|accY\| ピーク・圧力増分・足上げ時間 |
| CORE（IMU-only モード） | \|gyro\| / \|\|acc\| − 1G\| | 着地の衝撃（連続サンプル間の加速度差分 \|Δx\|+\|Δy\|+\|Δz\| [G]） | 足上げ中の \|gyro\| ピーク・衝撃ピーク・足上げ時間 |

- CORE の衝撃しきい値の初期値 1.0G は、旧 CORE 版の `gotAcc`（正規化値）差分 `> 0.06` を ±16G レンジで換算したものです。
- 左右は CORE の `device_information.lr`、INSOLE の `mount_position`（どちらも bit0）で決めます。読めないときはスロット番号（01 = 左、02 = 右）を使います。
- しきい値はページ下部の「しきい値の調整」から変えられます（選んだ種別の項目だけ表示、localStorage に保存）。

## 接続

- INSOLE: `buildInsoleToolkit` の `profile: "realtime-pressure"`（3: gyro + acc + press / 200Hz）。
- CORE: `buildCoreToolkit` の `SENSOR_VALUES`（加速度・ジャイロ）。
- 種別は `assets/js/device-slot.js` で選びます。切り替えるとページを再読み込みします。`?slot0=core&slot1=insole` でも指定できます。

## そのほか

- センサ未接続のあいだはデモデータを自動再生します（CORE を選んだスロットは IMU の合成データ）。
- 「生データ記録」でフレーム CSV、`CSV` ボタンでイベント CSV を保存できます。DevTools からは `udonDebug` を使えます。
- 研究・開発用の example です。医療機器ではありません。

## 実機確認

- 未実機確認（CORE の IMU-only 判定のしきい値は実機ログでの調整が必要です）。
