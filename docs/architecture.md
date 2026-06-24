# Architecture

Research Poster Studio is an **npm-workspaces monorepo**. Layout, validation,
and rendering live in shared packages so the desktop app, the `rps` CLI, and a
future VS Code extension all behave identically.

```text
packages/
├─ core/             @rps/core      schema (Zod), validation, layout (DOM-free; Node+browser)
├─ renderer/         @rps/renderer  poster.yaml + content -> React markup / HTML / SVG / Marp
├─ exporter/         @rps/exporter  HTML -> PDF / PNG via Playwright (Chromium)
├─ cli/              @rps/cli       `rps` (init / validate / preview / export / info)
├─ desktop-app/      @rps/desktop-app  Tauri v2 + React GUI (preview/inspector)
└─ vscode-extension/ @rps/vscode-extension  validate (diagnostics) / preview webview / warnings
```

## Dependency direction

```text
desktop-app ─┐
cli ─────────┼─► @rps/renderer ─► @rps/core
exporter ◄───┘                    (no DOM, no Electron/Tauri)
```

- **@rps/core** has no DOM/Electron/Tauri dependency. It exposes the poster type
  model, `validatePoster(Yaml)`, `calculateLayout`, `computeBands`, and the
  unit/normalize helpers. A separate `@rps/core/node` entry adds a filesystem
  project loader for the CLI.
- **@rps/renderer** owns the single `PosterCanvas` React component plus
  `renderPosterToHtml` / `buildSvg` / `buildMarp`. The desktop preview and every
  HTML/SVG export use the same renderer (Markdown sanitized with
  isomorphic-dompurify so it works in Node and the browser).
- **@rps/exporter** drives headless Chromium. The renderer HTML declares
  `@page { size: <poster size in mm> }` (A0/A1/A2, inch presets, or custom), so
  `preferCSSPageSize` yields an exactly sized PDF.
- **desktop-app** calls core + renderer; it does not contain its own layout or
  rendering logic. Desktop-only modules are limited to `src/export/`
  (print-dialog PDF, PNG, pptxgenjs PPTX — PPTX is generated from measured
  preview DOM rects) and `src/lib/` glue (file I/O via Tauri, figure
  conversion). PPTX/SVG/Marp/HTML come from the desktop using renderer +
  pptxgenjs. The CLI uses Playwright for fully automated PDF/PNG.

> Figure conversion: the desktop WebView converts PDF / Mermaid / Graphviz
> (`src/lib/figureConvert.ts` with pdfjs-dist / mermaid / viz.js). The CLI
> (`packages/cli/src/convert.ts`) now converts **Graphviz** (.dot/.gv and
> ```dot) in Node via @viz-js/viz; **Mermaid and PDF remain placeholders** in
> CLI exports (heavy deps). See `docs/export-matrix.md`.

## Build & run

```bash
npm install
npm run build:libs        # build @rps/core, @rps/renderer, @rps/exporter (dist)
npm run dev               # build:libs + tauri dev (desktop)
npm run watch:libs        # tsup --watch for all libs (run alongside tauri dev for HMR of libs)
npm run rps -- <cmd>      # run the CLI from the repo root
```

The desktop consumes the libraries' built `dist/` (their `exports` point to
`dist`). For an inner-loop on library code, run `npm run watch:libs` so changes
rebuild and Vite/Tauri picks them up.

PDF/PNG export needs the browser once: `npx playwright install chromium`.
