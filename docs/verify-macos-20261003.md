# macOS 動作確認（2026-10-03）

対象: main（b743150 時点）／v0.1.2 候補．手順は README の記載どおり（clone → `npm ci` → `npm run build:libs` …）．

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

## デスクトップアプリ（Mac の前で目視）

`npm run tauri build -w @rps/desktop-app -- --bundles app` で .app をビルドし，SSH から `open` で起動する．

| # | 確認内容 | 結果 |
|---|---|---|
| 1 | 起動する（白画面にならない）．アイコンが新しいもの | |
| 2 | 開始ダイアログ・ツールバーのボタンと選択欄が暗い配色（白くない） | |
| 3 | 「サンプルを開く（日本語）」「Open sample (English)」が開く | |
| 4 | Zoom を 10%〜200% に変えても，あふれの誤検知が出ない（英語デモはフォント警告とはみ出しが出るのが正しい） | |
| 5 | 本文欄に入力 → そのまま Cmd+Z で戻る，Cmd+Shift+Z でやり直す | |
| 6 | PNG 出力でファイルができる | |
| 7 | PDF（印刷ダイアログ）が開き，用紙 A0・余白なし・100% で PDF に保存できる | |
| 8 | PPTX 出力が Keynote / PowerPoint で崩れずに開く | |
| 9 | Marp 出力に本文が入っている | |
| 10 | 「名前を付けて保存」で別フォルダに一式ができる | |
| 11 | 全体設定ダイアログの部品が暗い配色 | |

## 未確認

- 配布用の universal `.dmg`（CI でビルド）の Gatekeeper 挙動（未署名）．`xattr` の手順は README に記載．
- Apple Silicon・macOS 13 以降．
