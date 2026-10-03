# sample-cat-paws-ja — 標準デモ（日本語版）

英語版 [`../sample-cat-paws-en`](../sample-cat-paws-en) の日本語版．構成・数値・図は英語版と同じで，
文言と引用スタイル（`jpa`）だけが異なる．研究内容は架空であり，ポスター内にもその旨を明記している．
*Japanese version of the standard demo; the study is fictional.*

| ファイル | 内容 |
|---|---|
| `poster.yaml` | 版面設定（英語版から題名・著者・見出し・キャプション・引用スタイルを差し替え） |
| `content.md` | 本文（日本語・単一ファイル方式） |
| `references.bib` | 英語版と同じ（実在 3 件のみ） |
| `figures/*.svg` | 英語版のスクリプトで生成: `uv run ../sample-cat-paws-en/scripts/make_figures.py --lang ja --out figures` |
| `figures/procedure.dot` | 手続き図（Graphviz・日本語ラベル） |

数値を変えるときは，英語版の `scripts/make_figures.py` と両方の `content.md` の表を合わせて直す．
