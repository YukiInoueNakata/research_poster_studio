// (merge / build helpers that operate on the block tree live at the bottom.)
// Single-file body content (案B): all block bodies live in one Markdown file
// (e.g. content.md) instead of one file per block. Sections are delimited by
// ATX headings carrying a Pandoc-style id attribute:
//
//   # 背景 {#background}        -> top-level block "background"
//   ## 研究1 {#study1}          -> child block "study1"
//   ### 補足                    -> stays in the body (not a section boundary)
//
// A block references its section through `source: "content.md#background"`.
// Only `#` and `##` headings open sections; `###`+ are kept verbatim in the
// body. Fenced code blocks are skipped so `# comment` inside ``` is not
// mistaken for a heading. This follows Markdown / Pandoc conventions
// (header_attributes) so the file stays a normal Markdown document.

export interface CombinedSection {
  /** id from `{#id}`, or undefined when the heading had no attribute */
  id: string | undefined;
  /** heading text (without the `{#id}` attribute) = block title */
  title: string;
  /** heading level (1 = `#`, 2 = `##`) */
  level: number;
  /** body markdown under the heading (… up to the next `#`/`##`) */
  body: string;
}

/** A `source` like "content.md#background" -> { file, anchor }. */
export function splitContentAnchor(
  source: string | undefined,
): { file: string; anchor: string } | null {
  if (!source) return null;
  const i = source.indexOf("#");
  if (i <= 0 || i === source.length - 1) return null;
  return { file: source.slice(0, i), anchor: source.slice(i + 1) };
}

/** Build a `content.md#anchor` source string. */
export function contentAnchorSource(file: string, anchor: string): string {
  return `${file}#${anchor}`;
}

/** Extract a Pandoc-style `{#id .class key=val}` id from a heading line. */
function extractHeadingId(text: string): { title: string; id: string | undefined } {
  const m = /\{([^}]*)\}\s*$/.exec(text);
  if (!m) return { title: text.trim(), id: undefined };
  const attr = m[1];
  const idMatch = /#([^\s.}]+)/.exec(attr);
  const title = text.slice(0, m.index).trim();
  return { title, id: idMatch ? idMatch[1] : undefined };
}

/**
 * Parse a combined content file into ordered sections. Only `#` and `##`
 * headings open a section; deeper headings and all other lines accumulate into
 * the current section's body. Content before the first heading is ignored
 * (the serializer always emits a leading heading).
 */
export function parseCombinedMarkdown(md: string): CombinedSection[] {
  const lines = (md ?? "").split(/\r?\n/);
  const sections: CombinedSection[] = [];
  let current: CombinedSection | null = null;
  let bodyLines: string[] = [];
  let fence: string | null = null;

  const flush = () => {
    if (current) {
      current.body = bodyLines.join("\n").replace(/^\n+/, "").replace(/\s+$/, "");
      sections.push(current);
    }
    bodyLines = [];
  };

  for (const line of lines) {
    // track fenced code blocks (``` or ~~~) so headings inside are ignored
    const fenceMatch = /^[ \t]*(```+|~~~+)/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1][0].repeat(3);
      if (fence == null) fence = marker;
      else if (line.trimStart().startsWith(fence)) fence = null;
      if (current) bodyLines.push(line);
      continue;
    }
    if (fence == null) {
      const h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h && h[1].length <= 2) {
        flush();
        const { title, id } = extractHeadingId(h[2]);
        current = { id, title, level: h[1].length, body: "" };
        continue;
      }
    }
    if (current) bodyLines.push(line);
  }
  flush();
  return sections;
}

/** anchor (id) -> { title, body, level } for quick lookup during load. */
export function indexSections(
  sections: CombinedSection[],
): Map<string, { title: string; body: string; level: number }> {
  const map = new Map<string, { title: string; body: string; level: number }>();
  for (const s of sections) {
    if (s.id && !map.has(s.id)) {
      map.set(s.id, { title: s.title, body: s.body, level: s.level });
    }
  }
  return map;
}

/** Format one heading line: `## Title {#id}`. */
export function formatHeading(level: number, title: string, id: string): string {
  const hashes = "#".repeat(Math.max(1, Math.min(2, level)));
  const t = (title ?? "").trim();
  return `${hashes} ${t} {#${id}}`;
}

/** A unit to serialize: a heading + its body, in document order. */
export interface CombinedEntry {
  id: string;
  title: string;
  level: number;
  body: string;
}

/** Serialize ordered entries into a single content.md string. */
export function serializeCombinedMarkdown(entries: CombinedEntry[]): string {
  const parts: string[] = [];
  for (const e of entries) {
    const body = (e.body ?? "").replace(/\s+$/, "");
    parts.push(formatHeading(e.level, e.title, e.id) + "\n\n" + body + "\n");
  }
  return parts.join("\n");
}

/** Slugify a title into a stable, unique id (keeps Unicode letters/digits). */
export function slugify(title: string, taken: Set<string>): string {
  let base = (title ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  if (!base) base = "section";
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  taken.add(id);
  return id;
}

// ---------------------------------------------------------------------------
// Merge (load) / build (save) helpers operating on the block tree.
// ---------------------------------------------------------------------------

import type { Block, PosterDoc } from "./types";
import { flattenBlocks } from "./layout";

const isSynthChildId = (id: string) => /__text$/.test(id) || /__fig_/.test(id);

function mapTitles(blocks: Block[], titleById: Map<string, string>): Block[] {
  return blocks.map((b) => {
    const t = titleById.get(b.id);
    const nb = t != null && t !== "" ? { ...b, title: t } : b;
    return nb.children?.length ? { ...nb, children: mapTitles(nb.children, titleById) } : nb;
  });
}

function makeTextBlock(id: string, title: string, order: number, source: string): Block {
  return {
    id,
    type: "text",
    title,
    source,
    column: "left",
    order,
    visible: true,
    height: { mode: "auto", weight: 1 },
    style: {},
    figures: [],
    overflow: { action: "warn" },
  };
}

/**
 * Single-file load: given the normalized doc and the raw text of each combined
 * file referenced by a `file#anchor` source, returns the content map for the
 * anchored blocks (title-synced doc; unknown md sections appended as new
 * top-level text blocks). Legacy per-block `content/<id>.md` sources are NOT
 * handled here — the loader reads those itself.
 */
export function mergeCombinedContent(
  doc: PosterDoc,
  fileTexts: Record<string, string>,
): { doc: PosterDoc; content: Record<string, string> } {
  const indexByFile = new Map<string, ReturnType<typeof indexSections>>();
  for (const [file, text] of Object.entries(fileTexts)) {
    indexByFile.set(file, indexSections(parseCombinedMarkdown(text)));
  }

  const content: Record<string, string> = {};
  const claimed = new Set<string>();
  for (const b of flattenBlocks(doc.blocks)) {
    const split = splitContentAnchor(b.source);
    if (!split) continue;
    const idx = indexByFile.get(split.file);
    if (!idx) continue;
    claimed.add(`${split.file}#${split.anchor}`);
    content[b.id] = idx.get(split.anchor)?.body ?? "";
  }

  // sync titles: a section whose id equals a block id overrides that title
  const titleById = new Map<string, string>();
  for (const idx of indexByFile.values()) {
    for (const [anchor, sec] of idx) titleById.set(anchor, sec.title);
  }
  const newBlocks = mapTitles(doc.blocks, titleById);

  // unknown sections (no block claims them) -> append as new top-level blocks
  const existingIds = new Set(flattenBlocks(newBlocks).map((b) => b.id));
  let maxOrder = newBlocks.reduce((m, b) => Math.max(m, b.order), 0);
  for (const [file, idx] of indexByFile) {
    for (const [anchor, sec] of idx) {
      if (claimed.has(`${file}#${anchor}`) || existingIds.has(anchor)) continue;
      newBlocks.push(makeTextBlock(anchor, sec.title, ++maxOrder, contentAnchorSource(file, anchor)));
      content[anchor] = sec.body;
      existingIds.add(anchor);
    }
  }

  return { doc: { ...doc, blocks: newBlocks }, content };
}

function anchorInfo(b: Block): { file: string; anchor: string; bodyId: string } | null {
  const direct = splitContentAnchor(b.source);
  if (direct) return { file: direct.file, anchor: direct.anchor, bodyId: b.id };
  // figure container: the body lives in a synthesized `<id>__text` child
  const tc = (b.children ?? []).find((c) => c.id === `${b.id}__text`);
  if (tc) {
    const s = splitContentAnchor(tc.source);
    if (s) return { file: s.file, anchor: s.anchor, bodyId: tc.id };
  }
  return null;
}

/**
 * Single-file save: serialize block bodies back into combined Markdown files.
 * Returns a map of filename -> file text. Walks the author block tree
 * (`#` top-level, `##` children); figure / synthesized children are skipped and
 * reconstructed from poster.yaml on load.
 */
export function buildCombinedContent(
  doc: PosterDoc,
  content: Record<string, string>,
): Record<string, string> {
  const byFile = new Map<string, CombinedEntry[]>();
  const walk = (blocks: Block[], level: number) => {
    for (const b of blocks) {
      const info = anchorInfo(b);
      if (info) {
        const arr = byFile.get(info.file) ?? [];
        arr.push({ id: info.anchor, title: b.title, level, body: content[info.bodyId] ?? "" });
        byFile.set(info.file, arr);
      }
      const authorChildren = (b.children ?? []).filter((c) => !isSynthChildId(c.id));
      if (authorChildren.length) walk(authorChildren, Math.min(2, level + 1));
    }
  };
  walk(doc.blocks, 1);

  const out: Record<string, string> = {};
  for (const [file, entries] of byFile) out[file] = serializeCombinedMarkdown(entries);
  return out;
}

/** The set of distinct combined files referenced by the doc's block sources. */
export function combinedFilesOf(doc: PosterDoc): string[] {
  const files = new Set<string>();
  for (const b of flattenBlocks(doc.blocks)) {
    const s = splitContentAnchor(b.source);
    if (s) files.add(s.file);
  }
  return [...files];
}
