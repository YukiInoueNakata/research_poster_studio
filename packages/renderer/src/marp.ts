// Marp Markdown export (single large slide). Useful as an editable text
// fallback and for the agent/ workflow.

import type { PosterProject } from "@rps/core";
import { posterSizeMm, prepareCitations, sectionNumbers } from "@rps/core";
import { computeBands } from "@rps/core";

export function buildMarp(project: PosterProject): string {
  const { doc } = project;
  const size = posterSizeMm(doc.project);
  // markdown headings are single-line; fold manual title line breaks into spaces
  const oneLine = (s: string) => s.replace(/\s*\n\s*/g, " ");
  const head = [
    "---",
    "marp: true",
    `size: ${size.w}mm ${size.h}mm`,
    "paginate: false",
    `theme: default`,
    // LaTeX math ($…$ / $$…$$) in block bodies is passed through verbatim and
    // rendered by Marp's own math support.
    "math: katex",
    "---",
    "",
    `# ${oneLine(doc.project.title)}`,
    doc.project.subtitle ? `\n## ${oneLine(doc.project.subtitle)}` : "",
    "",
    doc.project.authors.map((a) => a.name).join("，"),
    "",
  ].join("\n");

  const cite = prepareCitations(project);
  const secNums = doc.layout.number_sections ? sectionNumbers(doc) : new Map<string, string>();
  const bands = computeBands(doc);
  const parts: string[] = [head];
  for (const band of bands) {
    const blocks = band.kind === "wide" ? [band.block] : band.columns.flatMap((c) => c.blocks);
    for (const b of blocks) {
      const num = secNums.get(b.id);
      parts.push(`\n## ${num ? `${num} ` : ""}${oneLine(b.title)}\n`);
      if (b.references_list && cite.active) {
        parts.push(cite.referenceItems.join("\n\n"));
      } else {
        const md = (project.content[b.id] ?? "").trim();
        parts.push(cite.active ? cite.expand(md) : md);
      }
      parts.push("");
    }
  }
  return parts.join("\n");
}
