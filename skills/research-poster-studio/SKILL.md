# Research Poster Studio Skill

## Purpose

Use this skill to create, revise, and validate research poster projects for
Research Poster Studio. The project is **file-based**: edit the source text
files, never the generated PDF/PNG/SVG/PPTX.

## Project Files

- `poster.yaml` — main poster structure, layout, theme, blocks, figures, export
- `content/*.md` — block body text (Markdown + limited inline HTML)
- `figures/*` — figures and tables (PNG / JPEG / SVG; also PDF / CSV /
  Mermaid `.mmd` / Graphviz `.dot`/`.gv`, converted at render time). EMF/WMF
  must be converted to PNG in the desktop app (button in the figure inspector);
  elsewhere they show a placeholder.
- `references.bib` — optional BibTeX references. Pandoc-style citations in the
  body: `[@key]`, `[@a; @b]`, `[-@key]` (year only), inline `@key`, plus
  extended notation `[@key, p. 5]` / `[@key, pp. 4-6]` / `[see @key, for a review]`.
  Citation style is `references.style`: `apa7` (author–year, EN), `jpa`
  (Shinrigaku Kenkyu, JA), or **`ieee`** (numbered: `[@key]`→`[1]`, `[@a; @b; @c]`→
  `[1]–[3]`, reference list in citation order with `[n]` prefixes — STEM/Vancouver)
- `themes/*.theme.yaml` — optional theme overrides
- `agent/review.md` — review notes and warnings
- `exports/` and `backups/` — generated / auto-backup. **Never edit these.**

## Core Rules

1. Preserve the research structure.
2. Do not use pixel-level positioning. Use block-level layout settings only.
3. Use the height modes `auto`, `fixed`, `flex`, `locked`.
4. Do not shrink body text below the minimum readable size (body ≥ 18pt,
   references ≥ 12pt for A0).
5. Use role-based colors (`accent`, `warning`, `muted`, `heading`, `text`,
   `background`) before custom hex colors.
6. Keep figure paths relative to the project root.
7. Do not overwrite user-written content without preserving a diff.
8. When resolving overflow: **first shorten text, then adjust height, then font
   size** (only within the allowed minimum).
9. Use full-width (`column: wide`) blocks only when a figure or the discussion
   needs emphasis.
10. Every figure needs a `caption` and a unique `id`.

## Layout Model (how poster.yaml renders)

- The body is a vertical sequence of **bands**. A run of column blocks forms a
  multi-column band; a `column: wide` block flushes the current band and spans
  full width. Blocks are ordered globally by `order`.
- Columns: `count` (1-6) + `ratio` (e.g. `[0.52, 0.48]`; normalized to its sum).
  1-3 columns = `left`/`center`/`right`; 4-6 columns = `col1`..`colN` (left to
  right). `left`/`center`/`right` always resolve as first/middle/last aliases
  at any count. `wide` = full width. An out-of-range `colK` falls back to the
  first column with an `unknown-column` warning.
- Height modes per block:
  - `auto` — natural content height (clamp with `min`/`max`)
  - `fixed` — exact `height.value` (e.g. `160mm`)
  - `flex` — grows to fill leftover space by `height.weight`
  - `locked` — pinned like fixed, excluded from auto rebalancing
- Block style (`block.style`) supports: `body_font_size`, `heading_font_size`,
  `text_color`, `heading_color`, `italic`, `background`, `border` (bool),
  `border_color`, `border_width`, `padding_mm`, `line_height`,
  `paragraph_spacing_mm`. Title-bar styling: `heading_background` (filled bar),
  `heading_bold`/`heading_italic`/`heading_underline`/`heading_align`,
  `heading_accent_bar` (left bar on/off) + `heading_bar_color`,
  `heading_width_mode` (`full`/`fit`/`custom`) + `heading_width`. Decorations:
  - `heading_badge: { background, color, shape: square|rounded|circle }` — render
    the leading number (auto section number or the title's leading `1`/`②` token)
    as a badge box on the title bar.
  - `card: true` — border + soft shadow with the title bar bleeding flush to the
    card's top/side edges and the body inset (research-poster card look).
  - `accent_bar: { color, width }` — a left accent bar on the whole block
    (callout look without a full border).
- Reusable style presets (A2): define `theme.block_styles: { <name>: { …BlockStyle } }`
  and reference from a block with `style_preset: "<name>"`. The preset merges UNDER
  the block's inline `style` (inline wins). Define each section colour once instead
  of repeating `heading_background` on every block of a multi-colour poster.
- Header (`header`): `background`, `title_color`, `accent_color` (subtitle),
  `text_color` (authors/affiliation/conference, e.g. white on a colored band),
  `affiliation_inline: true` (show "Name (Affiliation)" on the authors line),
  per-element font size/align, `logos`. Role colors still win over custom hex.
  `badges: [{ text, position: left|center|right, background, color }]` adds
  coloured text pills to the header row (e.g. "Spotlight Paper", "Best Poster") (B1).

## Content Markdown

Standard Markdown plus a small inline HTML set:

```markdown
本研究では，**文章プライム**の有効性を検討した．
<u>刺激呈示時間</u>は今後の課題である．
<span class="role-warning">解釈には注意が必要である．</span>
<span class="role-accent">主要な知見</span>
```

Allowed inline tags: `strong/b`, `em/i`, `u`, `s/del`, `mark`, `sub`, `sup`,
`span` (with `class="role-accent|role-warning|role-muted"` or inline `color`).

### Callout boxes (Pandoc-style fenced divs)

Wrap body text in a tinted box with a left accent bar (the in-flow callout that
the structured layout can't otherwise express):

```markdown
::: note
**Key point** — flows inside the body, can contain lists / **bold**.
:::
```

Class names map to colors: `note`/`accent` (accent), `warning` (warning),
`muted`, `heading`. Use these instead of trying to fragment a block into tiny
sub-blocks for a highlight box.

Add a label after the type to get a **bordered box with a tab chip** (N14, for
the "Important / Challenge 1 / Main Idea / Purpose / Suggestion" boxes common in
STEM posters):

```markdown
::: warning Challenge 1
The robot needs to classify objects fine-grained.
:::
```

`theorem` / `boxed` render the label as a **full-width title bar** (amsthm-style
theorem boxes). Optional colours via `{type key=value …}`: `title_bg`,
`title_color`, `bg` (box background), `border` (A4):

```markdown
::: {theorem title_bg=#1c3d5a title_color=#ffffff bg=#eef2f7} Theorem 1 (MPC simulation)
For depth $d$ and width $w$, a transformer simulates …
:::
```

### Charts (native, dependency-free SVG)

A `chart` fenced block draws a bar / line chart from simple data (theme
accent/text colors, works in every export including the CLI):

```markdown
` ` `chart
type: bar          # bar | line (default bar)
title: Comments per term
2019: 12
2020: 18
2021: 9
` ` `
```

Other fenced blocks: `csv` (table), `mermaid`, `dot`/`graphviz` (diagrams —
desktop / CLI render; see Export Targets), `qr` (QR code: first line is the
URL/text; optional `ecc: L|M|Q|H`, `dark:`, `light:` lines — renders a crisp
self-contained SVG, e.g. a paper/demo link in the header) (N18).

Markdown table cells: wrap a cell in `==…==` to highlight it (tinted box +
accent border) — e.g. `| ==**0.79**== |` for a best value in a results table (N15).

### Math (LaTeX)

Write LaTeX directly in body text. Inline with `$…$` or `\(…\)`, display
(block, centered) with `$$…$$` or `\[…\]`:

```markdown
間接効果は $a \times b$，Sobel 検定は $z = \dfrac{ab}{\sqrt{b^2 s_a^2 + a^2 s_b^2}}$．

$$ Y = c'X + bM + \varepsilon_Y $$
```

Rendered to self-contained SVG (MathJax) so it embeds with no font dependency
and looks identical in preview / HTML / SVG / PDF / CLI (PPTX rasterizes it).
A `$` not meant as math (currency) is left alone when it follows Pandoc rules
(no space just inside the `$…$`, closing `$` not before a digit); escape a
literal dollar as `\$`. A formula that fails to parse falls back to an inline
error marker instead of breaking the block.

### Single-file content (`content.md`)

Two storage modes (both load; backward compatible):
- **Per-block** (legacy): `source: content/<id>.md`, one file per block.
- **Single file**: set `project.content_file: content.md` and reference sections
  via `source: "content.md#<id>"`. The file uses Pandoc-style headings:
  `#`=top-level block, `##`=child block, `###`+ = in-body heading; the heading
  text is the block title and `{#id}` is the stable key.
  ```markdown
  # 背景 {#background}
  …
  # 結果 {#results}
  ## 研究1 {#study1}
  ```
  GUI-created projects default to this mode. Keep `{#id}` so renames/reorders stay linked.

### List auto-numbering (Pandoc fancy_lists + extensions)

Markers are renumbered by position (the typed number is ignored):
`(1)` / `1)` / `a.` / `a)` / `i.` / `I.`; `#.` = outline (nested → `1`/`1.1`/`1.1.1`);
extensions ① (circled), ア/あ (kana, needs a delimiter), 一 (kanji, needs a delimiter).
Plain `1.` stays a normal `<ol>`. Code fences / prose are never converted.

## Figures (`figures:` in poster.yaml)

Each figure: `id`, `path` (relative), `caption`, `placement`
(`inside-block`/`column`/`full-width`), `block` (owning block id), `scale`
(fraction of the container width — **`scale > 1` lets it bleed past the block**),
`align` (left/center/right), `valign` (top/middle/bottom — when the block is
taller), `crop`.

- **Float / text wrap**: `float: left|right` — the figure sits at the side of its
  owning block and the body text wraps around it (flow-based, not absolute).
- **Gallery**: `images: [..]` + `gallery_columns: N` share one caption.
  Per-image crop via `image_crops: { "figures/x.png": { enabled, top, right,
  bottom, left } }` (trim whitespace on selected images; the desktop figure
  inspector can auto-trim).
- **White background**: `style.transparent_white: true` multiply-blends a white
  image into a light page (cheap, render-only). For true alpha on any
  background, use the desktop "knock out white" button (bakes a transparent PNG).
- **Caption**: `style.caption_position` (top/bottom/left/right),
  `style.caption_font_size`, `style.caption_color`, `style.border`.

Desktop-only ACTIONS (EMF→PNG, white knockout, gallery auto-trim) write normal
files / fields, so their OUTPUT renders everywhere; only the conversion step
needs the desktop app.

## Common Tasks

### Create a new poster
1. Identify type: quantitative / qualitative / mixed-methods / multi-study /
   method-tool / activity-report.
2. Copy the matching `templates/*.yaml` to `poster.yaml`.
3. Create `content/*.md` for each block `source`.
4. Place figures under `figures/` and declare them in `figures:`.
5. Validate (load in the app or check against `schema/poster.schema.json`).
6. Summarize remaining warnings.

### Revise layout
1. Read `poster.yaml`.
2. Modify block-level layout (column, order, height mode, ratio). No pixel
   positioning.
3. Re-check overflow and readability.

### Fix overflow
1. Read the warning log (app bottom panel or `agent/review.md`).
2. Shorten redundant text in the overflowing block's `content/*.md`.
3. Increase block height (`min`/`fixed`/`flex weight`) if space exists.
4. Reduce font size only within the allowed minimum.
5. If still overflowing, recommend a layout change (move block, add column).

### Improve readability
Check: body font size, heading hierarchy, contrast, line height, block
density, figure size, caption size, references size.

## Export Targets

`exports/` is generated. Targets: PDF (via print, exact-size @page), PNG,
self-contained HTML, SVG (foreignObject), PPTX (pptxgenjs, approximate),
Marp Markdown. Never hand-edit files under `exports/`. Recommend **PDF** for
submission; fidelity per format is documented in `docs/export-matrix.md`.

Note: the CLI does not convert embedded PDF / Mermaid / Graphviz figures
(placeholders); export such posters from the desktop app.

## CLI Workflow

The project ships a `rps` CLI (see `docs/vscode-cli-integration.md`).

- Run `rps explain [--json]` FIRST for a structured summary (reading order,
  columns, figures, content-file mode, numbering, warnings).
- Run `rps validate` after editing `poster.yaml` or the body markdown.
- Run `rps info` for a quick summary (size / blocks / figures / warnings).
- Run `rps preview --watch` when iterating with the user (live browser reload).
- Run `rps export pdf` only after validation passes
  (PDF/PNG need `npx playwright install chromium`).

## VS Code Workflow

The user may work in VS Code with Claude Code or Codex in the terminal. In that
case:

- edit source files only (`poster.yaml`, `content/*.md`, `themes/*.yaml`)
- rely on Git diff for review
- validate frequently (`rps validate`)
- do not modify anything under `exports/`

## Output

When editing files, report:
- changed files
- reason for each change
- remaining warnings
- next recommended action
