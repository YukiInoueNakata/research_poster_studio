# tests/fixtures — 機能検証用プロジェクト

smoke テスト（`scripts/smoke-cli.mjs`）と手動受け入れテスト（`docs/acceptance-tests.md`）が使う
ポスタープロジェクト．利用者向けのデモではない（標準デモは `examples/` の猫の手ポスター）．
内容はすべて架空で，引用文献のうち `example2024` は表示確認用のダミー（DOI も架空）．
*Poster projects used by the smoke and acceptance tests. Not user-facing demos (those live in
`examples/`). All content is fictional; `example2024` is a dummy reference with a fake DOI.*

| プロジェクト | 検証する機能 |
|---|---|
| `sample-full/` | 全部入り：図表・ギャラリー・ロゴ・数式・Markdown 装飾・BibTeX 引用（apa7 / jpa / カスタム `styles/my-style.yaml`） |
| `sample-nested/` | 入れ子ブロック（`child_layout`・子ブロックのバンドレイアウト） |
| `sample-combined/` | 本文を単一 `content.md` にまとめる方式（`content_file:` と `source: content.md#id`） |

テストの期待値はこれらの内容に依存するので，変更したら `npm run smoke` を通すこと．
