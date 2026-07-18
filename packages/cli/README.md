# @rps/cli

`rps` — the command line for [Research Poster Studio](https://github.com/YukiInoueNakata/research_poster_studio),
a structured layout editor for academic research posters. A poster is a plain-text
project (`poster.yaml` + Markdown + figures); this CLI validates it, summarises its
structure for LLM agents, and exports it to PDF / PNG / HTML / SVG / Marp.

## Install

```bash
npm install -g @rps/cli
```

## Usage

```bash
rps init     <dir> --template quantitative   # scaffold a new poster project
rps validate <project-dir>                   # schema + layout warnings
rps explain  <project-dir> [--json]          # structure summary (for agents)
rps info     <project-dir>                   # paper size, columns, block list
rps export   pdf <project-dir>               # write to <project-dir>/exports/
rps preview  <project-dir>                   # watch and re-render on change
```

Formats for `export`: `pdf`, `png`, `html`, `svg`, `marp`.

## Requirements

- Node.js >= 18
- PDF / PNG export additionally needs a Chromium build:
  `npx playwright install chromium`. HTML / SVG / Marp need no extra dependencies.

## Notes

Mermaid diagrams and embedded PDF figures are rendered by the desktop app only; the
CLI leaves them as placeholders. Graphviz, CSV tables, and images are converted.

## License

Apache-2.0. See the [repository](https://github.com/YukiInoueNakata/research_poster_studio)
for full documentation (`docs/design.md`) and sample projects (`examples/`).
