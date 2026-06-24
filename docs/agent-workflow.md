# Agent Workflow

How Claude Code / Codex should edit a Research Poster Studio project.

## Basic Workflow

1. Run `rps explain` first — a structured summary (reading order, columns,
   figures, content-file mode, numbering, warnings). Then read `poster.yaml`.
2. Read the body content: either `content/*.md` (per-block) **or** a single
   `content.md` (when `project.content_file` is set — see below).
3. Modify **source files only** (`poster.yaml`, body markdown,
   `references.bib`, `styles/*.yaml`).
4. Do **not** edit generated files under `exports/` (PDF / PNG / HTML / SVG /
   PPTX / Marp) and do **not** edit or delete anything under `backups/`
   (automatic per-save backups, 10 generations — the user's safety net).
5. Run `rps validate` (from the project directory).
6. Fix errors and warnings where possible.
7. Run `rps export pdf` only when explicitly requested and after validation.
8. Summarize changed files and remaining warnings.

## Rules

- Prefer block-level layout settings (column, order, height mode). Do not use
  pixel-level absolute positioning.
- Do not shrink body text below the readable minimum (body ≥ 18pt, references
  ≥ 12pt for A0).
- Use role-based colors (`accent` / `warning` / `muted` / `heading`) before
  custom hex.
- Keep figures under `figures/` and keep paths relative.
- Use full-width (`column: wide`) blocks only when a figure or the discussion
  needs emphasis.
- For overflow: shorten text first, then adjust height, then font size (within
  the allowed minimum); only then change the layout.
- Every figure needs a unique `id` and a `caption`.

## Body content: per-block vs single file

Two interchangeable layouts (both load; pick based on what the project uses):

- **Per-block** (legacy): each block has `source: content/<id>.md`; edit that
  one file as a whole.
- **Single file**: `project.content_file: content.md` is set and blocks use
  `source: "content.md#<id>"`. All bodies live in one `content.md`, split by
  Pandoc-style headings:
  ```markdown
  # 背景 {#background}      ← top-level block (heading text = block title)
  本文…
  # 結果 {#results}
  ## 研究1 {#study1}        ← child (nested) block
  本文…
  ### 補足                  ← in-body heading (NOT a block)
  ```
  Edit the relevant `# … {#id}` section. Keep the `{#id}` stable on rename
  (the id is the link to `poster.yaml`). Adding a new `# Heading {#newid}`
  section creates a new top-level block on load.

## Auto-numbering (display-only; opt-in)

- `layout.number_sections: true` → block headings get `1, 2, …` (nested `1.1`).
- `layout.number_figures: true` → existing `図N / 表N / Figure N / Table N`
  caption labels are renumbered by declaration order.
- In body markdown, list markers auto-renumber by position: `(1)` / `1)` /
  `a.` / `i.` / `#.` (outline `1.1.1`), plus `①` / `ア` / `一`. Plain `1.` is a
  normal ordered list. Just write items; the typed number is ignored.

## Decorations & figure features (opt-in; render in all exports + VS Code)

- **Callout box** in body markdown: `::: note` … `:::` (also `warning` / `muted`
  / `heading`) → a tinted box with a left accent bar.
- **Chart** in body markdown: a ` ```chart ` fence (`type: bar|line`, `title:`,
  then `label: value` lines) → native SVG, no deps.
- **Block style**: `heading_badge` (number badge on the title bar), `card`
  (border+shadow card with a flush title bar), `accent_bar` (left bar),
  `heading_background`/`heading_width_mode`.
- **Figure**: `float: left|right` (text wrap), `valign`, `scale>1` (bleed),
  `style.transparent_white`, `style.caption_color`, `image_crops` (per-image
  gallery crop).
- **Header**: `text_color`, `affiliation_inline`.
- Desktop-only conversions (EMF→PNG, white knockout, gallery auto-trim) write
  normal files/fields; their output renders everywhere. EMF/WMF show a
  placeholder in CLI / VS Code.

See `skills/research-poster-studio/SKILL.md` for syntax and
`packages/core/src/types.ts` for the authoritative field list.

## Safe Editing Units / What to Avoid

Safe edits (preferred granularity):

- Block-level fields in `poster.yaml`: `column`, `order`, `height`, `style`,
  `title`, `source`.
- Whole-file edits of `content/*.md`, or one `# … {#id}` section in `content.md`
  (the body text of one block).
- Adding/removing entries in `figures:` (with `id` + `caption` + relative path).
- `references.bib` entries (BibTeX) and `[@key]` citations in the body markdown.

Avoid (these are derived or app-managed; editing them by hand breaks sync):

- Blocks whose id starts with `__fig_` or contains `__fig_` (e.g.
  `methods__fig_img1`) — they are **generated** from `figures:` placement;
  edit the figure entry instead.
- Turning `references_list: true` blocks into hand-written lists — the list is
  auto-generated from `references.bib` when citations are active.
- Nested block structures (`children` / band layout inside a block) beyond
  changing text and simple style — restructure via the GUI when possible.
- Gallery internals — edit the gallery's image list in `figures:`, not derived
  layout.
- Anything under `exports/` or `backups/`.

> CLI caveat: `rps export` converts **Graphviz** (.dot/.gv and ```dot) in Node,
> but **Mermaid and embedded PDF stay as placeholders** — export those from the
> desktop app. Fidelity per format: `docs/export-matrix.md`.

## Commands

```bash
rps explain           # structured summary for an Agent (--json for machine use)
rps validate          # after any edit to poster.yaml / content
rps info              # quick summary (size, blocks, figures, warnings)
rps preview --watch   # iterate live with the user
rps export pdf        # only after validate passes (needs Playwright chromium)
```

See `skills/research-poster-studio/SKILL.md` for the full editing skill and
`schema/poster.schema.json` for the structure.
