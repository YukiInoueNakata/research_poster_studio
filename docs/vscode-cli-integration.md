# VS Code + CLI Integration

## Goal

Let researchers (and Claude Code / Codex in the VS Code terminal) edit
`poster.yaml` and `content/*.md`, see an A0/A1 preview, validate, and export —
without leaving VS Code, and with Git diffs as the source of truth.

```text
Edit poster.yaml / content/*.md in VS Code
  ↓  (Claude Code / Codex assist in the terminal)
rps validate           # schema + readability/overflow warnings
rps preview --watch    # live browser preview, auto-reload on save
rps export pdf         # A0/A1 PDF via Playwright
  ↓
git diff / commit
```

## CLI (`rps`) — available now

| command | purpose |
|---|---|
| `rps init --template <name>` | scaffold a project (quantitative / qualitative / multi-study / method-tool) |
| `rps validate` | Zod schema check + readability / caption / duplicate-id warnings; non-zero exit on errors |
| `rps info` | size / columns / blocks / figures / bands / warning count |
| `rps preview [--watch] [--port N]` | local server; `--watch` reloads the browser on source changes |
| `rps export pdf\|png\|svg\|html\|marp` | write to `exports/` (pdf/png need `npx playwright install chromium`) |

> Figure conversion in the CLI (Phase 3): **Graphviz (.dot/.gv and ```dot) is
> now converted** by the CLI (`packages/cli/src/convert.ts`, @viz-js/viz in
> Node). **Mermaid, embedded PDF, and EMF/WMF remain placeholders** in CLI / VS
> Code (heavy deps / Windows-only GDI); export or convert those from the desktop
> app. PNG / JPEG / SVG images, CSV tables, and native ` ```chart ` charts are
> unaffected. PPTX export is desktop-only. See `docs/export-matrix.md`.
>
> Everything else renders identically in the VS Code preview and CLI export
> because they share `@rps/renderer`: number badges, cards, accent bars,
> `::: note` callouts, charts, figure float / oversize / valign, gallery
> per-image crop, `transparent_white`, header `text_color` / `affiliation_inline`.
> Desktop-only *actions* (EMF→PNG, white knockout, gallery auto-trim) just write
> files/fields, so their output renders everywhere.

## VS Code extension (minimal implementation)

The extension contains **no layout engine**. It bundles `@rps/core`
(validation), `@rps/renderer` (HTML for a Webview preview), and delegates export
/ create to the `rps` CLI / desktop app. Source: `packages/vscode-extension/`.

Implemented commands:

```text
Research Poster: Open Preview     -> Webview rendering buildHtml(project) (refresh on save)
Research Poster: Validate         -> @rps/core validatePosterYaml -> diagnostics (Problems)
Research Poster: Show Warnings     -> re-validate + focus the Problems panel
Research Poster: Export PDF / PNG  -> delegate to `rps export …` / desktop (no Playwright)
Research Poster: Create New Poster -> delegate to `rps init …` / desktop wizard
```

Build: `npm run build -w @rps/vscode-extension` (tsup -> dist/extension.js).
Run via F5 (Extension Development Host). Validate runs on open/save; preview
shows Mermaid / embedded-PDF / EMF as placeholders in-editor (Graphviz is
converted; use the desktop app for the rest). All other renderer features
(badges, cards, callouts, charts, figure float/crop, …) preview correctly.

### Role split

- **CLI** = headless operations (validate / preview server / export). Scriptable,
  CI-friendly, and what an LLM in the terminal drives.
- **VS Code extension** = in-editor UX (Webview preview, Problems panel,
  commands). Delegates heavy work to the CLI / shared packages.
- **Desktop app (Tauri)** = full GUI editor (inspector, drag-to-resize panes,
  multi-select). Same core + renderer as the others.

### LLM terminal workflow

1. The agent edits `poster.yaml` / `content/*.md` only.
2. Runs `rps validate` after edits; fixes warnings.
3. Optionally `rps preview --watch` while iterating with the user.
4. `rps export pdf` only after validation passes.
5. Relies on `git diff` for review; never edits files under `exports/` or
   `backups/`.

## Git

Sources are tracked (`poster.yaml`, `references.bib`, `content/*`, `figures/*`,
`themes/*`, `skills/*`, `docs/*`). Generated
`exports/*.{pdf,png,html,svg,pptx,marp.md}` and automatic per-save `backups/`
are gitignored. See `.gitignore` and the「生成物とバックアップの扱い」section
in the README (restore procedure included).
