# Research Poster Studio

研究ポスター専用の**構造化レイアウトエディタ**です。A0 / A1 などの学会ポスターを
YAML + Markdown で管理し、GUI でプレビューしながら **PDF / PNG / HTML / SVG /
PPTX / Marp** に書き出せます。

*A structured layout editor for academic research posters. Manage A0/A1 posters as
YAML + Markdown, preview them in a desktop GUI, and export to PDF / PNG / HTML /
SVG / PPTX / Marp.*

ポスターの中身はすべてプレーンテキスト（YAML + Markdown）なので、Claude Code /
Codex などの **Agent LLM がそのまま読んで編集できます**。AI エージェントによる
支援を前提に設計しています。

*Because every poster is plain text, AI coding agents (Claude Code, Codex, …) can
read and edit it directly. The tool is designed with LLM-agent assistance in mind.*

PowerPoint のような自由配置ではなく、内容を「ブロック / カラム / 高さモード」で
構造的に管理するため、研究数・図表数・文字量が変わってもレイアウトが破綻しにくい
設計です。

*Layout is structured by blocks, columns, and height modes rather than free-form
DTP, so it stays robust as the amount of content changes.*

技術構成 / Stack: **Tauri v2 + React + TypeScript + Vite**（Windows / macOS / Linux）。

## 主な機能 / Features

- **用紙・レイアウト** — A0/A1/A2・インチ系プリセット・カスタムサイズ、1〜6 カラム＋
  全幅ブロック、高さモード（auto/fixed/flex/locked）と高さ連動、入れ子ブロック。
  *Paper & layout: A0–A2, inch presets, custom sizes; 1–6 columns + full-width;
  height modes with row-sync; nested blocks.*
- **本文・装飾** — Markdown 本文（ブロック別 `content/*.md` または単一 `content.md`）、
  見出しバー・番号バッジ・カード型・コールアウト箱・チャート、リストの自動採番。
  *Content: Markdown body (per-block or single file), heading bars/badges/cards/
  callouts/charts, auto-numbered lists.*
- **図表** — PNG/JPEG/SVG に加え PDF・CSV 表・Mermaid・Graphviz・EMF/WMF、
  回り込み・整列・トリミング・ギャラリー・白背景の透過。
  *Figures: images plus PDF, CSV tables, Mermaid, Graphviz, EMF/WMF, with float,
  alignment, cropping, galleries, and white-background knockout.*
- **引用文献** — BibTeX（本文 `[@key]` 展開、apa7 / jpa / カスタム、文献リスト自動生成）。
  *Citations: BibTeX with `[@key]` expansion and an auto-generated reference list.*
- **仕上げ・運用** — 実寸プレビュー、あふれ等の各種警告、校正モード、Undo/Redo、
  自動バックアップ、UI の日英切替、着せ替え・背景画像。
  *Workflow: real-size preview, overflow warnings, a proofreading mode, undo/redo,
  auto-backup, a JA/EN UI toggle, and themes.*
- **出力** — PDF / PNG / HTML / SVG / PPTX / Marp（忠実度は `docs/export-matrix.md`）。
  *Export to PDF / PNG / HTML / SVG / PPTX / Marp.*
- **エージェント支援** — `rps` CLI（validate / info / explain / export）、VS Code 拡張
  （検証・プレビュー・警告）、Agent LLM 用 Skill を同梱。
  *Agent support: an `rps` CLI, a VS Code extension (validate/preview/warnings),
  and a bundled LLM Skill — all in this repo.*

詳細な仕様は `docs/design.md`（設計書）を参照してください。
*See `docs/design.md` for the full specification.*

## ダウンロード / Download

ビルド済みインストーラは [Releases](../../releases) から入手できます
（Windows `.msi` / `.exe`、macOS universal `.dmg`、Linux `.AppImage` / `.deb` / `.rpm`）。
*Prebuilt installers are on the [Releases](../../releases) page.*

アプリは未署名のため、初回起動時に OS の警告が出ることがあります。回避手順:
*The app is unsigned, so your OS may warn on first launch:*

- **Windows（SmartScreen）**: 「詳細情報」→「実行」。
- **macOS（Gatekeeper）**: アプリを右クリック →「開く」→「開く」。または
  システム設定 → プライバシーとセキュリティ →「このまま開く」。

自分でビルドする場合は下記の手順に従ってください。
*To build from source, follow the steps below.*

## 必要環境 / Requirements

- Node.js 18+（開発時 22 で確認 / tested on 22）
- Rust / Cargo（stable）
- OS ごとの Tauri 前提 / Tauri prerequisites（Windows: WebView2、Linux: webkit2gtk、
  macOS: Xcode CLT）

## クイックスタート / Quick start

```bash
npm install        # 初回のみ / first time (npm workspaces)
npm run dev        # build:libs → tauri dev（共有ライブラリを建ててから GUI 起動）
```

起動直後のダイアログから、新規作成（設定ウィザード）・サンプルを開く・
ファイルを開く・最近開いた一覧を選べます。

*On launch, a dialog lets you create a new project (a setup wizard), open a sample,
open an existing `poster.yaml`, or reopen a recent project.*

## CLI（`rps`）

```bash
npm run rps -- validate <project-dir>          # スキーマ＋警告チェック / validate
npm run rps -- explain  <project-dir> [--json] # Agent 向け構造要約 / structure summary
npm run rps -- export   pdf <project-dir>      # exports/ に出力 / export
npm run rps -- init     <dir> --template quantitative
```

HTML / SVG / Marp は追加依存なしで出力できます。PDF / PNG は初回のみ
`npx playwright install chromium` が必要です。
*(HTML/SVG/Marp need no extra deps; PDF/PNG require `npx playwright install
chromium` once.)*

## ビルド・検証 / Build & test

```bash
npm run build:libs                       # 共有ライブラリ / build shared libs
npm run tauri build -w @rps/desktop-app  # 配布物 / desktop installers
npm run typecheck                        # 全ワークスペースの型チェック / typecheck
npm run smoke                            # smoke test（要 build:libs）
```

GUI の目視確認は `docs/acceptance-tests.md`（手動受け入れテスト表）に従います。
*Manual GUI checks follow `docs/acceptance-tests.md`.*

## リポジトリ構成 / Repository layout

```text
packages/
  core/              @rps/core      型 / Zod schema / validate / layout（DOM 非依存）
  renderer/          @rps/renderer  PosterCanvas / HTML / SVG / Marp / markdown
  exporter/          @rps/exporter  HTML → PDF/PNG（Playwright）
  cli/               @rps/cli       rps（init / validate / explain / preview / export）
  desktop-app/       @rps/desktop-app   Tauri v2 + React GUI
  vscode-extension/  @rps/vscode-extension  VS Code 拡張（validate / preview / warnings）
examples/            サンプル（sample-poster / sample-nested / sample-full / sample-combined）
skills/research-poster-studio/  Agent LLM 用 Skill（SKILL.md / schema / templates / prompts）
docs/                design.md / architecture.md / export-matrix.md / agent-workflow.md ほか
```

レイアウト計算・検証・レンダリングは共有パッケージ（`@rps/core` / `@rps/renderer` /
`@rps/exporter`）にあり、デスクトップ・`rps` CLI・VS Code 拡張が同じ実装を使います。
*Layout, validation, and rendering live in shared packages, reused by the desktop
app, the `rps` CLI, and the VS Code extension (see `docs/architecture.md`).*

### ポスター1件の構成 / A single poster project

```text
poster-project/
├─ poster.yaml      # 構造・レイアウト・テーマ・ブロック・図表・出力設定
├─ content/*.md     # 各ブロックの本文（または単一 content.md）
├─ figures/*        # 図表（PNG/JPEG/SVG/PDF/CSV/Mermaid/Graphviz）
├─ references.bib   # BibTeX（任意 / optional）
├─ exports/         # 生成物 / generated outputs（git 管理外）
└─ backups/         # 自動バックアップ / auto-backups（git 管理外）
```

`exports/` と `backups/` は自動生成され、手で編集せず git にもコミットしません。
スキーマは `skills/research-poster-studio/schema/poster.schema.json` です。
*`exports/` and `backups/` are generated; don't edit or commit them.*

## 既知の制限 / Notes & limitations

- あふれは**警告のみ**で、最小可読サイズ未満への自動縮小はしません。
  *Overflow is reported as a warning; the tool never auto-shrinks below the
  minimum readable size.*
- PPTX は座標・テキスト・画像の近似出力です（提出用は PDF を推奨）。
  *PPTX is an approximate export; PDF is recommended for submission.*
- CLI の `rps export` は Graphviz を変換しますが、Mermaid と PDF 貼り込みは
  デスクトップアプリでのみ変換されます（CLI ではプレースホルダ）。
  *In the CLI, Mermaid and embedded PDFs render only in the desktop app.*

## ライセンス / License & attribution

作者 / Author: 中田友貴（Yuki Inoue Nakata）。研究・教育用途を想定したツールです。

本リポジトリは **Apache License 2.0** で公開しています（全文は [`LICENSE`](./LICENSE)、
帰属表示は [`NOTICE`](./NOTICE)）。
*Licensed under the **Apache License 2.0** (see [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE)).*

- **自由な利用 / Permissive** — 出典表示（著作権・ライセンス・NOTICE の保持）のもとで、
  **営利・非営利を問わず**自由に利用・改変・再配布できます。
  *Free to use, modify, and redistribute for any purpose, including commercial, with attribution.*
- **特許許諾 / Patent grant** — Apache-2.0 は貢献者からの特許ライセンスを含みます。
  *Includes an express patent license from contributors.*
- **表示 / Attribution** — 改変ファイルにはその旨を明示し、`LICENSE`・`NOTICE` を同梱してください。
  *Retain notices; state changes; include `LICENSE` and `NOTICE` in redistributions.*

連絡先 / contact: dj.y.nakata@gmail.com
