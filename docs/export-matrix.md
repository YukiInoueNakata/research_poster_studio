# エクスポート品質基準表（export matrix）

各出力形式の忠実度・想定用途・制限の一覧．**学会提出・印刷入稿には PDF を推奨**する．

最終更新: 2026-06-16（feature-needs 一括実装後．新レンダラ機能の一致性・EMF 差分を追記）．

## 形式別マトリクス

| 形式 | 忠実度 | 想定用途 | デスクトップ | CLI（`rps export`） | 制限・注意 |
|---|---|---|---|---|---|
| **PDF** | 実寸・最高（推奨） | **学会提出・印刷入稿** | OK（webview 印刷．印刷ダイアログで「PDF として保存」を選択） | OK（ヘッドレス Chromium．要 `npx playwright install chromium`） | デスクトップは印刷ダイアログ経由（自動保存なし）．CLI は下記「CLI との差」参照 |
| **PNG** | 実寸ラスタ | 入稿先がラスタ画像指定のとき・サムネイル | OK（既定 150 dpi．保存ダイアログあり） | OK（要 Playwright Chromium） | 解像度は dpi に依存．拡大編集には不向き |
| **HTML** | 高（自己完結 1 ファイル） | Web 共有・リンクをクリック可能な配布 | OK | OK（追加依存なし） | フォントは閲覧環境依存（`Noto Sans JP` 未導入環境では代替フォント） |
| **SVG** | 高（ベクタ） | ベクタ編集の出発点・Web 埋め込み | OK | OK（追加依存なし） | `foreignObject` を使うため対応ビューア限定（ブラウザは OK，Illustrator 等では崩れる場合あり） |
| **PPTX** | 近似 | 共同編集・PowerPoint での二次利用 | OK（pptxgenjs．プレビュー DOM の実測座標から生成） | NG（未対応） | 座標・テキスト・画像の近似再現．Markdown 装飾・枠線は簡略．提出用には使わない |
| **Marp Markdown** | 構造のみ | スライド（口頭発表資料）への転用 | OK | OK（追加依存なし） | レイアウトは保持されない（ブロックをスライドに分解） |

## プレビューとの一致性

プレビュー・PDF・HTML・SVG・PNG は**同一レンダラ**（`@rps/renderer` の
`PosterCanvas`）を共有しており，mm 実寸で描画される．プレビューで確認した
見た目がそのまま出力される（PPTX / Marp のみ近似・変換出力）．

VS Code 拡張のプレビュー（`buildHtml`）と `rps export html/svg/pdf/png` も
同じレンダラを通るため，以下のレンダラ機能は**デスクトップ・VS Code・CLI で
同一に描画**される（デモはすべて `rps export png` で検証済み）：
番号バッジ（`heading_badge`）・カード（`card`）・左アクセントバー（`accent_bar`）・
本文中コールアウト箱（`::: note`）・チャート（` ```chart `）・図の回り込み
（`float`）・はみ出し（`scale>1`）・縦整列（`valign`）・ギャラリー個別トリミング
（`image_crops`）・白背景の擬似透過（`transparent_white`）・キャプション色・
ヘッダ `text_color`/`affiliation_inline`．

**デスクトップ専用の「変換アクション」**（EMF/WMF→PNG，白の真アルファ化，
ギャラリー余白の自動トリム）は出力ファイル／フィールドを書き出すだけなので，
その**結果はどこでも描画される**（変換操作のみデスクトップ）．

## CLI との差（Phase 3 で一部解消）

- **Graphviz（.dot/.gv・```dot）は CLI でも変換される**（`packages/cli/src/convert.ts`，
  @viz-js/viz・Node）．
- **Mermaid 図・PDF 貼り込み図は依存が重いため CLI ではプレースホルダのまま**
  （デスクトップアプリの WebView 内 pdfjs-dist / mermaid で変換）．
- **EMF/WMF 図はデスクトップ（Rust + System.Drawing）でのみ PNG 変換**できる．
  CLI / VS Code はプレースホルダ表示（node ローダが image/x-emf として読み込み，
  レンダラが「PNG に変換してください」を表示）．

- 影響を受ける形式: CLI 経由の PDF / PNG / HTML / SVG（Mermaid / PDF / EMF のみ）
- 影響を受けない図: PNG / JPEG / SVG 画像，CSV 簡易表，Graphviz（CLI でも変換），
  ` ```chart ` ネイティブチャート（追加依存なしで全形式 OK）
- 回避策: Mermaid/PDF/EMF を含むポスターはデスクトップアプリからエクスポートする

## 推奨ワークフロー

1. 作業中の確認: デスクトップのプレビュー，または `rps preview --watch`
2. 共有・レビュー用: HTML（1 ファイルで送れる）
3. 提出・印刷: **PDF**（デスクトップから出力し，実寸を印刷プレビューで確認）
4. 二次利用が必要なときのみ: PPTX（近似である旨を共有相手に伝える）
