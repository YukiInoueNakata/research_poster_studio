# @rps/vscode-extension

VS Code extension for Research Poster Studio. It has **no layout engine of its
own** — it bundles `@rps/core` (validation) and `@rps/renderer` (HTML) and
points at the `rps` CLI / desktop app for export and project creation.

## Features

- **Validate** (`rps.validate`): runs `validatePosterYaml` on the active
  `poster.yaml` and reports schema errors + readability/figure warnings as
  editor **diagnostics** (Problems panel). Runs automatically on open / save.
- **Open Preview** (`rps.openPreview`): a side webview that renders the poster
  HTML (`@rps/renderer`) and **refreshes on save**. Graphviz / Mermaid figures
  show placeholders in-preview; use `rps export` or the desktop app for
  full-fidelity output.
- **Show Warnings** (`rps.showWarnings`): re-validate and focus the Problems panel.
- **Export PDF / PNG**, **Create New Poster**: delegate to the CLI
  (`rps export …`, `rps init …`) or the desktop app (the extension does not
  bundle Playwright).

## Build / run

```bash
npm run build -w @rps/vscode-extension   # bundle to dist/extension.js (tsup)
```

Open this folder in VS Code and press **F5** to launch an Extension Development
Host, then open a project's `poster.yaml`. Packaging for the Marketplace
(`vsce package`) is a follow-up.
