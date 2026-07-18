# @rps/renderer

Renders a [Research Poster Studio](https://github.com/YukiInoueNakata/research_poster_studio)
poster project to self-contained HTML, SVG, or Marp Markdown.

The same renderer backs the desktop preview, the `rps` CLI, and the VS Code extension,
so what you see in the GUI is what gets exported. Output is laid out in millimetres at
real poster size; figures, CSV tables, Graphviz diagrams, charts, QR codes, and LaTeX
math (via MathJax) are inlined as data URIs so a single HTML/SVG file stands alone.

## Install

```bash
npm install @rps/renderer
```

React 19 is a peer dependency (used by the shared `PosterCanvas` component).

## Usage

```ts
import { loadPosterProjectFs } from "@rps/core/node";
import { buildHtml, buildSvg, buildMarp } from "@rps/renderer";

const project = await loadPosterProjectFs("./my-poster");

const html = buildHtml(project);   // self-contained HTML (print-ready @page)
const svg  = buildSvg(project);    // single SVG
const marp = buildMarp(project);   // Marp Markdown
```

Pass the resulting HTML to [`@rps/exporter`](https://www.npmjs.com/package/@rps/exporter)
to produce PDF or PNG.

## License

Apache-2.0.
