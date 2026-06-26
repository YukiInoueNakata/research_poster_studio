# Research Poster Studio 設計書 v0.1

## 1. 目的

Research Poster Studio は，質的研究・量的研究・混合研究・方法論研究の学会ポスターを，構造化データとGUIプレビューの両方から作成できるデスクトップアプリである．

PowerPoint のように自由配置で全オブジェクトを手作業調整するのではなく，研究内容を「研究単位」「セクション単位」「図表単位」で管理し，研究数や図表数の変化に応じて自動レイアウトできることを目的とする．

また，Claude Code，Codex，その他の Agent LLM が編集しやすいように，ポスター内容とレイアウト設定を Markdown / YAML / JSON のテキストファイルとして保存する．

## 2. 解決したい問題

### 2.1 PowerPoint の問題

既存の PowerPoint ベースのポスター作成では，以下の問題がある．

* 研究が1つ，2つ，3つに変わるたびに，全体の枠を手作業で再配置する必要がある．
* 質的研究，量的研究，方法論研究で必要な構造が異なる．
* 図表やモデル図のサイズ変更に伴い，他のブロックも手作業で調整しなければならない．
* 文字量が増減したときに，枠・フォントサイズ・余白の調整が面倒である．
* AIエージェントが編集しにくい．

### 2.2 Marp / VS Code の問題

Marp は Markdown ベースで構造化しやすいが，A0 / A1 ポスターでは次の問題がある．

* A0 サイズのプレビューが VS Code 上で扱いにくい．
* 図表の位置・倍率・余白の微調整が面倒である．
* 2段組，3段組，打ち抜き，研究数変更などを柔軟に扱うには CSS の負担が大きい．
* GUIで確認しながら調整する用途には弱い．

## 3. 基本方針

Research Poster Studio は，PowerPoint 代替の自由配置DTPソフトではなく，研究ポスター専用の構造化レイアウトエディタとして設計する．

### 3.1 やること

* A0 / A1 ポスターの作成
* 1研究・2研究・3研究構成への対応
* 質的研究・量的研究・混合研究・方法論研究テンプレート
* Markdown による本文管理
* YAML / JSON による構造化レイアウト管理
* GUIによる縮小プレビュー
* ブロック単位の高さ調整
* 左右カラム幅・高さ連動の調整
* フォントサイズ・フォントカラー・太字・斜体・下線の調整
* 図表の挿入，倍率調整，トリミング，全幅打ち抜き
* PDF 出力
* Agent LLM が作業しやすいファイル構造

### 3.2 やらないこと

初期バージョンでは以下をやらない．

* PowerPoint と同等の完全自由配置
* Illustrator 相当の本格DTP機能
* すべてのオブジェクトのピクセル単位編集
* 複雑なアニメーション
* 高度な画像編集
* 共同編集
* クラウド同期
* 完全な PPTX 互換

## 4. 想定ユーザー

* 質的研究者
* 量的研究者
* 心理学・社会科学・人文社会系の大学院生
* 学会ポスターを頻繁に作成する研究者
* Claude Code / Codex などの Agent LLM を用いて執筆・整形支援を受けたいユーザー

## 5. 対象ポスター類型

### 5.1 標準量的研究型

構成例：

* 背景
* 目的
* 方法
* 結果
* 考察
* 引用文献

用途：

* 実験研究
* 調査研究
* GLMM，ANOVA，回帰分析などを含む量的研究
* 図表・ヒストグラム・モデル図が多い研究

### 5.2 質的研究・プロセス図型

構成例：

* 背景
* 目的
* 方法
* 分析手続き
* 結果
* 事例引用
* モデル図／TEM図／プロセス図
* 考察
* 引用文献

用途：

* TEA / TEM
* KJ法
* インタビュー分析
* 評議分析
* 事例研究

### 5.3 複数研究型

構成例：

* 全体背景
* 研究1

  * 目的
  * 方法
  * 結果
  * 小考察
* 研究2

  * 目的
  * 方法
  * 結果
  * 小考察
* 研究3

  * 目的
  * 方法
  * 結果
  * 小考察
* 総合考察
* 引用文献

用途：

* 研究1・研究2・研究3を含むポスター
* 量的研究と質的研究を組み合わせた混合研究
* 予備調査＋本調査
* 分析1＋分析2＋総合考察

### 5.4 方法論・ツール紹介型

構成例：

* 背景と問題
* 既存手法の課題
* 提案
* ツール概要
* 実装
* 使用例
* 論文記載項目
* まとめ
* QR / 連絡先

用途：

* 研究方法論の提案
* 作図ツールの紹介
* 分析支援ツールの開発報告
* 方法論的整理

### 5.5 報告・活動紹介型

構成例：

* 背景
* 活動概要
* 実施内容
* 参加者の視点
* 実施者の視点
* 得られた示唆
* 今後の課題
* 引用文献

用途：

* 講習会報告
* フィールドワーク報告
* 研究会活動報告
* 教育実践報告

## 6. 基本ファイル構造

1つのポスタープロジェクトは，次の構造で保存する．

```text
poster-project/
├─ poster.yaml
├─ content/
│  ├─ background.md
│  ├─ purpose.md
│  ├─ method.md
│  ├─ results.md
│  ├─ discussion.md
│  └─ references.md
├─ figures/
│  ├─ fig1.svg
│  ├─ fig2.png
│  └─ table1.pdf
├─ themes/
│  └─ default.theme.yaml
├─ exports/
│  ├─ poster.pdf
│  ├─ poster.png
│  └─ poster.marp.md
└─ agent/
   ├─ tasks.md
   ├─ notes.md
   └─ review.md
```

## 7. poster.yaml の基本設計

```yaml
project:
  title: "研究ポスタータイトル"
  subtitle: "副題"
  authors:
    - name: "山田太郎"
      affiliation: "サンプル大学"
  conference:
    name: "学会名"
    date: "2026-06-09"
  poster_size: "A0"
  orientation: "portrait"

layout:
  template: "two-column-research"
  columns:
    count: 2
    width_mode: "ratio"
    ratio: [0.5, 0.5]
    height_balance: "auto"
    sync_mode: "independent"

theme:
  name: "default"
  font_family:
    body: "Noto Sans JP"
    heading: "Noto Sans JP"
    title: "Noto Sans JP"
  font_size:
    title: "54pt"
    subtitle: "32pt"
    heading1: "34pt"
    heading2: "28pt"
    body: "22pt"
    caption: "16pt"
    references: "13pt"
  colors:
    text: "#222222"
    heading: "#111111"
    accent: "#1f5f99"
    warning: "#c00000"
    muted: "#666666"
    background: "#ffffff"

blocks:
  - id: "background"
    type: "text"
    title: "背景"
    source: "content/background.md"
    column: "left"
    order: 1
    height:
      mode: "auto"
      min: "100mm"
      max: "220mm"
    style:
      body_font_size: "22pt"
      heading_color: "accent"
    overflow:
      action: "warn"

  - id: "method"
    type: "text"
    title: "方法"
    source: "content/method.md"
    column: "left"
    order: 2
    height:
      mode: "fixed"
      value: "160mm"
    overflow:
      action: "warn"

  - id: "results"
    type: "mixed"
    title: "結果"
    source: "content/results.md"
    column: "right"
    order: 1
    height:
      mode: "flex"
      weight: 2
      min: "180mm"
      max: "360mm"
    figures:
      - "fig1"
    overflow:
      action: "warn"

  - id: "discussion"
    type: "text"
    title: "考察"
    source: "content/discussion.md"
    column: "wide"
    order: 99
    height:
      mode: "auto"
      min: "80mm"
      max: "180mm"
    overflow:
      action: "warn"

figures:
  - id: "fig1"
    path: "figures/fig1.svg"
    caption: "図1．結果の概要"
    placement: "inside-block"
    block: "results"
    scale: 0.9
    crop:
      enabled: false
    style:
      border: false
      caption_position: "bottom"

export:
  pdf:
    enabled: true
    filename: "exports/poster.pdf"
  png:
    enabled: true
    filename: "exports/poster.png"
  marp:
    enabled: true
    filename: "exports/poster.marp.md"
```

### 7.x スタイル/記法の拡張（2026-06-16 実装）

§7 の基本例に加え，以下のフィールド・記法が実装済み（権威ある定義は
`packages/core/src/types.ts`，スキーマは `skills/.../poster.schema.json`）．
すべて opt-in・後方互換．

- **header**: `text_color`（著者/所属/学会名の文字色．濃色帯に白文字等），
  `affiliation_inline`（「氏名（所属）」を著者行に1行表示）．
- **block.style**: `heading_background`（塗り見出しバー），`heading_width_mode`
  (`full`/`fit`/`custom`)＋`heading_width`，`heading_accent_bar`＋`heading_bar_color`，
  `heading_badge {background,color,shape}`（番号バッジ），`card`（枠＋影＋見出し
  バー端まで密着），`accent_bar {color,width}`（本文ブロックの左バー），
  `line_height`，`paragraph_spacing_mm`．
- **figure**: `valign`（上中下），`float`（left/right＝本文回り込み，flow ベース・
  絶対配置ではない），`scale>1`（ブロック範囲を超えてはみ出し），`style.transparent_white`
  （白背景の擬似透過），`style.caption_color`，`gallery_columns`＋`images[]`，
  `image_crops`（ギャラリー画像ごとのトリミング）．EMF/WMF はデスクトップで PNG 変換．
- **theme**: `font_family { body, heading, title }`（固定レイアウト原稿の再現では
  元フォントに合わせることが重要）．
- **content.md 記法**: 本文中コールアウト箱 `::: note … :::`（Pandoc fenced div，
  `note`/`warning`/`muted`/`heading`），ネイティブチャート ` ```chart `（bar/line，
  依存なし・全エクスポート対応），既存の ` ```csv `/` ```mermaid `/` ```dot `．
- **数式（LaTeX）**: インライン `$…$` / `\(…\)`，ディスプレイ `$$…$$` / `\[…\]`．
  MathJax で自己完結 SVG に変換し，フォント非依存でプレビュー/HTML/SVG/PDF/CLI に同一描画
  （PPTX はラスタ化）．`$` の誤検出は Pandoc 規則（`$…$` 内側に空白なし，閉じ `$` の直後が
  数字でない）で回避，リテラルは `\$`．解析失敗はインラインのエラーマーカーに退避．
  Marp は front-matter `math: katex` で本文の `$…$` をネイティブ描画．
- これら描画機能はプレビュー・PDF・HTML・SVG・PNG・VS Code プレビューで同一に出る
  （`docs/export-matrix.md`）．EMF 変換・白の真アルファ化・余白自動トリムはデスクトップ
  専用の「変換アクション」（結果はどこでも描画）．

## 8. レイアウトエンジン

### 8.1 基本単位

レイアウトは次の階層で管理する．

```text
Poster
  ├─ Header
  ├─ Body
  │   ├─ Column
  │   │   └─ Block
  │   └─ Wide Block
  └─ Footer
```

### 8.2 ブロック高さモード

各ブロックの縦方向の長さは，次の4モードで管理する．

#### Auto

本文量・図表サイズ・余白に応じて自動決定する．

#### Fixed

ユーザーが指定した高さで固定する．

#### Flex

余った高さを weight に応じて分配する．

#### Locked

一度確定した高さを固定し，自動再配置の対象から外す．

### 8.3 左右カラム幅モード

左右カラムの幅は，次のモードを持つ．

```text
equal        : 左右 50:50
ratio        : 左右比率を指定
left_master  : 左カラムを基準に右が追従
right_master : 右カラムを基準に左が追従
independent  : 左右を独立管理
```

#### カラム数とカラム名（2026-06-11 拡張）

カラム数は 1〜6 をサポートする．カラム名は次のとおり．

```text
1〜3 カラム : left / (center) / right
4〜6 カラム : col1 .. colN（左から順）
wide        : 常に全幅（カラムバンドをフラッシュする）
```

* `left` / `center` / `right` はカラム数によらず「先頭列 / 中央列 / 末尾列」の
  別名として常に解決される（カラム数変更時に既存ブロックが破綻しない）．
* `colK` がカラム数を超える場合は先頭列にフォールバックし，警告
  `unknown-column` を出す．
* `ratio` はカラム数ぶんの配列を取り，合計に対して自動正規化される．

### 8.4 左右ブロック高さの連動モード

左右ブロックの高さは，次のモードを持つ．

```text
sync_row        : 同じ段の左右ブロックの高さを揃える
independent     : 左右で別々に高さ調整する
left_follows    : 先頭（左端）列のブロックが他列に追従する
right_follows   : 末尾（右端）列のブロックが他列に追従する
balance_columns : 左右カラム全体の高さ差が小さくなるよう自動調整する
```

### 8.5 自動再配置の基本ルール

* Header と Footer は原則として固定する．
* Locked ブロックは変更しない．
* Fixed ブロックは指定値を優先する．
* Auto ブロックは内容量から自然高さを算出する．
* Flex ブロックは余剰領域を weight に応じて分配する．
* overflow が生じた場合は，自動縮小ではなく警告を出す．
* 最小文字サイズ未満に自動縮小してはいけない．

## 9. GUI 要件

### 9.1 メイン画面

メイン画面は次の構成とする．

```text
左ペイン   : プロジェクト構造ツリー
中央       : A0 / A1 縮小プレビュー
右ペイン   : 選択中ブロックの設定
下部       : 警告・ログ・エクスポート結果
```

### 9.2 プレビュー

* A0 / A1 の実寸比率を保って表示する．
* ズーム倍率は 10%，20%，33%，50%，75%，100% を用意する．
* ブロック境界を表示／非表示できる．
* 選択中ブロックをハイライトする．
* 文字あふれ，余白不足，解像度不足を視覚的に警告する．

### 9.3 ブロック編集

ブロック選択時，右ペインで以下を編集できる．

* ブロックタイトル
* ブロック種別
* 表示／非表示
* カラム
* 順序
* 高さモード
* 最小高さ
* 最大高さ
* 固定高さ
* Flex weight
* 左右連動モード
* 上下余白
* 本文フォントサイズ
* 見出しフォントサイズ
* フォントカラー
* 背景色
* 枠線
* 文字あふれ時の挙動

### 9.4 テキスト編集

本文編集は Markdown を基本とする．

GUI上では以下を簡単に操作できるようにする．

* 太字
* 斜体
* 下線
* 文字色
* 強調色
* 見出し
* 箇条書き
* 番号付きリスト
* 引用
* 参考文献用の小さい文字

Markdown の保存例：

```markdown
本研究では，**文章プライムAMP**の有効性について検討した．
ただし，<u>刺激呈示時間</u>については今後の検討が必要である．
<span class="warning">解釈には注意が必要である</span>．
```

#### 9.4.1 本文ファイルの管理方式（2026-06-15 実装）

本文ファイルは 2 方式から選べる（後方互換・どちらでも開ける）．

1. **ブロック別**: ブロックごとに `content/<id>.md`（従来方式．`source: content/background.md`）．
2. **単一ファイル**: 全ブロックの本文を 1 枚の `content.md` で管理（`project.content_file: content.md`）．
   各ブロックは `source: "content.md#<id>"`（Pandoc 風の見出し属性アンカー）でセクションを参照する．
   新規プロジェクト（GUI ウィザード）は既定でこの方式．

単一ファイルの記法（標準 Markdown / Pandoc に準拠）：

```markdown
# 背景 {#background}
先行研究では…

# 結果 {#results}
## 研究1 {#study1}     ← 子ブロック（入れ子バンド）
…
### 補足               ← 本文中の見出し（構造化しない）
```

* `#`＝トップレベルブロック，`##`＝子ブロック，`###` 以降＝本文内の見出し．
* 見出しテキスト＝ブロックタイトル，`{#id}`＝安定キー（GUI で改名・並べ替えしても対応が壊れない）．
* 図を持つブロックの本文は内部的に `<id>__text` 子へ振り分けて保存・往復温存する．

#### 9.4.2 リストの自動採番（2026-06-15 実装・Pandoc fancy_lists 準拠＋拡張）

行頭マーカーを「書いた体裁のまま」連番に振り直す（型番号は無視され位置で決まる）：

* `(1)` / `1)` / `a.` / `a)` / `A.` / `i.` / `I.`（Pandoc fancy_lists）
* `#.`＝アウトライン自動採番（ネストで `1` → `1.1` → `1.1.1`）
* 拡張（標準 Markdown に対応なし）：① 丸数字，ア／あ かな（区切り必須），一 漢数字（区切り必須）
* プレーンな `1.` は標準の番号付きリスト（`<ol>`）のまま．コードフェンス内・散文・単独かな行は変換しない．

#### 9.4.3 見出し・図表の自動採番（2026-06-15 実装・opt-in）

`layout.number_sections` / `layout.number_figures`（既定 false・表示のみ・本文は書き換えない）：

* **章番号**: トップレベルのブロック見出しを読み順（カラム縦方向）で `1, 2, …`，子ブロックは `1.1`．
* **図表連番**: キャプションの既存ラベル（図N / 表N / Figure N / Table N）を宣言順に振り直す
  （図と表は別カウンタ，著者の語・言語は保持，ラベルの無いキャプションは不変）．
* GUI: 全体設定の「カラム」グループにトグル．Marp 出力も章番号に対応．

#### 9.4.4 本文ファイルの相互変換・一括編集（GUI）

全体設定の「本文ファイル」グループで，per-block（`content/*.md`）⇄ 単一（`content.md`）を
ボタンで相互変換できる（`block.source` と `content_file` を書き換え．保存時に反映．旧形式の
ファイルはディスク上に残る）．単一ファイル時は「本文をまとめて編集」で content.md 全体を
モーダルで編集できる（適用時に再パースしてタイトル・本文へ反映．未知見出しは新規ブロック化）．

### 9.5 フォント設定

フォント設定は3層で管理する．

```text
テーマ全体
  ↓
ブロック単位
  ↓
選択範囲のインライン装飾
```

#### テーマ全体

* タイトルフォント
* 見出しフォント
* 本文フォント
* タイトルサイズ
* 見出しサイズ
* 本文サイズ
* キャプションサイズ
* 引用文献サイズ
* 本文色
* 見出し色
* アクセント色
* 注意色
* 補足色

#### ブロック単位

* 背景だけ本文サイズを小さくする
* 結果だけ見出し色を変える
* 引用文献だけ小さくする
* 事例引用だけ斜体にする

#### 選択範囲

* 太字
* 斜体
* 下線
* 役割色
* カスタム色

## 10. 図表要件

### 10.1 対応形式

初期対応：

* PNG
* JPEG
* SVG
* PDF

将来対応：

* CSVから簡易表生成
* Mermaid
* Graphviz
* draw.io XML
* PowerPoint 図形の読み込み

> 実装メモ（2026-06-11 時点）：PDF 貼り込み（1 ページ目を PNG 化）・CSV 簡易表・
> Mermaid・Graphviz はデスクトップアプリで実装済み（ファイル追加と本文コード
> ブロックの両方）．未対応は draw.io XML と PowerPoint 図形の読み込みのみ．
> ただし CLI エクスポートでは PDF / Mermaid / Graphviz の変換が行われず
> プレースホルダになる（ロードマップ Phase 3 で解消予定．`docs/export-matrix.md` 参照）．

### 10.2 図表編集

GUIで以下を調整できる．

* 拡大縮小
* トリミング
* 中央寄せ
* 左寄せ
* 右寄せ
* 上寄せ
* 下寄せ
* キャプション位置
* 枠線あり／なし
* 全幅打ち抜き
* カラム内配置
* ブロック内配置

### 10.3 図表チェック

以下を警告する．

* 解像度不足
* 表示サイズに対して画像が粗い
* キャプション未設定
* 図表番号の重複
* 図表がブロックからはみ出している

## 11. 警告機能

Research Poster Studio は，次の警告を表示する．

### 11.1 文字関連

* 文字あふれ
* 本文文字サイズが小さすぎる
* 引用文献が読めないサイズになっている
* 見出しと本文のサイズ差が小さい
* 1ブロック内で強調が多すぎる
* 色の使いすぎ
* コントラスト不足

### 11.2 レイアウト関連

* 左右カラムの高さ差が大きい
* 余白が不足している
* ブロック間隔が狭すぎる
* 全幅ブロックが多すぎる
* Footer が圧迫されている

### 11.3 図表関連

* 画像解像度不足
* 図表が小さすぎる
* 図表の縦横比が崩れている
* キャプション未入力
* QRコードが小さすぎる

## 12. エクスポート

### 12.1 必須

* PDF
* PNG

### 12.2 任意

* Marp Markdown
* HTML
* PPTX

### 12.3 PDF 出力方針

HTML / CSS で生成したポスターを Chromium / Playwright 等で PDF 化する．

A0 / A1 サイズで正確に出力できることを優先する．

## 13. 推奨技術構成

### 13.1 MVP 推奨

```text
Electron
React
TypeScript
Vite
YAML parser
Markdown parser
CSS Grid
Playwright or Chromium PDF Export
```

理由：

* Claude Code / Codex が扱いやすい．
* Web技術でGUIを作れる．
* PDF出力に Chromium を使いやすい．
* 初期開発が速い．

### 13.2 将来候補

```text
Tauri
React
TypeScript
Rust backend
```

理由：

* 軽量なデスクトップアプリにできる．
* 長期的な配布に向いている．

ただし，MVPでは Electron を優先する．

> 実装メモ：本リポジトリではヒアリングの結果，MVP から Tauri + React + TypeScript + Vite を採用した（全OS対応・軽量配布を優先）．PDF はwebview印刷（@page で A0/A1 実寸）で出力する．

## 14. 開発フェーズ

### Phase 0：仕様固定

* 本設計書の確定
* ヒアリング項目の整理
* MVP範囲の確定
* サンプルポスタープロジェクトの作成

### Phase 1：プロジェクト基盤

* Electron + React + TypeScript + Vite のセットアップ
* poster.yaml 読み込み
* Markdown 読み込み
* figures 読み込み
* A0 / A1 の仮想キャンバス表示

### Phase 2：基本レイアウト

* 2カラム表示
* 3カラム表示
* 全幅ブロック
* Header / Footer
* Auto / Fixed / Flex / Locked の高さ処理
* 左右カラム比率の変更

### Phase 3：GUI調整

* ブロック選択
* 右ペインでのブロック設定
* 高さ調整
* カラム幅調整
* 左右高さ連動
* ズームプレビュー

### Phase 4：テキスト・フォント編集

* Markdown エディタ
* 太字
* 斜体
* 下線
* 文字色
* 役割色
* ブロック別フォントサイズ
* テーマ別フォント設定

### Phase 5：図表編集

* 画像挿入
* SVG / PNG / JPEG / PDF 表示
* 拡大縮小
* トリミング
* キャプション
* 図表チェック

### Phase 6：PDF出力

* A0 PDF出力
* A1 PDF出力
* PNG出力
* 余白・サイズ検証
* 印刷用チェック

### Phase 7：Agent LLM Skill化

* Agent用の SKILL.md 作成
* Claude Code / Codex 用タスクファイル作成
* 生成・検証・修正ワークフロー作成
* サンプルプロジェクトを用いた自動テスト

## 15. Agent LLM 対応方針

Agent LLM が扱う対象は，GUIそのものではなく，以下のテキストファイルとする．

```text
poster.yaml
content/*.md
themes/*.theme.yaml
agent/tasks.md
agent/review.md
```

Agent LLM に依頼する作業例：

* 研究内容から poster.yaml を生成する
* 研究1・研究2構成に変換する
* 量的研究型テンプレートから質的研究型テンプレートへ変換する
* 文字量が多いブロックを短縮する
* 見出しを統一する
* 図表キャプションを整える
* 引用文献ブロックを小さくする
* 結果ブロックを全幅化する
* 左右カラム比を 55:45 にする
* 警告ログを見て poster.yaml を修正する

## 16. Skill化設計

### 16.1 Skill の目的

Agent LLM が Research Poster Studio のポスタープロジェクトを安全に作成・編集・検証できるようにする．

### 16.2 Skill ディレクトリ構成

```text
skills/
└─ research-poster-studio/
   ├─ SKILL.md
   ├─ schema/
   │  ├─ poster.schema.json
   │  └─ theme.schema.json
   ├─ templates/
   │  ├─ quantitative.yaml
   │  ├─ qualitative.yaml
   │  ├─ mixed-methods.yaml
   │  ├─ multi-study.yaml
   │  └─ method-tool.yaml
   ├─ prompts/
   │  ├─ create-poster.md
   │  ├─ revise-layout.md
   │  ├─ shorten-overflow.md
   │  ├─ check-readability.md
   │  └─ export-review.md
   └─ examples/
      ├─ sample-quantitative/
      ├─ sample-qualitative/
      └─ sample-method-tool/
```

### 16.3 SKILL.md の内容

実装版は `skills/research-poster-studio/SKILL.md` を参照．

## 17. 開発プロンプト

（初期開発プロンプトは省略．実装は本リポジトリに準拠．）

## 18. MVP 完了条件

MVP は，次を満たせば完了とする．

* アプリが起動する．
* サンプルの poster.yaml を読み込める．
* A0縦のポスターが縮小プレビューされる．
* 2カラムが表示される．
* 全幅ブロックが表示される．
* ブロックの高さモードを変更できる．
* カラム幅比を変更できる．
* 選択ブロックのフォントサイズを変更できる．
* 選択ブロックの文字色を変更できる．
* Markdown の太字・斜体・下線が表示される．
* 図表を表示できる．
* PDFを書き出せる．
* Agent LLM 用 Skill が同梱されている．

## 19. ヒアリング項目（確定済み）

* 対応OS：全OS（Windows / macOS / Linux）
* 初期技術選定：Tauri + React + TypeScript + Vite（MVP から Tauri を採用）
* 出力：PDF / PNG 必須，SVG / PPTX / Marp / HTML も対応
* ポスターサイズ：A0縦を最優先，A1 / A2・横向きにも対応
  （その後インチ系プリセット・カスタムサイズも実装）
* 図表形式：PNG / JPEG / SVG（PDF図表貼り込みは将来対応 → その後実装済み．
  CSV / Mermaid / Graphviz も実装済み．§10.1 実装メモ参照）
* テキスト編集：Markdownエディタ
* レイアウト自由度：ブロック単位
* AI連携：ファイルベース連携（poster.yaml / content / SKILL.md）
* 配布：研究室内配布を想定
