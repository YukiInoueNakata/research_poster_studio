// Copy the poster templates into dist/ so the published npm package is
// self-contained. The templates are authored under
// skills/research-poster-studio/templates (the Agent Skill reads them there);
// this keeps that single source of truth and mirrors it at build time.
//
// Fails loudly: a silent miss here ships a CLI whose `rps init` cannot work.

import { cp, mkdir, readdir } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, "../../../skills/research-poster-studio/templates");
const dest = path.resolve(here, "../dist/templates");

let names;
try {
  names = (await readdir(src)).filter((f) => f.endsWith(".yaml"));
} catch (e) {
  console.error(`copy-templates: cannot read template source ${src}`);
  console.error(e.message);
  process.exit(1);
}

if (names.length === 0) {
  console.error(`copy-templates: no *.yaml templates found in ${src}`);
  process.exit(1);
}

await mkdir(dest, { recursive: true });
for (const name of names) {
  await cp(path.join(src, name), path.join(dest, name));
}
console.log(`copy-templates: ${names.length} template(s) -> dist/templates (${names.join(", ")})`);
