// Optional auto-numbering (opt-in via layout.number_sections / number_figures):
//   - section numbers: 1, 2, 3 … on top-level block headings (nested 1.1)
//   - figure numbers: renumber existing 図N / 表N / Figure N / Table N caption
//     labels sequentially by declaration order (figures and tables counted
//     separately), preserving the author's word and language.
// Both are display-only; the source files are never rewritten.

import type { Block, PosterDoc } from "./types";
import { computeBands } from "./layout";

function numberableBlock(b: Block): boolean {
  return (
    b.type !== "figure" &&
    !b.id.includes("__") &&
    b.visible !== false &&
    !!b.title &&
    !!b.title.trim()
  );
}

/** blockId -> section number string ("1", "2", … ; children "1.1"). */
export function sectionNumbers(doc: PosterDoc): Map<string, string> {
  const map = new Map<string, string>();
  const top: Block[] = [];
  for (const band of computeBands(doc)) {
    if (band.kind === "wide") top.push(band.block);
    else for (const col of band.columns) for (const b of col.blocks) top.push(b);
  }
  let n = 0;
  for (const b of top) {
    if (!numberableBlock(b)) continue;
    n += 1;
    map.set(b.id, String(n));
    const kids = (b.children ?? [])
      .filter(numberableBlock)
      .slice()
      .sort((a, c) => a.order - c.order);
    kids.forEach((c, i) => map.set(c.id, `${n}.${i + 1}`));
  }
  return map;
}

const FIG_LABEL_RE = /^(\s*)(図|表|Figure|Fig\.?|Table|Tab\.?)(\s*)([0-9０-９]+)/i;

/** figureId -> renumbered caption (only for captions with a detectable label). */
export function numberedCaptions(doc: PosterDoc): Map<string, string> {
  const map = new Map<string, string>();
  let figN = 0;
  let tabN = 0;
  for (const f of doc.figures) {
    const cap = f.caption ?? "";
    const m = FIG_LABEL_RE.exec(cap);
    if (!m) continue;
    const isTable = /^(表|table|tab)/i.test(m[2]);
    const n = isTable ? (tabN += 1) : (figN += 1);
    map.set(f.id, cap.replace(m[0], `${m[1]}${m[2]}${m[3]}${n}`));
  }
  return map;
}
