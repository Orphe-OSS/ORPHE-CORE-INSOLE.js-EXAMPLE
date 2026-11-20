# FIFO vs Realtime

Measure push (Realtime) vs pull (FIFO) delivery side by side: loss rate, serial continuity map, and droppedCount.

## 作成情報

| 項目 | 内容 |
|---|---|
| 作成者 | Yuya Kikukawa（kikyu） |
| 対応 FW | 未記入 |
| 前提にしている仕様 | 未記入 |

### 動作確認済み FW

| FW | デバイス | 確認者 | 確認日 |
|---|---|---|---|
| （未確認） | | | |

## Run

リポジトリルートでローカルサーバを起動し、Chrome で開きます。

```bash
python3 -m http.server 8080
# → http://localhost:8080/fifo-vs-realtime/
```
