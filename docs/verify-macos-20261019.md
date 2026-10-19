# macOS 動作確認（2026-10-19・Apple Silicon）

対象: 公開済みの v0.1.2（タグ 3e830f6）．
- CLI: リポジトリのタグ `v0.1.2` から実行した．
- デスクトップアプリ: Releases の `Research.Poster.Studio_0.1.2_universal.dmg`（12,381,877 バイト）．

前回の記録（Intel・macOS 12）は [verify-macos-20261003.md](verify-macos-20261003.md)．

## 環境

| 項目 | 値 |
|---|---|
| 機種 | Mac mini（Apple M2・8 GB） |
| OS | macOS 26.7.1（25G241）・arm64 |
| アカウント | djynakata（管理者．CLI の確認）／tester（何も入れていない標準ユーザー．GUI の確認） |
| 事前に入っていたもの | Xcode コマンドラインツールのみ（git 2.50.1，python3 3.9.6）．Homebrew・Node は無し |
| 実行方法 | 大学PC から SSH（Tailscale）．GUI は `screencapture` で撮影 |

## CLI（djynakata・SSH で実行）

確認のために入れたもの（どれも djynakata のホームの中だけ．sudo とシェルの設定ファイルの変更はしていない）:
- `~/rps-verify/node`: Node.js v22.23.3（公式の darwin-arm64 版．SHA-256 を照合）．npm 10.9.9
- `~/rps-verify/research_poster_studio`: タグ v0.1.2 の clone と `npm ci`・`npm run build:libs`
- `~/Library/Caches/ms-playwright`: `npx playwright install chromium` で入った Chromium 148 と headless shell（534 MB）
- 作業の記録: `~/rps-verify/log/setup.log`，`cli.log`

| 手順 | 結果 |
|---|---|
| アーキテクチャ | OK．`uname -m` は arm64．`node` は Mach-O arm64．`process.arch` は arm64（Rosetta を使っていない） |
| `npm ci` → `npm run build:libs` | OK |
| `npm test`（vitest） | OK（16/16） |
| `npm run smoke` | smoke-columns は OK（27）．smoke-cli は 40/41．落ちた 1 件は「validate catEn exits 0」で，下の英語デモのはみ出しによるもの（Noto Sans JP が無い環境で必ず起きる．Intel の macOS 12 と同じ） |
| `rps validate`（日本語デモ） | OK（エラー 0．警告 1 件＝Noto Sans JP が無い） |
| `rps validate`（英語デモ） | エラー 1 件と警告 1 件．英語デモは用紙から 53 mm はみ出す（内容 1242 mm／用紙 1189 mm）．Noto Sans JP が無いため英語本文が Helvetica で組まれ，幅が広がる．前回の Intel の macOS 12 と同じ値．Windows（Noto Sans JP あり）では 0 件 |
| `rps export pdf`（日英） | OK．どちらも 1 ページ・841.0 × 1188.9 mm（A0） |
| PDF のフォント | OK．すべて PDF の中に埋め込まれている（pypdf でページとフォームの資源を走査）．英語: Helvetica（Type0・部分埋め込み）と Type3 のフォント，計 17．日本語: Times-Roman（Type0・部分埋め込み）と Type3，計 116．Type3 は字形を PDF の中に図形として持つ方式で，Windows で書き出した PDF も同じ方式．外部のフォントは要らない |
| `rps export png`（日英） | OK（3179 × 4494）．日本語デモは見出し・本文・図とも正しく描かれ，はみ出しも無い |

## デスクトップアプリ（djynakata）

ユーザーの判断で，tester ではなく，GUI にログインしている管理者アカウント djynakata で確認した．
dmg にはブラウザでダウンロードしたときと同じ quarantine 属性を付けた．操作は SSH から `osascript`（System Events），確認は `screencapture`．

| # | 確認内容 | 結果 |
|---|---|---|
| G1 | dmg を開いてアプリをアプリケーションへコピー | OK（dmg は 12,381,877 バイトで一致） |
| G2 | 初回起動と Gatekeeper | 「"Research Poster Studio"は開いていません．Apple は…マルウェアが含まれていないことを検証できませんでした」．ボタンは「ゴミ箱に入れる」「完了」だけで，「開く」は無い（macOS 12 と違い，右クリックの「開く」でも回避できない）．「完了」→ システム設定「プライバシーとセキュリティ」の「セキュリティ」欄の「このまま開く」→ 管理者の認証，の順で起動できた（この段はユーザーが Mac mini の前で操作） |
| G3 | arm64 で動いているか | OK．実行ファイルは universal（x86_64 と arm64）．起動中のプロセスは翻訳なし（sysctl の P_TRANSLATED が立っていない）．Rosetta を使っていない．AppTranslocation 経由で起動 |
| G4 | 起動して白画面にならないか | OK（開始ダイアログ・日本語表示） |
| G5 | 「Open sample (English)」 | OK．警告 2 件（用紙からのはみ出し＝占有 104%，Noto Sans JP が無い）．Intel の macOS 12 と同じ種類．「書類」フォルダへのアクセスの確認は出なかった |
| G6 | 「サンプル（日本語）」 | OK．占有 100%．警告はフォントの 1 件のみ |
| G7 | PNG | OK（4967 × 7022．Graphviz の流れ図も描画．英語デモは下端の文献が切れる＝既知のはみ出し） |
| G8 | HTML / SVG | OK（HTML の @page は 841mm × 1189mm．SVG は foreignObject 入り） |
| G9 | PPTX | OK（スライド 1 枚・図形 34・画像 4・表 1） |
| G10 | Markdown | OK（152 行．節の順は 1→2→3→4→5） |
| G11 | PDF（印刷） | **NG（手順が使えない）**．印刷ダイアログは開くが，プリンターが 1 台も無い Mac では「Printer: No Printer Selected」となり，用紙サイズの欄が出ない（プリンターの一覧は「プリンタを追加…」「プリンタとスキャナ設定…」だけ）．既定の用紙（A4）に 3 ページで分かれ，README の「用紙を A0 にする」手順は実行できない．印刷を開くと「ローカルネットワーク上のデバイスを見つけることを許可しますか?」の確認も出た（「許可しない」で続行できる） |

補足:
- macOS 26 の印刷ダイアログは，macOS 12 の「詳細を表示」型とは見た目が違う（Printer / Presets / Copies / Pages / Layout / Paper Handling と，左下の「PDF」）．
- 確認の途中で，SSH 経由の操作（sshd-keygen-wrapper）に Finder の自動操作を許可した（ユーザーの操作）．不要になればシステム設定の「オートメーション」で外せる．

## 未確認

- macOS 13〜25（今回は 12 と 26 のみ）．
- プリンターがある Mac での macOS 26 の印刷（用紙サイズを選べるか）．
- tester（標準ユーザー）での確認．
