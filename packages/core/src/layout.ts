// Layout engine.
//
// The poster body is a vertical sequence of "bands". A band is either a
// multi-column band (a run of column blocks laid out side by side) or a
// full-width "wide" band (a single block spanning all columns). Wide blocks
// flush the current column band, matching the typical poster flow where a
// discussion / figure breaks the columns.
//
// Heights are handled by the browser's flexbox (auto = content, fixed/locked =
// pinned, flex = grow by weight). Overflow is detected by measurement after
// render (lib/warnings.ts) — we never auto-shrink below the readable minimum.

import type { Block, ColumnName, PosterDoc } from "./types";

export interface ColumnSlot {
  name: ColumnName;
  /** fractional width (sums to 1 across the band) */
  widthFr: number;
  blocks: Block[];
}

export type Band =
  | { kind: "columns"; key: string; columns: ColumnSlot[] }
  | { kind: "wide"; key: string; block: Block };

/** hard cap for the column count (GUI offers up to this) */
export const MAX_COLUMNS = 6;

export function columnOrder(count: number): ColumnName[] {
  if (count <= 1) return ["left"];
  if (count === 2) return ["left", "right"];
  if (count === 3) return ["left", "center", "right"];
  return Array.from({ length: count }, (_, i) => `col${i + 1}` as ColumnName);
}

/**
 * Resolve a block's column name against the actual column slots.
 * "left" / "center" / "right" act as aliases for first / middle / last when
 * the slot list uses generic names (4+ columns), and "colK" maps onto the
 * named slots for 1-3 columns. Unresolvable names fall back to the first
 * column (a static warning flags out-of-range colK; see warnings.ts).
 */
export function resolveColumn(name: string, cols: ColumnName[]): ColumnName {
  if (cols.includes(name as ColumnName)) return name as ColumnName;
  if (name === "left") return cols[0];
  if (name === "right") return cols[cols.length - 1];
  if (name === "center") return cols[Math.floor((cols.length - 1) / 2)];
  const m = /^col([1-9]\d*)$/.exec(name);
  if (m) {
    const i = Number(m[1]) - 1;
    if (i < cols.length) return cols[i];
  }
  return cols[0];
}

function normalizedRatio(count: number, ratio: number[], mode: string): number[] {
  if (mode === "equal" || ratio.length !== count) {
    return Array(count).fill(1 / count);
  }
  const sum = ratio.reduce((a, b) => a + b, 0) || 1;
  return ratio.map((r) => r / sum);
}

/**
 * Lay a flat list of blocks into bands for a given column configuration.
 * Reused for the poster body (doc columns) and for nested child blocks inside
 * a parent block (default 2 columns + wide).
 */
export function layoutBlocks(
  blocks: Block[],
  count: number,
  ratio: number[] = [],
  widthMode = "equal",
): Band[] {
  const cols = columnOrder(count);
  const r = normalizedRatio(count, ratio, widthMode);
  const widthByCol: Record<string, number> = {};
  cols.forEach((c, i) => (widthByCol[c] = r[i] ?? 1 / cols.length));

  const visible = blocks
    .filter((b) => b.visible !== false)
    .slice()
    .sort((a, b) => a.order - b.order);

  const bands: Band[] = [];
  let current: Record<string, Block[]> | null = null;
  let bandIndex = 0;

  const flush = () => {
    if (!current) return;
    const columns: ColumnSlot[] = cols.map((name) => ({
      name,
      widthFr: widthByCol[name],
      blocks: current![name] ?? [],
    }));
    if (columns.some((c) => c.blocks.length > 0)) {
      bands.push({ kind: "columns", key: `band-${bandIndex++}`, columns });
    }
    current = null;
  };

  for (const block of visible) {
    if (block.column === "wide") {
      flush();
      bands.push({ kind: "wide", key: `wide-${bandIndex++}`, block });
      continue;
    }
    if (!current) current = {};
    const col = resolveColumn(block.column, cols);
    (current[col] ??= []).push(block);
  }
  flush();

  return bands;
}

/** Top-level poster body bands (uses the document's column configuration). */
export function computeBands(doc: PosterDoc): Band[] {
  return layoutBlocks(
    doc.blocks,
    doc.layout.columns.count,
    doc.layout.columns.ratio,
    doc.layout.columns.width_mode,
  );
}

/** Bands for a block's child blocks (default 2 columns + wide). */
export function computeChildBands(block: Block): Band[] {
  return layoutBlocks(block.children ?? [], 2);
}

/** Walk all blocks including nested children (depth-first). */
export function flattenBlocks(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (const b of blocks) {
    out.push(b);
    if (b.children?.length) out.push(...flattenBlocks(b.children));
  }
  return out;
}
