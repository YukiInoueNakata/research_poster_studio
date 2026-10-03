// Marp Markdown export (single large slide). Useful as an editable text
// fallback and for the agent/ workflow.

import type { Block, PosterProject } from "@rps/core";
import { posterSizeMm, prepareCitations, sectionNumbers } from "@rps/core";
import { computeBands, computeChildBands } from "@rps/core";

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
  const parts: string[] = [head];
  const inReadingOrder = (bands: ReturnType<typeof computeBands>) =>
    bands.flatMap((band) => (band.kind === "wide" ? [band.block] : band.columns.flatMap((c) => c.blocks)));

  // Walk blocks depth-first in reading order. In nested layouts (e.g. the
  // demos) most of the text lives in child blocks, so they must be included.
  const emit = (b: Block, depth: number) => {
    if (b.visible === false) return;
    const title = oneLine(b.title ?? "").trim();
    const num = secNums.get(b.id);
    if (title || num) parts.push(`\n${"#".repeat(Math.min(2 + depth, 6))} ${num ? `${num} ` : ""}${title}\n`);
    if (b.type === "figure" && b.figure_id) {
      const fig = doc.figures.find((f) => f.id === b.figure_id);
      // the .marp.md goes to exports/ by default, so point back to the project root
      if (fig) {
        const caption = oneLine(fig.caption ?? "");
        // diagram/data sources (Graphviz, Mermaid, CSV, PDF, EMF…) are not images Marp can show
        parts.push(
          /\.(png|jpe?g|gif|webp|svg)$/i.test(fig.path)
            ? `![${caption}](../${fig.path})`
            : `*${caption}*\n\n<!-- figure source: ${fig.path} (not rendered in Marp) -->`,
        );
      }
    } else if (b.references_list && cite.active) {
      parts.push(cite.referenceItems.join("\n\n"));
    } else {
      const md = (project.content[b.id] ?? "").trim();
      if (md) parts.push(cite.active ? cite.expand(md) : md);
    }
    parts.push("");
    if (b.children?.length) for (const c of inReadingOrder(computeChildBands(b))) emit(c, depth + 1);
  };
  for (const b of inReadingOrder(computeBands(doc))) emit(b, 0);
  return parts.join("\n");
}
