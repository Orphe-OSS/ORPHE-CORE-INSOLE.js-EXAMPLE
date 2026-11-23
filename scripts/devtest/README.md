# devtest — 実機テストの補助（ローカル専用）

`python3 -m http.server` の代わりに使うローカルサーバーです。配信するときだけ、各ページに小さなパネルを差し込みます（ページのファイルは書き換えません）。
`scripts/` は GitHub Pages には公開されません。

```bash
python3 scripts/devtest/serve.py                                   # http://localhost:8080/
python3 scripts/devtest/serve.py --results-dir ~/Desktop/devtest   # 結果の保存先を変える
```

標準ライブラリだけで動きます（Python 3.9 以降）。

## パネルが自動で記録するもの

SDK の `OrpheCoreInsole.prototype.begin` を包み、ページ・toolkit・独自の接続 UI が作ったすべてのデバイスについて記録します。

- デバイス名・種別・FW（`firmware.releaseDate`）・INSOLE の streamingMode
- 接続状態・受信レート（直近 2 秒）・`lost_data`・切断と再接続（切断のあとにデータが戻れば再接続と数える）
- ページのエラー（`error` / `unhandledrejection` / `console.error`）
- ゲームの内部値（`startDebug` / `relayDebug` / `__adventure` / `hurdleDebug` / `pingpongDebug` / `UdonGame` があれば）

## 使い方

1. ページを開き、いつもどおり接続して遊ぶ
2. パネルの「手で確かめる」に OK / NG を押す（ページごとに保存され、再読み込みしても残る）
3. 「保存」を押すと、結果フォルダに JSON が 1 つ書かれる（git のブランチ・コミットも入る）
4. 「一覧」（`/__devtest/report.html`）で全ページの結果を見る。README の「動作確認済み FW」に足す行と、PR に貼る表ができる

チェックリストは `overlay.js` の `PAGES` にあります。新しい example を足したら、ここにも項目を足してください。
