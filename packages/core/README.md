# @rps/core

Schema, validation, and layout calculation for
[Research Poster Studio](https://github.com/YukiInoueNakata/research_poster_studio).

This package is DOM-free and runs anywhere Node.js does. It is the shared foundation
used by the desktop app, the `rps` CLI, and the VS Code extension: parse a poster
project, validate it against the Zod schema, and compute the column / block layout in
millimetres.

## Install

```bash
npm install @rps/core
```

## Usage

Validate `poster.yaml` text and compute its layout:

```ts
import { readFile } from "node:fs/promises";
import { validatePosterYaml, calculateLayout } from "@rps/core";

const text = await readFile("./my-poster/poster.yaml", "utf8");
const { ok, errors, warnings, doc } = validatePosterYaml(text);
if (!ok) console.error(errors);
for (const w of warnings) console.warn(w);

const { paper, bands } = calculateLayout(doc);   // paper size and bands, in mm
console.log(paper);                              // { w: 841, h: 1189 }
```

Load a whole project directory (`poster.yaml` + `content/` + `figures/`) from disk:

```ts
import { loadPosterProjectFs } from "@rps/core/node";

const project = await loadPosterProjectFs("./my-poster");
```

Two entry points are provided: `@rps/core` (pure, no file system) and `@rps/core/node`
(loads a project directory from disk).

## License

Apache-2.0.
