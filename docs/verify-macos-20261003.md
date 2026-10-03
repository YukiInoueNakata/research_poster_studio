# macOS 動作確認（2026-10-03）

対象: main（b743150 → 22df216．確認中に見つかった不具合を修正しながら）／v0.1.2 候補．手順は README の記載どおり（clone → `npm ci` → `npm run build:libs` …）．

## 環境

| 項目 | 値 |
|---|---|
| 機種 | MacBook Pro 13 インチ 2015（Intel Core i5-5287U・16 GB） |
| OS | macOS 12.6.3 Monterey（21G419）・x86_64 |
| Node.js / npm | v24.21.0 / 11.19.0 |
| Rust | 1.99.0（rustup）・Xcode 導入済み |
| 実行方法 | 大学PC から SSH（`ssh mac 'bash -lc "…"'`）．GUI は Mac の前で目視 |

確認範囲は **Intel・macOS 12** まで．Apple Silicon と macOS 13 以降は未確認．

## CLI（SSH で実行）

| 手順 | 結果 |
|---|---|
| `npm ci` → `npm run build:libs` → `npm run typecheck` | OK |
| `npm test`（vitest） | OK（13/13） |
| `npm run smoke` | OK（27 + 41） |
| `npx playwright install chromium` | OK（chromium 361 MB・headless shell 206 MB・ffmpeg 3 MB） |
| `rps export pdf` / `png`（日英デモ） | OK．PDF は A0 実寸（841 × 1189 mm） |
| `rps validate`（日英デモ・`rps init` 雛形 3 種） | 日本語デモ・雛形 3 種は 0 件．**英語デモは用紙から 53 mm はみ出す**（下記） |

### OS 固有の詰まり

- **フォントの置き換え**: デモが指定する「Noto Sans JP」は macOS に標準で無く，Chromium は英語本文を Helvetica で組む．
  文字幅が広く，英語デモの文献リストが下端からはみ出した（内容 1242 mm／用紙 1189 mm）．Windows（Noto Sans JP あり）では 0 件．
  → `rps validate` とデスクトップのプレビューに「指定フォントがこの環境にない」警告を追加（b743150）．
  デモ自体の対処（フォント指定の見直し・余白の確保）は未定．
- Homebrew は Intel Mac に入らない（インストーラが拒否）．本ソフトの確認には不要だった（Node・Rust は公式配布物をユーザー領域に導入済み）．
- 非対話の SSH では `~/.bash_profile` が読まれないので，`bash -lc` で包む必要がある．

## デスクトップアプリ（SSH から操作・撮影して確認）

`npm run tauri build -w @rps/desktop-app -- --bundles app` で .app をビルドし，SSH から `open` で起動．
操作は `osascript`（System Events のクリック・キー入力），確認は `screencapture`．
事前に「画面収録」「アクセシビリティ」「オートメーション（System Events）」へ `/usr/libexec/sshd-keygen-wrapper` の許可が必要（ユーザーが一度だけ設定）．

| # | 確認内容 | 結果 |
|---|---|---|
| 1 | 起動する．新しいアイコン | NG→OK．**真っ黒**だった（Safari 15 が正規表現の後読みを読めず起動時に例外）→ 45ca157 で修正 |
| 2 | ボタン・選択欄が暗い配色 | OK |
| 3 | 「サンプルを開く」日英 | OK（英語で確認） |
| 4 | Zoom 5%〜81% で誤検知なし | OK（警告は常に 2 件＝はみ出し・フォント．いずれも正しい） |
| 5 | 本文欄で Cmd+Z | OK |
| 6 | PNG 出力 | OK（4967×7022）．ただし **Graphviz 図が未変換**だった（CSP の wasm-unsafe-eval を Safari 15 が知らない）→ 4fe2f45 で修正し再確認 OK |
| 7 | PDF（印刷） | NG→OK．**何も起きなかった**（WKWebView は iframe 内の print を無視）→ 22df216 でネイティブ印刷に変更．ダイアログは出るが，用紙は既定（A4 で 3 分割）＝ README に用紙設定の手順を記載 |
| 8 | PPTX 出力 | OK（Windows の PowerPoint で描画して崩れなし） |
| 9 | Markdown 出力（旧称 Marp） | OK（本文入り 5,439 バイト） |
| 10 | 名前を付けて保存（別フォルダ） | OK（一式コピー） |
| 11 | 見出し・タイトルのフォント | NG→OK．Noto Sans JP が無いと **Times（明朝）**になった → 60bdbf9 で代替フォントを付与 |

## 未確認

- 配布用の universal `.dmg`（CI でビルド）の Gatekeeper 挙動（未署名）．`xattr` の手順は README に記載．
- Apple Silicon・macOS 13 以降．

## 再確認: macOS 12.7.6・Safari 17.6・v0.1.2-rc.1 の配布物（2026-10-03 20:30〜20:50）

OS を 12.7.6（Safari 17.6）へ更新し，CI がビルドした universal `.dmg`（v0.1.2-rc.1・下書き）を実際の手順で入れて確認した．
dmg にはブラウザでダウンロードしたときと同じ quarantine 属性を付けた．

| # | 確認内容 | 結果 |
|---|---|---|
| G1 | dmg を開き，アプリを Applications へドラッグ | OK |
| G2 | ダブルクリックで「開発元を検証できないため開けません」→ キャンセル → 右クリック「開く」→「開く」 | OK（README の手順どおり起動．AppTranslocation 経由で動作） |
| G3 | 「サンプルを開く」で macOS が「"書類"フォルダ内のファイルにアクセス」の許可を求める | 出る．「OK」で続行できた．ガイドに画像つきで追記 |
| 1 | 起動・アイコン | OK |
| 2 | ボタン・選択欄が暗い配色 | OK |
| 3 | 「Open sample (English)」 | OK |
| 4 | Zoom 13%〜31%（Cmd+= / Cmd+-）で警告数が変わらない | OK（常に 2 件＝はみ出し 102%・フォント．いずれも正しい） |
| 5 | 本文欄で Cmd+Z | OK（打った文字が消え，元の文に戻る） |
| 6 | PNG 出力 | OK（4967×7022．Graphviz の流れ図も描画） |
| 7 | PDF（印刷） | OK．ネイティブの印刷ダイアログが出る．用紙は既定（3 ページに分割）＝前回どおり README の手順で用紙を設定．印刷は実行せずキャンセル（印刷待ちは空を確認） |
| 8 | PPTX 出力 | OK（スライド 1 枚・図形 34・画像 4・表 1） |
| 9 | Markdown 出力 | OK（152 行・本文入り）．節の順は 1→2→4→3→5（カラムの順に書き出すため）．Mac 固有ではない |
| 10 | 名前を付けて保存（別フォルダ） | OK（yaml・本文・図・文献・scripts の一式） |
| 11 | 見出し・タイトルのフォント | OK（代替のゴシック） |

補足:
- 保存ダイアログで，自動入力により拡張子まで打ち直すと `poster.pptx.pptx` のように二重になった．既定の名前のまま保存すると正しい（`poster.pptx`）．アプリはパスに拡張子を足していないので，macOS の保存パネル側の挙動．
- SSH から Finder 経由で dmg を開くと「その操作は許可されていません」になる（`open` コマンドでは開ける）．自動操作の権限の問題で，ユーザーの操作では起きない．

確認範囲は引き続き Intel・macOS 12．Apple Silicon と macOS 13 以降は未確認．
