# Research Poster Studio

研究ポスター専用の**構造化レイアウトエディタ**．A0 / A1 などの学会ポスターを
YAML + Markdown で管理し，GUI で縮小プレビューしながら調整して PDF / PNG /
HTML / SVG / PPTX / Marp に書き出せるデスクトップアプリ．

PowerPoint のような自由配置 DTP ではなく，研究内容を「ブロック」「カラム」
「高さモード」「連動モード」で管理するため，研究数・図表数・文字量が変わっても
レイアウトが破綻しにくい．ポスターの中身は全てテキストファイルなので，
Claude Code / Codex などの Agent LLM がそのまま編集できる．

技術構成: **Tauri v2 + React + TypeScript + Vite**（Windows / macOS / Linux）．

## 主な機能

- 用紙: A0 / A1 / A2・インチ系プリセット（36x48in / 42x56in / 48x96in）・
  カスタムサイズ・縦横・表示単位 mm / inch 切替
- 実寸プレビュー（ホイールズーム 5–200%，プリセット 10–100%）
- 1〜6 カラム + 全幅（wide）ブロック，カラム幅比（1-3 カラムは
  `left`/`center`/`right`，4 カラム以上は `col1`..`colN`）
- 高さモード `auto` / `fixed` / `flex` / `locked`，高さ連動
  （`sync_row` / `*_follows`：行ペアリンググリッドで左右の行高さを揃える）
- 入れ子ブロック（ブロック内のバンドレイアウト）
- ブロック単位のフォントサイズ・文字色・見出し色・斜体・
  背景色・枠線（有無・色・太さ）・本文の自動フィット
- 見出し装飾: 塗りバー（`heading_background`）・**番号バッジ**（`heading_badge`）・
  **カード型**（`card`：枠＋影＋見出しバー端まで密着）・**左アクセントバー**
  （`accent_bar`）・バー幅指定（`heading_width_mode`）
- 本文中**コールアウト箱**（`::: note … :::`）・ネイティブ**チャート**
  （` ```chart ` の棒/折れ線）
- 行間・段落間隔（全体＋ブロック上書き），読書距離インデックス
  （目標距離から必要 pt を逆算）
- Markdown 本文（**太字** / *斜体* / `<u>下線</u>` / 役割色 span）．
  本文は**ブロック別 `content/*.md`** または**単一 `content.md`**（`# 見出し {#id}`
  セクション，Pandoc 風）のどちらでも管理可（新規プロジェクトは単一 content.md）
- リストの自動採番（書いた記号の体裁のまま連番化）: `(1)` / `1)` / `a.` / `i.` /
  `#.`（アウトライン 1.1.1）＋ ① / ア・あ / 漢数字（Pandoc fancy lists 準拠＋拡張）
- UI 表示言語の**日英切替**（ツールバー／起動ダイアログの言語ボタン．全画面対応．
  辞書は `packages/desktop-app/src/i18n/lang_jp.ts` / `lang_en.ts`）
- 図表: PNG / JPEG / SVG に加えて **PDF 貼り込み**（1 ページ目を PNG 化）・
  **CSV 簡易表**・**Mermaid**・**Graphviz**（ファイルまたは本文コードブロック）・
  **EMF/WMF**（デスクトップで PNG 変換）．倍率（100% 超のはみ出し可）・横/縦整列・
  **テキスト回り込み**（`float`）・キャプション色・枠線・**白背景の透過**，
  画像ギャラリー（等高横並び・複数行・**画像ごとのトリミング**）
- ヘッダー: 著者・所属・キーワード・機関ロゴ（ヘッダー/フッター×左/中央/右），
  文字色一括指定（`text_color`：濃色帯に白文字等）・著者所属の1行結合
  （`affiliation_inline`）
- キャンバスのダブルクリックで本文を直接編集・基本的なキーボードショートカット
  （F1 で一覧）
- **BibTeX 引用文献**（`references.bib` + 本文 `[@key]` 展開，apa7 / jpa /
  カスタムスタイル，引用文献リスト自動生成）
- 校正モード（1 カラム通読ビュー・表記ゆれチェック・全角半角一括変換）
- Undo / Redo（Ctrl+Z / Ctrl+Y），保存ごとの自動バックアップ（`backups/` 10 世代），
  最近開いたプロジェクト一覧
- 着せ替え（配色プリセット）・背景画像・フォーマットパッケージ
  （体裁の書き出し / 読み込み）
- 警告: 文字あふれ・本文/引用文献の小ささ・カラム高さ差・図表解像度・
  キャプション欠落・図表ID重複・図表番号の重複・存在しないカラム指定
- エクスポート: **PDF**（webview 印刷，@page で実寸）/ **PNG**（既定 150 dpi）/
  自己完結 **HTML** / **SVG** / **PPTX** / **Marp Markdown**
  （各形式の忠実度と用途は `docs/export-matrix.md`）
- Agent LLM 用 Skill 同梱（`skills/research-poster-studio/`）

## 必要環境

- Node.js 18+（開発時 22 で確認）
- Rust / Cargo（stable）
- OS ごとの Tauri 前提（Windows: WebView2，Linux: webkit2gtk，macOS: Xcode CLT）

## 起動方法

```powershell
npm install              # 初回のみ（npm-workspaces 一括）
npm run dev              # build:libs → tauri dev（共有ライブラリを建ててからGUI起動）
# ライブラリ（core/renderer/exporter）も同時に編集する場合は別ターミナルで:
npm run watch:libs       # tsup --watch
```

本リポジトリは **npm-workspaces のモノレポ**です．レイアウト計算・検証・
レンダリングは共有パッケージ（`@rps/core` / `@rps/renderer` / `@rps/exporter`）に
あり，デスクトップ・`rps` CLI・将来の VS Code 拡張が同じ実装を使います
（詳細は `docs/architecture.md`）．

アプリ起動直後は**起動時ダイアログ**が出る（新規作成 / ファイルを開く /
サンプルを開く / 最近開いたプロジェクト）．ツールバーの「新規作成」からは
**設定ウィザード**（保存先 → 基本情報 → 用紙とカラム → 構成 →
着せ替え の 5 ステップ）で新しいポスタープロジェクトを作成できる．構成は
単一研究 / 複数研究 ×（日本語 / English）から選べ，保存先が既存フォルダの
場合は確認のうえその中に作成する．
「サンプルを開く」で `examples/sample-poster/` を読み込める．「ファイルを開く」で
任意のポスタープロジェクト（`poster.yaml`）を開ける．「最近開いた...」から
再オープンもできる．

## CLI（`rps`）

```powershell
npm run rps -- validate <project-dir>             # スキーマ＋警告チェック
npm run rps -- info <project-dir>                 # サイズ/ブロック/図表/警告の要約
npm run rps -- explain <project-dir> [--json]     # Agent 向け構造要約（読み順/図表/警告）
npm run rps -- preview <project-dir> --watch      # ローカルプレビュー（自動リロード）
npm run rps -- export pdf <project-dir>           # exports/ に出力
npm run rps -- init <dir> --template quantitative # 雛形生成
```

PDF / PNG 出力は初回のみブラウザ取得が必要: `npx playwright install chromium`．
HTML / SVG / Marp は追加依存なしで出力できます（詳細は `docs/vscode-cli-integration.md`）．

## ビルド（配布物）

```powershell
npm run build:libs                        # 共有ライブラリを建てる
npm run tauri build -w @rps/desktop-app   # 各OSのインストーラ/実行ファイルを生成
```

## 検証

```powershell
npm run typecheck     # 全ワークスペースの型チェック
npm run smoke         # smoke test（カラムレイアウト + CLI validate/info/export）
```

- 自動 smoke test は `scripts/smoke-columns.mjs`（core のカラム計算）と
  `scripts/smoke-cli.mjs`（examples/ 3 サンプルへの CLI 実行と生成物検査）．
  事前に `npm run build:libs` が必要．
- GUI の目視確認は `docs/acceptance-tests.md`（手動受け入れテスト表）に従う．
- `examples/sample-full/` は全部入りの検証用サンプル（3 カラム / 入れ子 /
  SVG・PDF・CSV・Mermaid・Graphviz / ギャラリー / ロゴ / BibTeX）．

## 使い方の流れ

1. 「新規作成」（設定ウィザード）でプロジェクトを作るか，「サンプルを開く」
   または「ファイルを開く」で既存プロジェクトを読み込む．
2. 左ツリーまたはプレビュー上でブロックを選択．
3. 右ペインのタブ（本文 / レイアウト / 書式）で調整．本文は「本文」タブの
   Markdown エディタ，高さ・カラム・並べ替えは「レイアウト」タブ，フォント・色・
   背景（透明可）・枠線は「書式」タブ．
4. 下部パネルで警告を確認（行をクリックで該当ブロックへ）．
5. 「保存」で `poster.yaml` と `content/*.md` に書き戻す．
6. ツールバーの **PDF / PNG / HTML / SVG / PPTX / Marp** で出力．
   PNG 以降は保存ダイアログでファイル名・場所を選べる（既定は `exports/`）．
   PDF は印刷ダイアログで「PDF として保存 / Microsoft Print to PDF」を選ぶと
   実寸で出力される．提出用には PDF を推奨（`docs/export-matrix.md`）．

## プロジェクト構造（ポスター1件）

```text
poster-project/
├─ poster.yaml          # 構造・レイアウト・テーマ・ブロック・図表・出力設定
├─ content/*.md         # 各ブロックの本文（Markdown．ブロック別方式）
│   または content.md   # 単一ファイル方式（`# 見出し {#id}` セクション．新規既定）
├─ figures/*            # 図表（PNG / JPEG / SVG / PDF / CSV / Mermaid / Graphviz）
├─ references.bib       # BibTeX 引用文献（任意）
├─ exports/             # 生成物（手で編集しない・git 管理外）
├─ backups/             # 自動バックアップ（自動生成・git 管理外）
└─ agent/review.md      # Agent LLM 用レビューメモ
```

### 生成物とバックアップの扱い

- `exports/` は**生成物**．アプリ / CLI が出力する PDF・PNG・HTML・SVG・PPTX・
  Marp が入る．手で編集せず，git にもコミットしない（`.gitignore` 済み）．
- `backups/` は**自動バックアップ**．アプリで保存するたびに
  `backups/<タイムスタンプ>/` へ `poster.yaml`・`references.bib`・`content/`・
  `styles/` がコピーされ，10 世代を超えた古い分は自動削除される．
  こちらも git 管理外．
- **復元手順**: 壊れた場合は `backups/` 内の戻したい時点のフォルダを開き，
  `poster.yaml`（と必要なら `references.bib`・`content/`・`styles/`）を
  プロジェクト直下へ手動で上書きコピーしてからアプリで開き直す．

`poster.yaml` のスキーマは `skills/research-poster-studio/schema/poster.schema.json`，
仕様は `docs/design.md`（= 設計書）．

## リポジトリ構成（モノレポ）

```text
packages/
  core/        @rps/core      型 / Zod schema / validate / layout（DOM非依存・Node+ブラウザ）
                              + core/node（CLI 用 fs ローダ）
  renderer/    @rps/renderer  PosterCanvas / renderPosterToHtml / svg / marp / markdown
  exporter/    @rps/exporter  HTML→PDF/PNG（Playwright）
  cli/         @rps/cli       rps（init / validate / preview / export / info）
  desktop-app/ @rps/desktop-app  Tauri v2 + React GUI（src/ + src-tauri/）
  vscode-extension/  @rps/vscode-extension  VS Code 拡張（validate / preview / warnings）
examples/                      サンプル（sample-poster / sample-nested / sample-full=全部入り検証用 / sample-combined=単一 content.md）
skills/research-poster-studio/ Agent LLM 用 Skill（SKILL.md / schema / templates / prompts）
docs/                          design.md / architecture.md / vscode-cli-integration.md /
                               agent-workflow.md / export-matrix.md
```

## アーキテクチャ要点

- レイアウトは CSS の flexbox に委譲（`engine/layout.ts` がブロックをバンド =
  カラム帯／全幅帯に分割し，高さモードを flex プロパティへ変換）．
  あふれは描画後に DOM 計測して**警告**する（自動縮小はしない）．
- プレビューと各エクスポートは**同一の `PosterCanvas`** を共有
  （HTML/SVG は `renderToStaticMarkup`）．mm 実寸で描き，プレビューは CSS
  `transform: scale()` で縮小，印刷は `@page size` で実寸 PDF 化．
- 図表はロード時に data URI 化するため，HTML/SVG エクスポートは1ファイルで完結．

## 残課題 / 既知の制限

- PPTX は座標・テキスト・画像を再現する近似出力（Markdown 装飾や枠線は簡略）．
  形式ごとの忠実度は `docs/export-matrix.md` を参照．
- デスクトップの PDF はネイティブの自動保存ではなく印刷ダイアログ経由
  （保存先で PDF を選択）．ヘッドレス自動保存は見送り（印刷プレビュー経由が前提）．
- **CLI の `rps export` は Graphviz（.dot/.gv・```dot）を変換するようになった**
  （@viz-js/viz・Node）．**Mermaid と PDF 貼り込みは依存が重いためプレースホルダのまま**
  （デスクトップアプリを使う）．
- VS Code 拡張は最小実装済み（検証＝診断 / プレビュー webview / 警告表示．
  エクスポート・新規作成は CLI・デスクトップへ委譲．`packages/vscode-extension/`）．
- フォント `Noto Sans JP` は未インストール環境では代替フォントになる．

## ライセンス / 帰属

立命館大学 中田友貴（Yuki Inoue Nakata）の研究用途を想定した内製ツール．
