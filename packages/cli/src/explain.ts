// `rps explain` — a structured, Agent-friendly summary of a poster project:
// reading order of blocks, columns, figures, content-file mode, numbering, and
// warnings. Helps an LLM understand a poster's structure before editing.

import type { Block, PosterDoc, PosterProject } from "@rps/core";
import {
  computeBands,
  computeChildBands,
  sectionNumbers,
  validatePosterYaml,
} from "@rps/core";

export interface ExplainBlock {
  num?: string;
  id: string;
  title: string;
  type: string;
  column: string;
  order: number;
  height: string;
  source?: string;
  figures: string[];
  children?: ExplainBlock[];
}

export interface Explain {
  title: string;
  subtitle?: string;
  posterSize: string;
  orientation: string;
  columns: number;
  syncMode: string;
  contentMode: "single-file" | "per-block";
  contentFile?: string;
  numbering: { sections: boolean; figures: boolean };
  readingOrder: ExplainBlock[];
  figures: { id: string; path: string; caption?: string; placement: string; owner?: string }[];
  warnings: { errors: number; warn: number; info: number; items: { level: string; code: string; message: string }[] };
}

// synthesized children (figure / text containers) use `__` in their id;
// author block ids are slugs and never contain a double underscore.
const isSynth = (id: string) => id.includes("__");

function orderedTop(doc: PosterDoc): Block[] {
  const out: Block[] = [];
  for (const band of computeBands(doc)) {
    if (band.kind === "wide") out.push(band.block);
    else for (const col of band.columns) for (const b of col.blocks) out.push(b);
  }
  return out;
}

export function buildExplain(project: PosterProject, yamlText: string): Explain {
  const { doc } = project;
  const cols = doc.layout.columns;
  const secNums = doc.layout.number_sections ? sectionNumbers(doc) : new Map<string, string>();

  const top = orderedTop(doc);

  const summarize = (b: Block): ExplainBlock => {
    const figs = doc.figures.filter((f) => f.block === b.id || (b.figures ?? []).includes(f.id)).map((f) => f.id);
    const authorChildren = (b.children ?? []).filter((c) => !isSynth(c.id));
    let children: ExplainBlock[] | undefined;
    if (authorChildren.length) {
      const ordered: Block[] = [];
      for (const band of computeChildBands({ ...b, children: authorChildren })) {
        if (band.kind === "wide") ordered.push(band.block);
        else for (const col of band.columns) for (const cb of col.blocks) ordered.push(cb);
      }
      children = ordered.map(summarize);
    }
    return {
      num: secNums.get(b.id),
      id: b.id,
      title: b.title,
      type: b.type,
      column: b.column,
      order: b.order,
      height: b.height.mode,
      source: b.source,
      figures: figs,
      children,
    };
  };

  const res = validatePosterYaml(yamlText);
  const ownerOf = (block?: string) => (block?.includes("__") ? block.split("__")[0] : block);

  return {
    title: doc.project.title,
    subtitle: doc.project.subtitle,
    posterSize: doc.project.poster_size,
    orientation: doc.project.orientation,
    columns: cols.count,
    syncMode: cols.sync_mode,
    contentMode: doc.project.content_file ? "single-file" : "per-block",
    contentFile: doc.project.content_file,
    numbering: { sections: !!doc.layout.number_sections, figures: !!doc.layout.number_figures },
    readingOrder: top.filter((b) => !isSynth(b.id)).map(summarize),
    figures: doc.figures.map((f) => ({
      id: f.id,
      path: f.path,
      caption: f.caption,
      placement: f.placement ?? "inside-block",
      owner: ownerOf(f.block),
    })),
    warnings: {
      errors: res.errors.length + res.warnings.filter((w) => w.level === "error").length,
      warn: res.warnings.filter((w) => w.level === "warn").length,
      info: res.warnings.filter((w) => w.level === "info").length,
      items: res.warnings.map((w) => ({ level: w.level, code: w.code, message: w.message })),
    },
  };
}

export function formatExplainText(x: Explain): string {
  const lines: string[] = [];
  lines.push(`${x.title}${x.subtitle ? ` — ${x.subtitle}` : ""}`);
  lines.push(`  ${x.posterSize} ${x.orientation} · ${x.columns} columns (${x.syncMode})`);
  lines.push(`  content: ${x.contentMode}${x.contentFile ? ` (${x.contentFile})` : ""} · numbering: sections=${x.numbering.sections} figures=${x.numbering.figures}`);
  lines.push("");
  lines.push("Reading order (blocks):");
  const walk = (bs: ExplainBlock[], depth: number) => {
    for (const b of bs) {
      const pad = "  ".repeat(depth + 1);
      const n = b.num ? `${b.num} ` : "";
      const figs = b.figures.length ? ` figs=[${b.figures.join(",")}]` : "";
      const src = b.source ? ` <${b.source}>` : "";
      lines.push(`${pad}- ${n}${b.id} "${b.title}" [${b.type}/${b.column}/${b.height}]${figs}${src}`);
      if (b.children?.length) walk(b.children, depth + 1);
    }
  };
  walk(x.readingOrder, 0);
  lines.push("");
  lines.push("Figures:");
  for (const f of x.figures) {
    lines.push(`  - ${f.id}: ${f.path} (${f.placement}${f.owner ? ` @${f.owner}` : ""})${f.caption ? ` "${f.caption}"` : ""}`);
  }
  lines.push("");
  lines.push(`Warnings: ${x.warnings.errors} errors, ${x.warnings.warn} warn, ${x.warnings.info} info`);
  for (const w of x.warnings.items) lines.push(`  [${w.level}] ${w.code}: ${w.message}`);
  return lines.join("\n");
}
