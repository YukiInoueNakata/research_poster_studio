// 4+ カラム対応の smoke test（node scripts/smoke-columns.mjs で実行）
import { columnOrder, resolveColumn, layoutBlocks, MAX_COLUMNS, normalizeDoc, docWarnings } from "../packages/core/dist/index.js";

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`OK   ${name}`); }
  else { fail++; console.log(`NG   ${name}\n  got:  ${g}\n  want: ${w}`); }
};

// columnOrder
eq("columnOrder(1)", columnOrder(1), ["left"]);
eq("columnOrder(2)", columnOrder(2), ["left", "right"]);
eq("columnOrder(3)", columnOrder(3), ["left", "center", "right"]);
eq("columnOrder(4)", columnOrder(4), ["col1", "col2", "col3", "col4"]);
eq("columnOrder(6)", columnOrder(6), ["col1", "col2", "col3", "col4", "col5", "col6"]);

// resolveColumn aliases
const c4 = columnOrder(4);
eq("resolve left@4", resolveColumn("left", c4), "col1");
eq("resolve right@4", resolveColumn("right", c4), "col4");
eq("resolve center@4", resolveColumn("center", c4), "col2");
eq("resolve col3@4", resolveColumn("col3", c4), "col3");
eq("resolve col9@4 (out of range)", resolveColumn("col9", c4), "col1");
const c3 = columnOrder(3);
eq("resolve col2@3", resolveColumn("col2", c3), "center");
eq("resolve col1@3", resolveColumn("col1", c3), "left");
const c2 = columnOrder(2);
eq("resolve center@2", resolveColumn("center", c2), "left");
eq("resolve col2@2", resolveColumn("col2", c2), "right");

// layoutBlocks: 4 columns + wide flush + alias
const mk = (id, column, order) => ({ id, type: "text", title: id, column, order, height: { mode: "auto" } });
const bands = layoutBlocks(
  [mk("a", "col1", 1), mk("b", "col2", 2), mk("c", "col4", 3), mk("w", "wide", 4), mk("d", "right", 5)],
  4,
);
eq("bands kinds", bands.map((b) => b.kind), ["columns", "wide", "columns"]);
eq("band0 col1", bands[0].columns[0].blocks.map((b) => b.id), ["a"]);
eq("band0 col3 empty", bands[0].columns[2].blocks.length, 0);
eq("band0 col4", bands[0].columns[3].blocks.map((b) => b.id), ["c"]);
eq("band2 right-alias -> col4", bands[2].columns[3].blocks.map((b) => b.id), ["d"]);
eq("band widthFr sum", bands[0].columns.reduce((s, c) => s + c.widthFr, 0), 1);

// normalizeDoc: count clamp
const doc9 = normalizeDoc({ project: { title: "t" }, layout: { columns: { count: 9 } }, blocks: [] });
eq("normalize clamp 9 -> MAX", doc9.layout.columns.count, MAX_COLUMNS);
const doc0 = normalizeDoc({ project: { title: "t" }, layout: { columns: { count: 0 } }, blocks: [] });
eq("normalize clamp 0 -> 1", doc0.layout.columns.count, 1);

// warnings: unknown column
const docW = normalizeDoc({
  project: { title: "t" },
  layout: { columns: { count: 4 } },
  blocks: [
    { id: "x", title: "x", column: "col5", order: 1, height: { mode: "auto" } },
    { id: "y", title: "y", column: "col4", order: 2, height: { mode: "auto" } },
    { id: "z", title: "z", column: "center", order: 3, height: { mode: "auto" } },
  ],
});
const wcodes = docWarnings(docW).filter((w) => w.code === "unknown-column");
eq("unknown-column count", wcodes.length, 1);
eq("unknown-column target", wcodes[0]?.blockId, "x");

console.log(`\n${pass} OK / ${fail} NG`);
process.exit(fail ? 1 : 0);
