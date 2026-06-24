# sample-combined — 単一 content.md の最小例

本文をブロック別ファイルではなく **1 枚の `content.md`** で管理する方式の最小サンプル．

- `poster.yaml` … `project.content_file: content.md` を設定し，各ブロックは
  `source: content.md#<id>` でセクションを参照する．
- `content.md` … `# 見出し {#id}` がブロック（見出しテキスト＝タイトル），
  `###` 以降は本文中の見出し（構造化しない）．`(1)(1)(1)` は (1)(2)(3) に自動連番．

確認:

```bash
rps explain examples/sample-combined        # content: single-file (content.md)
rps validate examples/sample-combined        # 0 errors
rps export html examples/sample-combined     # exports/poster.html
```

per-block 方式（`content/<id>.md`）との相互変換はデスクトップアプリの全体設定
「本文ファイル」から行える．
