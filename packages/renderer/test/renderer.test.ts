import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { loadPosterProjectFs } from "@rps/core/node";
import type { Block } from "@rps/core";
import { buildMarkdown } from "@rps/renderer";
import { heightStyle } from "../src/style";

const demo = fileURLToPath(new URL("../../../examples/sample-cat-paws-en", import.meta.url));
const block = (height: Block["height"]): Block => ({ id: "b", title: "", column: "left", order: 1, height }) as Block;

describe("heightStyle", () => {
  it("flex keeps the content height and shares the rest by weight", () => {
    // a 0 basis made flex blocks collapse above a full-width block
    expect(heightStyle(block({ mode: "flex", weight: 2 })).flex).toBe("2 1 auto");
  });
  it("auto does not grow or shrink", () => {
    expect(heightStyle(block({ mode: "auto" })).flex).toBe("0 0 auto");
  });
  it("fixed uses the given height", () => {
    const s = heightStyle(block({ mode: "fixed", value: "120mm" }));
    expect(s.height).toBe("120mm");
    expect(s.flex).toBe("0 0 auto");
  });
});

describe("Markdown export", () => {
  it("includes child-block text and figures of nested posters", async () => {
    const project = await loadPosterProjectFs(demo);
    const md = buildMarkdown(project);
    expect(md).not.toMatch(/^size:/m); // Marp ignores mm sizes; not emitted
    expect(md).toContain("### 1-1. Background");
    expect(md).toContain('"wall of text"');
    expect(md).toMatch(/!\[Figure 3\.[^\]]*\]\(\.\.\/figures\/fig1_time\.svg\)/);
    // diagram sources are noted, not linked as images
    expect(md).toContain("<!-- figure source: figures/procedure.dot");
  });
});

describe("fontStack", () => {
  it("adds sans fallbacks so a missing font does not fall back to the browser's serif", async () => {
    const { fontStack } = await import("../src/posterCss");
    expect(fontStack("Noto Sans JP")).toMatch(/^Noto Sans JP, .*sans-serif$/);
    expect(fontStack("Yu Mincho")).toMatch(/serif$/);
    expect(fontStack("Yu Mincho")).not.toMatch(/sans-serif$/);
    expect(fontStack("Arial, sans-serif")).toBe("Arial, sans-serif");
  });
});
