# HUB — 接続ハブ（ORPHE CORE をつないだまま example を切り替える）

ORPHE CORE 2 台をこのページでつなぎ、ゲームをこのページの中（iframe）で開きます。
ゲームを切り替えても、一覧（メニュー）に戻っても、CORE の接続は切れません。展示や体験会で、ゲームごとにつなぎ直す手間をなくすためのページです。

## 作成情報

| 項目 | 内容 |
|---|---|
| 作成者 | Claude |
| 対応 FW | 未記入 |
| 前提にしている仕様 | ORPHE CORE 2 台 / STEP_ANALYSIS_AND_SENSOR_VALUES / SDK v0.3.0 のタブ間共有（BleSharedBridge） |

### 動作確認済み FW

| FW | デバイス | 確認者 | 確認日 |
|---|---|---|---|
| （未確認） | | | |

## しくみ

- このページが ORPHE CORE の接続を持ちます（toolkit の既定で、タブ間共有の Primary になります）。
- ゲームの中の `assets/js/home-button.js` が、同じスロットに Primary があれば CORE の接続スイッチを自動で入れます。
  ゲームは `begin()` で Primary を見つけ、BLE に触らずに Secondary としてデータを受け取ります（デバイスの選択画面は出ません）。
- ゲームの左上の「◀ メニュー」で、このページのメニューに戻ります。ゲームは `about:blank` にして止めます。
- 接続は `STEP_ANALYSIS_AND_SENSOR_VALUES` で行います。SENSOR_VALUES だけを使うゲームにも、STEP_ANALYSIS を使うゲームにも配れます。

## 注意

- ORPHE INSOLE はタブ間共有に対応していないので、ゲームの中で INSOLE をつなぎます（ゲームを替えるとつなぎ直し）。
- このページを閉じる・再読み込みする・一覧へ移ると、CORE の接続は切れます（つないでいる間は確認が出ます）。
- 同じスロットに別の種類のデバイスをつなぐゲーム（スロット 0 に INSOLE など）では、ハブの CORE とぶつからないよう、ハブ側の CORE を切ってから使ってください。
- 別のタブで同じ example を開いても、同じように CORE を共有します（タブ間共有）。
