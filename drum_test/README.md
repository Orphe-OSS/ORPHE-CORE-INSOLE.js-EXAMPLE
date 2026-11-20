# Drum Game

> **Status**: `public` — see [`docs/examples-catalog.md`](../../docs/examples-catalog.md) for the full audit.

Sound interaction driven by body motion.

## 作成情報

| 項目 | 内容 |
|---|---|
| 作成者 | Yuya Kikukawa（kiku） |
| 対応 FW | 未記入 |
| 前提にしている仕様 | 未記入 |

### 動作確認済み FW

| FW | デバイス | 確認者 | 確認日 |
|---|---|---|---|
| （未確認） | | | |

## このexampleで学べること

- Sound interaction driven by body motion.

## 使うデータ

- 加速度 (`on('acc')`)
- オイラー角 (`on('euler')`)

## 必要なORPHE CORE数

- 2 台

## 想定読者

- クリエイティブコーダー・ゲームプレイヤー

## 実機確認

- **未実機確認** — 静的検証 (パス・参照) のみ。BLE 接続後の挙動はオーナーレビュー待ち。

## 既知の課題

- Directory name reads like a test rather than a public app

## 関連example

- [`examples/GAME-UDON/`](../GAME-UDON/README.md) — Udon Kneading Game
- [`examples/MOVEYOURFEET/`](../MOVEYOURFEET/README.md) — Move Your Feet
- [`examples/GAME-DDR/`](../GAME-DDR/README.md) — ORPHE STEP BEAT

## 元データ

このREADMEは `examples/catalog.json` の `drum-test` エントリから自動生成された最小スケルトンです。手動で詳細・スクリーンショット・遊び方を加筆してください。
