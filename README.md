# Research Poster Studio

[![CI](https://github.com/YukiInoueNakata/research_poster_studio/actions/workflows/ci.yml/badge.svg)](https://github.com/YukiInoueNakata/research_poster_studio/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.23114417.svg)](https://doi.org/10.5281/zenodo.23114417)
<!-- npm badge (add if @rps/cli is published):
[![npm](https://img.shields.io/npm/v/@rps/cli.svg)](https://www.npmjs.com/package/@rps/cli) -->

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

![Research Poster Studio の編集画面。左にブロックのツリー、中央に A0 ポスターの実寸プレビュー、右にブロック設定のインスペクタ。 / The desktop app: block tree on the left, a real-size A0 poster preview in the center, and the block inspector on the right.](docs/screenshot.png)

## 背景と目的 / Statement of need

学会ポスターは A0・A1 など大判で、多数のブロックと図表を限られた面積に収める必要が
あります。PowerPoint や Illustrator などの自由配置 DTP では、テキスト量や図表数が変わる
たびに要素の位置とサイズを手作業で調整することになり、レイアウトが崩れやすく、変更履歴の
追跡や再現も困難です。Research Poster Studio は、ポスターをカラム・ブロック・高さモードで
**構造的に**記述し、内容量が変わってもレイアウトが破綻しにくくします。ポスターの実体は
プレーンテキスト（YAML + Markdown + BibTeX）と図表ファイルなので、Git でバージョン管理でき、
差分レビューや AI エージェント（Claude Code / Codex 等）による編集にも適します。想定利用者は、
学会ポスターを作成する研究者、とりわけ再現可能・版管理された制作フローや LLM 支援を求める
利用者です。

*Conference posters are large-format (A0/A1) and must fit many blocks and figures into a
fixed area. In free-placement DTP tools such as PowerPoint or Illustrator, every change in
text length or figure count forces manual repositioning and resizing, so layouts break
easily and are hard to version or reproduce. Research Poster Studio describes a poster
**structurally** through columns, blocks, and height modes, keeping the layout robust as
content changes. Because a poster is plain text (YAML + Markdown + BibTeX) plus figure
files, it is Git-versionable and amenable to diff review and AI-agent editing (Claude Code,
Codex). Target users are researchers preparing conference posters — especially those who
want a reproducible, version-controlled workflow or LLM-assisted authoring.*

## 主な機能 / Features

- **用紙・レイアウト** — A0/A1/A2・インチ系プリセット・カスタムサイズ、1〜6 カラム＋
  全幅ブロック、高さモード（auto/fixed/flex/locked）と高さ連動、入れ子ブロック。
  *Paper & layout: A0–A2, inch presets, custom sizes; 1–6 columns + full-width;
  height modes with row-sync; nested blocks.*
- **本文・装飾** — Markdown 本文（ブロック別 `content/*.md` または単一 `content.md`）、
  見出しバー・番号バッジ・カード型・コールアウト箱・チャート・**数式（LaTeX）**、
  リストの自動採番。
  *Content: Markdown body (per-block or single file), heading bars/badges/cards/
  callouts/charts/**math (LaTeX)**, auto-numbered lists.*
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
  （検証・プレビュー・警告．開発版で、Marketplace には未公開．`packages/vscode-extension` を
  VS Code で開き F5 で起動）、Agent LLM 用 Skill を同梱。
  *Agent support: an `rps` CLI, a VS Code extension (validate/preview/warnings; a development
  build, not yet on the Marketplace — open `packages/vscode-extension` and press F5), and a
  bundled LLM Skill — all in this repo.*

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
  macOS 15 以降などで「壊れているため開けません」と表示される場合は、ターミナルで次を実行してから開いてください。
  *If macOS says the app "is damaged and can't be opened", clear the quarantine flag in Terminal:*

  ```bash
  xattr -dr com.apple.quarantine "/Applications/Research Poster Studio.app"
  ```

> **Linux の AppImage を端末から起動したときの警告 / Warnings when starting the AppImage:**
> `Failed to load module "canberra-gtk-module"` や `libgvfscommon.so: undefined symbol: g_task_set_static_name` が表示されることがあります。
> 前者は操作音のモジュール、後者は AppImage に同梱された GLib とシステムの GVfs の版の違いによるもので、
> アプリが起動していれば無視して構いません（`.deb` 版では通常表示されません）。
> *These GTK/GVfs messages (sound module; bundled GLib vs. system GVfs version) are harmless if the app starts;
> the `.deb` build normally does not print them.*

> **Windows でアンインストールできない場合 / If uninstall is blocked on Windows:**
> `.exe`（NSIS）版のアンインストーラ `uninstall.exe` は未署名のため、**スマート アプリ コントロール（SAC）**が
> 有効な環境ではブロックされ、アンインストールが完走しないことがあります。この場合、`uninstall.exe` と
> インストール先フォルダが削除されずに残ります。その場合は、アプリを閉じたうえで次のフォルダを**手動で削除**してください。
> *The `.exe` (NSIS) uninstaller `uninstall.exe` is unsigned, so Smart App Control (SAC) may block it and the
> uninstall may not complete, leaving `uninstall.exe` and its folder behind. If so, close the app and delete this
> folder manually:*
>
> ```
> %LocalAppData%\Research Poster Studio
> ```
>
> （エクスプローラーのアドレスバーに `%LocalAppData%` と入力すると該当フォルダへ移動できます。）
> *`.msi` 版、または SAC が無効な環境では、通常のアンインストールで削除されます。*
> *On the `.msi` build, or when SAC is off, the normal uninstall removes everything.*

自分でビルドする場合は下記の手順に従ってください。
*To build from source, follow the steps below.*

## 必要環境 / Requirements

まず用途を選んでください。必要なものが変わります。
*Pick your use case first — the prerequisites differ.*

- **アプリを使うだけ / Just use the app** → 上の [Download](#ダウンロード--download) から
  インストーラを入れるだけです。以下は何もインストール不要。
  *Install from the Releases page. Nothing below is required.*
- **CLI（`rps`）を使う／ソースから動かす / Use the CLI or run from source** → 下の
  「1. Node.js」を入れてください。
  *Install Node.js (step 1 below).*
- **デスクトップアプリを自分でビルド / Build the desktop app yourself** → 「1」に加えて
  「2. Rust」と「3. Tauri 前提」も入れてください。
  *Additionally install Rust (step 2) and the Tauri prerequisites (step 3).*

### 1. Node.js（CLI・ソース利用に必須 / required for the CLI and source）

Node.js を入れると **`npm` も一緒に入ります**（npm は Node.js に同梱のコマンドなので、
別途インストールは不要です）。
*Installing Node.js also installs `npm` — npm ships with Node.js, so you do not install it
separately.*

- **インストール / Install**: 公式サイト <https://nodejs.org/> から **LTS 版（20.19 以上）** を入れる。
  - Windows: ダウンロードした `.msi` を実行。または PowerShell で `winget install OpenJS.NodeJS.LTS`
  - macOS: 公式インストーラ、または `brew install node`
  - Linux: 各ディストリのパッケージ、または [nvm](https://github.com/nvm-sh/nvm)
- **必要バージョン / Version**: **Node.js 20.19 以上**（開発・CI は 22 で確認 / tested on 22）。
- **確認 / Verify**: ターミナル（Windows は PowerShell）で次を実行し、両方がバージョン番号を
  表示すれば準備完了です。
  ```bash
  node -v      # 例 / e.g. v22.x.x
  npm -v       # 例 / e.g. 10.x.x
  ```

### 2. Rust / Cargo（デスクトップアプリをソースからビルドする場合のみ / only to build the app）

CLI やビルド済みアプリの利用には不要です。
*Not needed for the CLI or the prebuilt app.*

- <https://rustup.rs/> から stable を入れる。確認 / verify: `cargo --version`

### 3. OS ごとの Tauri 前提（同じくビルドする場合のみ / only when building）

- **Windows**: WebView2（Windows 11 は標準搭載。無ければ Microsoft の Evergreen ランタイム）
- **macOS**: Xcode Command Line Tools（`xcode-select --install`）
- **Linux**: webkit2gtk（例: Ubuntu は `libwebkit2gtk-4.1-dev`）

## クイックスタート / Quick start

「1. Node.js」まで済んでいる前提です。ターミナル（Windows は PowerShell）で、まず
リポジトリを取得し、そのフォルダの中で各コマンドを実行します。
*Assuming Node.js (step 1) is installed. In a terminal, get the repository and run the
commands inside that folder.*

```bash
git clone https://github.com/YukiInoueNakata/research_poster_studio.git
cd research_poster_studio     # 以降のコマンドはこのフォルダ内で / run everything here
npm install                   # 依存をまとめて取得（初回のみ）/ install deps (first time)
npm run dev                   # 共有ライブラリを建てて GUI を起動 / build libs, then launch the GUI
```

`npm run dev` はソースからデスクトップアプリを起動するため、上の「2. Rust」「3. Tauri 前提」も
必要です。GUI ではなく `rps` コマンドだけ使いたい場合は Rust なしで動きます（下の
[CLI](#clirps) 参照）。
*`npm run dev` runs the desktop app from source, so it also needs Rust (step 2) and the
Tauri prerequisites (step 3). If you only want the `rps` command, no Rust is needed — see
[CLI](#clirps) below.*

起動直後のダイアログから、新規作成（設定ウィザード）・サンプルを開く（日本語版／英語版）・
ファイルを開く・最近開いた一覧を選べます。サンプルは架空研究の A0 ポスター
（[`examples/sample-cat-paws-ja`](examples/sample-cat-paws-ja)・[`examples/sample-cat-paws-en`](examples/sample-cat-paws-en)）で、
開くと書き込み可能なフォルダ（ドキュメント配下）にコピーされます。

*On launch, a dialog lets you create a new project (a setup wizard), open a sample poster
(Japanese or English), open an existing `poster.yaml`, or reopen a recent project. The
samples are fictional-study A0 posters ([`examples/sample-cat-paws-en`](examples/sample-cat-paws-en),
[`examples/sample-cat-paws-ja`](examples/sample-cat-paws-ja)); opening one copies it to a
writable folder under your Documents.*

### デスクトップアプリから PDF を書き出す / PDF from the desktop app

デスクトップアプリの PDF 出力は OS の印刷ダイアログを使います。ポスターが切れないよう、次のように設定してください
（Ubuntu などでは用紙が A4 のままになりやすく、端が切れる原因になります）。
*The desktop app's PDF export goes through the system print dialog. To avoid a cropped poster, set:*

- **出力先 / Destination**: PDF に保存（Windows: 「PDF に保存」/「Microsoft Print to PDF」、Ubuntu: 「ファイルに出力」→ PDF）
  *Save as PDF / Print to File (PDF).*
- **用紙サイズ / Paper size**: ポスターと同じ（A0 = 841 × 1189 mm、A1 = 594 × 841 mm）。一覧に無ければユーザー定義サイズを作る
  *the poster's size (A0 = 841 × 1189 mm, A1 = 594 × 841 mm); create a custom size if it is not listed.*
- **余白 / Margins**: なし / None、**倍率 / Scale**: 100%（「ページに合わせる」はオフ / no "fit to page"）
- **macOS**: 印刷ダイアログの「詳細を表示」→「用紙サイズ」→「カスタムサイズを管理」で 841 × 1189 mm（余白 0）を作って選び、
  左下の「PDF」→「PDF として保存」。macOS ではポスター側の用紙指定が効かず、既定の用紙（A4 など）に分割されるため。
  *macOS: Show Details → Paper Size → Manage Custom Sizes (841 × 1189 mm, zero margins), then PDF → Save as PDF;
  otherwise macOS splits the poster over the default paper size.*

背景色は「背景のグラフィックス」を選ばなくても印刷されます（v0.1.2 以降）。実寸の PDF を確実に作るには CLI の
`npm run rps -- export pdf <project-dir>` も使えます（[CLI](#clirps) 参照）。
*Backgrounds print without the "Background graphics" option (v0.1.2+). For an exact-size PDF
without the dialog, use the CLI: `npm run rps -- export pdf <project-dir>`.*

## Windows でゼロからセットアップする / Windows setup from scratch

ビルド済みインストーラを使わず、**Windows でソースからビルドして起動する**ための手順を、
何も入っていない状態から順に説明します。以下はすべて **PowerShell** で実行します
（スタートメニューで `powershell` と検索して起動）。
*A step-by-step guide to building and running from source on Windows, starting from nothing.
Run everything in **PowerShell** (search `powershell` in the Start menu).*

> **ヒント / Tip:** 各ツールをインストールした後は、**PowerShell を一度閉じて開き直して**から
> 確認コマンドを実行してください。インストーラが設定した PATH は、新しく開いたウィンドウにしか
> 反映されません（`node` や `git` が「認識されません」と出る典型的な原因です）。
> *After installing a tool, close and reopen PowerShell before verifying — PATH changes only
> apply to newly opened windows.*

### 1. WebView2 ランタイム（Tauri の必須要件 / required by Tauri）

Windows 11 と最近の Windows 10 には標準搭載です。導入済みか確認するには次を実行します。
バージョン番号（例: `151.0.4129.86`）が返れば導入済みです。
*Bundled with Windows 11 and recent Windows 10. Check with the command below — a version
number means it is installed.*

```powershell
Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" -Name pv -ErrorAction SilentlyContinue | Select-Object pv
```

何も返らない場合は、Microsoft の Evergreen ランタイムを入れてください
（<https://developer.microsoft.com/microsoft-edge/webview2/>）。
*If nothing is returned, install the Evergreen runtime from the link above.*

### 2. Node.js / npm

winget で LTS 版を入れるのが簡単です（`npm` も同梱されます）。
*The easiest route is winget (it also installs `npm`):*

```powershell
winget install OpenJS.NodeJS.LTS
```

LTS の世代により、現在は **v24 系**が入ることがありますが、本ツールの要件（20.19 以上）を満たすので
問題ありません。インストール後、**PowerShell を開き直して**確認します。
*Depending on the current LTS line, this may install the v24 series — that still meets the
requirement (20.19+). Reopen PowerShell, then verify:*

```powershell
node -v      # 例 / e.g. v24.x.x
npm -v       # 例 / e.g. 11.x.x
```

> **npm で「スクリプトの実行が無効」エラーが出たら / If `npm` fails with an execution-policy error:**
> PowerShell のスクリプト実行がブロックされているためです。次を実行して許可します
> （途中で確認を聞かれたら `Y`）。
> *PowerShell is blocking script execution. Run the following (answer `Y` when prompted):*
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```
> `CurrentUser` スコープ・`RemoteSigned` は管理者権限不要で、開発用途に安全な標準的設定です。
> *This user-scoped, `RemoteSigned` setting needs no admin rights and is the standard, safe choice for development.*

### 3. Rust / Cargo

<https://rustup.rs/> から `rustup-init.exe` を実行し、デフォルト（stable）で入れます。
開き直して確認します。
*Run `rustup-init.exe` from rustup.rs with the default (stable) profile, reopen PowerShell, then verify:*

```powershell
rustc --version    # 例 / e.g. rustc 1.97.x
cargo --version    # 例 / e.g. cargo 1.97.x
```

> **C++ ビルド環境 / C++ build tools:** Rust が Windows でコンパイルするには MSVC のリンカーが
> 必要です。`rustup` の導入時に自動で案内・設定されることが多く、後述の `npm run dev` が通れば
> 揃っている証拠です。もし `link.exe not found` などのエラーが出たら、Visual Studio Build Tools の
> **「C++ によるデスクトップ開発」** を入れてください
> （<https://visualstudio.microsoft.com/visual-cpp-build-tools/>）。
> *Rust needs the MSVC linker on Windows. `rustup` usually sets this up; if a build later fails with
> `link.exe not found`, install the "Desktop development with C++" workload of Visual Studio Build Tools.*

### 4. Git

winget で入れて、開き直して確認します。
*Install with winget, reopen PowerShell, then verify:*

```powershell
winget install Git.Git
git --version      # 例 / e.g. git version 2.x.x
```

> **`git --version` で「認識されません」と表示されたら / If `git --version` reports "not recognized":**
> 「用語 'git' は、コマンドレット、関数、スクリプト ファイル、または操作可能なプログラムの名前として
> 認識されません」と出る場合は、Git が未インストール（または PATH 未反映）です。上記の
> `winget install Git.Git` で導入し、**PowerShell を開き直してから**再度 `git --version` を実行してください。
> `git version 2.x.x` のように返れば成功です。
> *If you see "'git' is not recognized as ... a cmdlet, function, script file, or operable program",
> Git is not installed yet (or PATH hasn't refreshed). Install it with `winget install Git.Git` above,
> reopen PowerShell, and run `git --version` again — `git version 2.x.x` means success.*

### 5. RPSの取得・インストール・起動 / Clone, install, run for RPS

任意の作業フォルダ（例ではドキュメント）に移動してから取得します。
*Move into a working folder (Documents here), then clone:*

```powershell
cd $env:USERPROFILE\Documents                                      # = C:\Users\<あなた>\Documents
git clone https://github.com/YukiInoueNakata/research_poster_studio.git
cd research_poster_studio
npm install                                                        # 依存を取得（初回のみ）/ install deps (first time)
npm run dev                                                        # ビルドして GUI を起動 / build and launch the GUI
```

`npm run dev` は初回のみ Rust のクレートを一からコンパイルするため、**数分〜十数分**かかることが
あります。ログが流れた後、デスクトップアプリのウィンドウが自動で立ち上がれば成功です。
*The first `npm run dev` compiles Rust crates from scratch and can take several minutes; the desktop
window opens automatically when ready.*

> **起動後の注意 / While running:** PowerShell のウィンドウは**閉じないでください**（アプリが
> 動き続ける土台です）。終了するときはアプリを閉じてから、PowerShell で **`Ctrl + C`** を押します。
> *Keep the PowerShell window open while using the app; press `Ctrl + C` to stop the dev server.*

### 次回以降の起動 / Running again later

セットアップ済みなら、次回からは以下だけで起動できます（`npm install` は不要）。
*Once set up, later launches only need:*

```powershell
cd $env:USERPROFILE\Documents\research_poster_studio
npm run dev
```

PDF / PNG 出力を使う場合のみ、初回に一度だけ次を実行しておきます。
*For PDF/PNG export, run this once:*

```powershell
npx playwright install chromium
```

## CLI（`rps`）

`rps` は Rust なしで使えます（デスクトップアプリのビルドは不要）。「1. Node.js」だけ
入っていれば動きます。まだの場合は先にコードを取得して依存を入れてください。
*The `rps` CLI needs no Rust — only Node.js (step 1). If you have not done so yet, get the
code and install dependencies first:*

```bash
git clone https://github.com/YukiInoueNakata/research_poster_studio.git
cd research_poster_studio
npm install
```

CLI は共有ライブラリを使うため、**続けて `npm run build:libs` を一度実行**します（以降は
不要）。パスはリポジトリルートからの相対で指定できます。
*Then run `npm run build:libs` once (the CLI uses the shared libraries). Paths are resolved
relative to the repository root.*

```bash
npm run build:libs                             # 初回のみ / once

npm run rps -- validate <project-dir>          # スキーマ＋警告＋はみ出し / validate
npm run rps -- explain  <project-dir> [--json] # Agent 向け構造要約 / structure summary
npm run rps -- export   pdf <project-dir>      # exports/ に出力 / export
npm run rps -- init     <dir> --template quantitative
```

`npm run rps --` が `rps` コマンド本体で、`--` の後ろに `rps` の引数を書きます
（例: `npm run rps -- validate examples/sample-cat-paws-en`）。`<project-dir>` は
poster.yaml のあるフォルダに置き換えてください。同梱サンプルは `examples/` にあります。
*`npm run rps --` invokes the CLI; put the `rps` arguments after `--`. Replace
`<project-dir>` with a folder containing `poster.yaml` (bundled samples are in
`examples/`).*

`validate` は Chromium で実際にレイアウトし、版面の下端やブロック枠からのはみ出しも
エラーとして報告します（Chromium が無ければその旨を表示して省略、`--no-measure` で無効化）。
*`validate` also lays the poster out in Chromium and reports content running off the page
or out of a block as errors (skipped with a notice if Chromium is missing; disable with
`--no-measure`).*

HTML / SVG / Marp は追加依存なしで出力できます。PDF / PNG は初回のみ
`npx playwright install chromium` が必要です。
*(HTML/SVG/Marp need no extra deps; PDF/PNG require `npx playwright install
chromium` once.)*

### 動作確認 / Quick verification

インストールが成功したかは、同梱サンプルを検証して PDF に書き出すと確認できます。
*To confirm a working installation, validate a bundled sample and export it to PDF:*

```bash
git clone https://github.com/YukiInoueNakata/research_poster_studio.git
cd research_poster_studio
npm install
npm run build:libs
npx playwright install chromium                # PDF/PNG 出力に必要 / needed for PDF

npm run rps -- validate examples/sample-cat-paws-en    # → ✓ 0 errors, 0 warnings
npm run rps -- export pdf examples/sample-cat-paws-en  # → exports/poster.pdf
```

最後のコマンドで `examples/sample-cat-paws-en/exports/poster.pdf`（A0 実寸）が生成されます。
*The last command writes `examples/sample-cat-paws-en/exports/poster.pdf` at full A0 size.*

## ビルド・検証 / Build & test

```bash
npm run build:libs                       # 共有ライブラリ / build shared libs
npm run tauri build -w @rps/desktop-app  # 配布物 / desktop installers
npm run typecheck                        # 全ワークスペースの型チェック / typecheck
npm test                                 # 単体テスト（vitest）/ unit tests
npm run smoke                            # smoke test（要 build:libs）
npm run smoke:desktop                    # デスクトップ UI の描画確認（要 Chromium）/ desktop UI renders
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
examples/            標準デモ（猫の手ポスター 日本語版・英語版．架空研究）
tests/fixtures/      機能検証用プロジェクト（smoke テスト・手動受け入れテスト用）
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

## 貢献・サポート / Contributing & support

- **貢献 / Contributing** — 開発環境・PR の出し方は [`CONTRIBUTING.md`](./CONTRIBUTING.md)、
  行動規範は [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) を参照してください。
  *How to set up and open a PR: [`CONTRIBUTING.md`](./CONTRIBUTING.md); conduct: [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).*
- **不具合報告・機能要望 / Issues** — [GitHub Issues](https://github.com/YukiInoueNakata/research_poster_studio/issues)
  にテンプレートから登録してください。
  *Report bugs or request features via [GitHub Issues](https://github.com/YukiInoueNakata/research_poster_studio/issues).*
- **使い方の相談 / Support** — 相談先は [`SUPPORT.md`](./SUPPORT.md)（GitHub Issues と
  作者メール dj.y.nakata@gmail.com）。
  *Where to get help: [`SUPPORT.md`](./SUPPORT.md) (GitHub Issues, or email dj.y.nakata@gmail.com).*

## ライセンス / License & attribution

作者 / Authors（研究・教育用途を想定したツールです / built for research and teaching）:

- 中田友貴（Yuki Inoue Nakata, [ORCID 0009-0000-4934-323X](https://orcid.org/0009-0000-4934-323X)）—
  設計・実装・文書 / design, implementation, documentation
- 長谷川翔一（Shoichi Hasegawa, [ORCID 0000-0001-9080-902X](https://orcid.org/0000-0001-9080-902X)）—
  開発・既存ポスター再現による検証・検証用ポスターデータの提供・Windows／Ubuntu セットアップ手順 /
  development, validation by reproducing existing posters, test poster data, Windows/Ubuntu setup guides

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

## 引用 / Citation

本ソフトウェアを利用した場合は引用してください。機械可読なメタデータは
[`CITATION.cff`](./CITATION.cff) にあります（GitHub の "Cite this repository" からも取得できます）。
*If you use this software, please cite it. Machine-readable metadata is in
[`CITATION.cff`](./CITATION.cff) (also via GitHub's "Cite this repository").*

下記の DOI は全バージョン共通の concept DOI です（常に最新版に解決）。特定の版を引用する場合は、
`version` を書き足し、DOI をその版の DOI に差し替えてください（各版の DOI は
[Zenodo の版一覧](https://doi.org/10.5281/zenodo.23114417)、例: v0.1.0 = [10.5281/zenodo.23114418](https://doi.org/10.5281/zenodo.23114418)）。
*The DOI below is the concept DOI, which always resolves to the latest version. To cite a specific
version, add `version` and use that version's DOI (listed on [Zenodo](https://doi.org/10.5281/zenodo.23114417);
e.g. v0.1.0 = [10.5281/zenodo.23114418](https://doi.org/10.5281/zenodo.23114418)).*

```bibtex
@software{nakata_research_poster_studio,
  author  = {Nakata, Yuki Inoue and Hasegawa, Shoichi},
  title   = {Research Poster Studio},
  year    = {2026},
  url     = {https://github.com/YukiInoueNakata/research_poster_studio},
  doi     = {10.5281/zenodo.23114417}
}
```
