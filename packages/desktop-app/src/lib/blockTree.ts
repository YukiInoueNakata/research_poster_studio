// Helpers for working with the (possibly nested) block tree in the desktop app.

import type { Block } from "@rps/core";
import { flattenBlocks } from "@rps/core";

/** Map every block in the tree (depth-first), preserving nesting. */
export function mapBlockTree(blocks: Block[], fn: (b: Block) => Block): Block[] {
  return blocks.map((b) => {
    const nb = fn(b);
    return nb.children?.length ? { ...nb, children: mapBlockTree(nb.children, fn) } : nb;
  });
}

/** Find a block anywhere in the tree by id. */
export function findBlock(blocks: Block[], id: string): Block | null {
  return flattenBlocks(blocks).find((b) => b.id === id) ?? null;
}

/** The array that directly contains the block with `id` (its sibling list). */
export function findContainingArray(blocks: Block[], id: string): Block[] | null {
  if (blocks.some((b) => b.id === id)) return blocks;
  for (const b of blocks) {
    if (b.children?.length) {
      const r = findContainingArray(b.children, id);
      if (r) return r;
    }
  }
  return null;
}

/** Depth-first id order (sorted by `order` at each level) — for shift-range select. */
export function treeOrderIds(blocks: Block[]): string[] {
  const out: string[] = [];
  for (const b of blocks.slice().sort((a, c) => a.order - c.order)) {
    out.push(b.id);
    if (b.children?.length) out.push(...treeOrderIds(b.children));
  }
  return out;
}

/** Remove a block (and its subtree) from the tree. */
export function removeBlockFromTree(blocks: Block[], id: string): Block[] {
  return blocks
    .filter((b) => b.id !== id)
    .map((b) => (b.children?.length ? { ...b, children: removeBlockFromTree(b.children, id) } : b));
}

/** A fresh, unused block id generator over the whole tree. */
export function makeIdFactory(blocks: Block[], base = "c"): () => string {
  const taken = new Set(flattenBlocks(blocks).map((b) => b.id));
  let n = 1;
  return () => {
    while (taken.has(`${base}${n}`)) n++;
    const id = `${base}${n}`;
    taken.add(id);
    return id;
  };
}
