// CLI smoke test — examples/ の各サンプルに対して rps validate / info / export を
// 実行し，終了コードと生成物の中身を検査する（Playwright 不要の範囲のみ）．
//   node scripts/smoke-cli.mjs
// PDF / PNG export は chromium が必要なため対象外（docs/acceptance-tests.md 参照）．

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLES = {
  poster: path.join(ROOT, "examples", "sample-poster"),
  nested: path.join(ROOT, "examples", "sample-nested"),
  full: path.join(ROOT, "examples", "sample-full"),
  combined: path.join(ROOT, "examples", "sample-combined"),
};

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`OK   ${name}`);
  } else {
    fail++;
    console.log(`FAIL ${name}${detail ? ` -- ${detail}` : ""}`);
  }
}

function rps(...args) {
  const r = spawnSync("npm", ["run", "rps", "--silent", "--", ...args], {
    cwd: ROOT,
    shell: true,
    encoding: "utf8",
    timeout: 120_000,
  });
  return { code: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

const count = (s, re) => (s.match(new RegExp(re, "g")) ?? []).length;

// ---- validate: 3 サンプルすべて成功（exit 0） ------------------------------
for (const [name, dir] of Object.entries(SAMPLES)) {
  const r = rps("validate", dir);
  check(`validate ${name} exits 0`, r.code === 0, `code=${r.code}`);
}

// ---- validate: 壊れた poster.yaml は exit 1 --------------------------------
{
  const tmp = mkdtempSync(path.join(tmpdir(), "rps-smoke-"));
  writeFileSync(
    path.join(tmp, "poster.yaml"),
    "project:\n  title: 1\nblocks: not-an-array\n",
    "utf8",
  );
  const r = rps("validate", tmp);
  check("validate broken yaml exits 1", r.code === 1, `code=${r.code}`);
  rmSync(tmp, { recursive: true, force: true });
}

// ---- info: sample-full の要約 ----------------------------------------------
{
  const r = rps("info", SAMPLES.full);
  check("info full exits 0", r.code === 0, `code=${r.code}`);
  check("info full: 3 columns", /Columns\s*:\s*3/.test(r.out));
  check("info full: 6 figures", /Figures\s*:\s*6/.test(r.out));
  check("info full: reading distance", /Reading distance/.test(r.out));
}

// ---- explain: Agent 向け構造要約 -------------------------------------------
{
  const r = rps("explain", "--json", SAMPLES.full);
  check("explain full exits 0", r.code === 0, `code=${r.code}`);
  let obj;
  try {
    obj = JSON.parse(r.out);
  } catch {
    obj = null;
  }
  check("explain: valid JSON", obj != null);
  check("explain: readingOrder present", !!obj && Array.isArray(obj.readingOrder) && obj.readingOrder.length > 0);
  check("explain: no synthesized blocks", !!obj && JSON.stringify(obj.readingOrder).includes("__") === false);
  check("explain: figures listed", !!obj && Array.isArray(obj.figures) && obj.figures.length === 6);
  const rt = rps("explain", SAMPLES.full);
  check("explain text exits 0", rt.code === 0, `code=${rt.code}`);
  check("explain text: reading order header", /Reading order/.test(rt.out));
}

// ---- export html: 全部入りの描画マーカー -----------------------------------
{
  const r = rps("export", "html", SAMPLES.full);
  const out = path.join(SAMPLES.full, "exports", "poster.html");
  check("export html full exits 0", r.code === 0, `code=${r.code}`);
  check("poster.html exists", existsSync(out));
  const h = existsSync(out) ? readFileSync(out, "utf8") : "";
  check("html: PNG data URIs (gallery/logo)", count(h, "data:image/png") >= 4);
  check("html: SVG data URIs (fig1 + converted graphviz)", count(h, "data:image/svg") >= 2, `got ${count(h, "data:image/svg")}`);
  check("html: 2 CSV tables (figure + code block)", count(h, "<table") === 2, `got ${count(h, "<table")}`);
  check(
    "html: 2 unconverted placeholders (pdf/mmd; graphviz now converts in CLI)",
    count(h, "未変換の図表") === 2,
    `got ${count(h, "未変換の図表")}`,
  );
  check("html: graphviz code block converted to inline svg", h.includes("<svg"), "no inline svg from ```dot");
  check("html: no missing figures", count(h, "missing figure") === 0);
  check("html: gallery markup", h.includes("rps-gallery"));
  check("html: citation expanded (Nakata)", h.includes("Nakata"));
}

// ---- single-file content.md（sample-combined）------------------------------
{
  const e = rps("explain", "--json", SAMPLES.combined);
  check("combined explain exits 0", e.code === 0, `code=${e.code}`);
  let obj;
  try {
    obj = JSON.parse(e.out);
  } catch {
    obj = null;
  }
  check("combined: single-file mode", !!obj && obj.contentMode === "single-file");
  check("combined: content_file = content.md", !!obj && obj.contentFile === "content.md");
  const r = rps("export", "html", SAMPLES.combined);
  const out = path.join(SAMPLES.combined, "exports", "poster.html");
  check("combined export html exits 0", r.code === 0, `code=${r.code}`);
  const h = existsSync(out) ? readFileSync(out, "utf8") : "";
  check("combined: body from content.md rendered", h.includes("援助要請"), "background body missing");
  check("combined: ### stays in-body heading", h.includes("<h3"), "no h3 from ###");
  rmSync(out, { force: true });
}

// ---- export svg / marp ------------------------------------------------------
{
  const r = rps("export", "svg", SAMPLES.full);
  const out = path.join(SAMPLES.full, "exports", "poster.svg");
  check("export svg full exits 0", r.code === 0, `code=${r.code}`);
  const s = existsSync(out) ? readFileSync(out, "utf8") : "";
  check("poster.svg is an svg", s.includes("<svg"));
}
{
  const r = rps("export", "marp", SAMPLES.full);
  const out = path.join(SAMPLES.full, "exports", "poster.marp.md");
  check("export marp full exits 0", r.code === 0, `code=${r.code}`);
  const s = existsSync(out) ? readFileSync(out, "utf8") : "";
  check("poster.marp.md non-trivial", s.length > 100);
}

// ---- 既存サンプルの export html も生成できる --------------------------------
for (const name of ["poster", "nested"]) {
  const r = rps("export", "html", SAMPLES[name]);
  check(`export html ${name} exits 0`, r.code === 0, `code=${r.code}`);
}

console.log(`\n${fail === 0 ? "OK" : "NG"}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
