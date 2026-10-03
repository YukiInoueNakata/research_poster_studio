# sample-cat-paws-en — standard demo (English)

The standard demo poster (A0 portrait, IMRAD). The study is **fictional**: it tests the
Japanese proverb "I'd even borrow a cat's paws" (猫の手も借りたい, *so busy I'd take any help*)
literally, and says so on the poster. Only the three references (Cohen 1988; Faulkes 2021;
Faulkes 2023) are real. The Japanese version is [`../sample-cat-paws-ja`](../sample-cat-paws-ja).

標準デモ（英語版）．研究内容は架空（ことわざ「猫の手も借りたい」を字義どおりに検証する体裁）で，
ポスター内にも明記している．実在の文献は 3 件のみ．日本語版は `../sample-cat-paws-ja`．

| File | Contents |
|---|---|
| `poster.yaml` | Page setup (A0 portrait, 2 columns, blocks, figure placement) / 版面設定 |
| `content.md` | Body text in a single file, one `{#id}` section per block / 本文（単一ファイル方式） |
| `references.bib` | References; only the cited entries appear in the auto-generated list / 引用文献 |
| `figures/` | SVG figures (text outlined, so no font dependency) and `procedure.dot` (Graphviz) / 図 |
| `scripts/make_figures.py` | Regenerates the SVG figures from the fictional data for both languages / 図の生成 |

```bash
npm run rps -- validate examples/sample-cat-paws-en    # schema + overflow check
npm run rps -- export pdf examples/sample-cat-paws-en  # → exports/poster.pdf
uv run scripts/make_figures.py                         # (in this folder) English figures
uv run scripts/make_figures.py --lang ja --out ../sample-cat-paws-ja/figures
```

The numbers in `scripts/make_figures.py` must match the tables in both `content.md` files.
/ 図の数値は両版の `content.md` の表と一致させる．
