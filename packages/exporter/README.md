# @rps/exporter

Converts the self-contained poster HTML produced by
[`@rps/renderer`](https://www.npmjs.com/package/@rps/renderer) into PDF or PNG, using
Playwright's bundled Chromium. Part of
[Research Poster Studio](https://github.com/YukiInoueNakata/research_poster_studio).

Page geometry comes from the poster's own `@page` rule, so A0 / A1 posters are written
at true physical size rather than scaled to a letter-sized sheet.

## Install

```bash
npm install @rps/exporter
npx playwright install chromium     # once, to fetch the browser binary
```

## Usage

```ts
import { loadPosterProjectFs } from "@rps/core/node";
import { buildHtml } from "@rps/renderer";
import { htmlToPdf, htmlToPng } from "@rps/exporter";

const project = await loadPosterProjectFs("./my-poster");
const html = buildHtml(project);

await htmlToPdf(html, "./exports/poster.pdf");
await htmlToPng(html, "./exports/poster.png");
```

## License

Apache-2.0.
