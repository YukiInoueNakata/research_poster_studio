import { describe, expect, it } from "vitest";
import {
  columnOrder,
  resolveColumn,
  validatePosterYaml,
  parseBibtex,
  parseCombinedMarkdown,
  serializeCombinedMarkdown,
  readingDistanceM,
} from "@rps/core";

describe("columns", () => {
  it("names columns by count", () => {
    expect(columnOrder(2)).toEqual(["left", "right"]);
    expect(columnOrder(3)).toEqual(["left", "center", "right"]);
    expect(columnOrder(4)).toEqual(["col1", "col2", "col3", "col4"]);
  });
  it("resolves aliases and out-of-range columns", () => {
    const c4 = columnOrder(4);
    expect(resolveColumn("right", c4)).toBe("col4");
    expect(resolveColumn("col9", c4)).toBe("col1");
    expect(resolveColumn("center", columnOrder(2))).toBe("left");
  });
});

describe("validatePosterYaml", () => {
  it("accepts a minimal poster", () => {
    const r = validatePosterYaml("project:\n  title: T\n  poster_size: A0\n  orientation: portrait\nblocks:\n  - { id: a, title: A, column: left, order: 1 }\n");
    expect(r.errors).toEqual([]);
  });
  it("rejects a malformed document", () => {
    // must report errors, not throw (the CLI exited 1 only because it crashed)
    const r = validatePosterYaml("project:\n  title: 1\nblocks: not-an-array\n");
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.startsWith("blocks"))).toBe(true);
  });
});

describe("BibTeX", () => {
  it("turns LaTeX quotes into typographic quotes", () => {
    const r = parseBibtex("@article{q, title = {The ``wall of text'' and `single' quotes in O'Brien}}");
    expect(r.entries[0].fields.title).toBe("The “wall of text” and ‘single’ quotes in O’Brien");
  });
  it("strips protection braces and simple escapes", () => {
    const r = parseBibtex("@book{b, title = {{R}esearch \\& {P}osters}, year = 2026}");
    expect(r.entries[0].fields.title).toBe("Research & Posters");
    expect(r.entries[0].fields.year).toBe("2026");
  });
});

describe("single-file content.md", () => {
  const ser = (md: string) =>
    serializeCombinedMarkdown(
      parseCombinedMarkdown(md).map((s) => ({ id: s.id, title: s.title, level: s.level, body: s.body })),
    );
  it("round-trips untitled and empty sections", () => {
    const md = "# {#notice}\n\nNote.\n\n# 1 Intro {#intro}\n\n## {#intro_l}\n\n- item\n";
    expect(ser(md)).toBe(md);
  });
  it("is idempotent", () => {
    const once = ser("#  {#a}\n\n\nText\n\n\n## B {#b}\n");
    expect(ser(once)).toBe(once);
    expect(once.startsWith("# {#a}")).toBe(true);
  });
});

describe("reading distance", () => {
  it("uses 22' (comfortable) and 16' (legible) on a 0.7 em cap height", () => {
    const { comfortable, legible } = readingDistanceM(28);
    const capM = ((28 * 25.4) / 72) * 0.7 / 1000;
    expect(comfortable).toBeCloseTo(capM / Math.tan((22 / 60) * (Math.PI / 180)), 6);
    expect(legible).toBeCloseTo(capM / Math.tan((16 / 60) * (Math.PI / 180)), 6);
    expect(legible).toBeGreaterThan(comfortable);
  });
});
