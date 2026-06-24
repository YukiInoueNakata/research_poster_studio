// rps — Research Poster Studio CLI.
//   rps init --template <name> [dir]
//   rps validate [dir]
//   rps preview [dir] [--watch] [--port N]
//   rps export <pdf|png|svg|html|marp> [dir]
//   rps info [dir]
//   rps explain [dir] [--json]

import { Command } from "commander";
import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import chokidar from "chokidar";

import { validatePosterYaml, calculateLayout, readingDistanceIndex } from "@rps/core";
import { loadPosterProjectFs } from "@rps/core/node";
import { buildHtml, buildSvg, buildMarp } from "@rps/renderer";
import { htmlToPdf, htmlToPng } from "@rps/exporter";
import { prepareForRender, hasUnconvertibleDiagrams } from "./convert.js";
import { buildExplain, formatExplainText } from "./explain.js";

const here = path.dirname(fileURLToPath(import.meta.url));
// packages/cli/{src,dist} -> repo root is three levels up
const TEMPLATES_DIR = path.resolve(here, "../../../skills/research-poster-studio/templates");

async function readYaml(dir: string): Promise<string> {
  return fs.readFile(path.join(dir, "poster.yaml"), "utf8");
}

const program = new Command();
program.name("rps").description("Research Poster Studio CLI").version("0.1.0");

// ---- init ----------------------------------------------------------------
program
  .command("init")
  .argument("[dir]", "target directory", ".")
  .requiredOption("-t, --template <name>", "quantitative | qualitative | multi-study | method-tool")
  .description("Scaffold a new poster project from a template")
  .action(async (dir: string, opts: { template: string }) => {
    const tplPath = path.join(TEMPLATES_DIR, `${opts.template}.yaml`);
    let tpl: string;
    try {
      tpl = await fs.readFile(tplPath, "utf8");
    } catch {
      console.error(`✗ template not found: ${opts.template} (${tplPath})`);
      process.exit(1);
    }
    await fs.mkdir(path.join(dir, "content"), { recursive: true });
    await fs.mkdir(path.join(dir, "figures"), { recursive: true });
    await fs.mkdir(path.join(dir, "exports"), { recursive: true });
    await fs.writeFile(path.join(dir, "poster.yaml"), tpl, "utf8");
    // create stub content files for each block source referenced in the template
    for (const m of tpl.matchAll(/source:\s*([A-Za-z0-9_\-./]+\.md)/g)) {
      const rel = m[1];
      const p = path.join(dir, rel);
      await fs.mkdir(path.dirname(p), { recursive: true });
      try {
        await fs.access(p);
      } catch {
        await fs.writeFile(p, `（${path.basename(rel, ".md")} の本文をここに記述）\n`, "utf8");
      }
    }
    console.log(`✓ created poster project (${opts.template}) in ${path.resolve(dir)}`);
  });

// ---- validate ------------------------------------------------------------
program
  .command("validate")
  .argument("[dir]", "project directory", ".")
  .description("Validate poster.yaml schema and report warnings")
  .action(async (dir: string) => {
    const text = await readYaml(dir);
    const res = validatePosterYaml(text);
    if (res.errors.length === 0) console.log("✓ poster.yaml schema valid");
    for (const e of res.errors) console.log(`✗ ${e}`);
    for (const w of res.warnings) {
      const mark = w.level === "error" ? "✗" : w.level === "warn" ? "⚠" : "·";
      console.log(`${mark} ${w.message}`);
    }
    const errN = res.errors.length + res.warnings.filter((w) => w.level === "error").length;
    const warnN = res.warnings.filter((w) => w.level === "warn").length;
    console.log(`\n${errN === 0 ? "✓" : "✗"} ${errN} errors, ${warnN} warnings`);
    process.exit(errN > 0 ? 1 : 0);
  });

// ---- info ----------------------------------------------------------------
program
  .command("info")
  .argument("[dir]", "project directory", ".")
  .description("Show a summary of the poster project")
  .action(async (dir: string) => {
    const project = await loadPosterProjectFs(dir);
    const { doc } = project;
    const layout = calculateLayout(doc);
    const res = validatePosterYaml(await readYaml(dir));
    console.log(`Title      : ${doc.project.title}`);
    const r1 = (n: number) => Math.round(n * 10) / 10;
    console.log(`Size       : ${doc.project.poster_size} ${doc.project.orientation} (${r1(layout.paper.w)} x ${r1(layout.paper.h)} mm)`);
    console.log(`Columns    : ${doc.layout.columns.count}`);
    console.log(`Blocks     : ${doc.blocks.length}`);
    console.log(`Figures    : ${doc.figures.length}`);
    console.log(`Bands      : ${layout.bands.length}`);
    console.log(`Warnings   : ${res.warnings.length} (${res.errors.length} schema errors)`);
    console.log("Reading distance (comfortable / legible):");
    for (const e of readingDistanceIndex(doc)) {
      console.log(
        `  ${e.label.padEnd(14, "　")}: ${String(r1(e.pt)).padStart(5)}pt -> ${e.comfortableM.toFixed(1)}m / ${e.legibleM.toFixed(1)}m`,
      );
    }
  });

// ---- explain -------------------------------------------------------------
program
  .command("explain")
  .argument("[dir]", "project directory", ".")
  .option("--json", "output machine-readable JSON")
  .description("Summarize the poster structure for an Agent (reading order, figures, warnings)")
  .action(async (dir: string, opts: { json?: boolean }) => {
    const project = await loadPosterProjectFs(dir);
    const explain = buildExplain(project, await readYaml(dir));
    console.log(opts.json ? JSON.stringify(explain, null, 2) : formatExplainText(explain));
  });

// ---- preview -------------------------------------------------------------
program
  .command("preview")
  .argument("[dir]", "project directory", ".")
  .option("-w, --watch", "reload on source changes")
  .option("-p, --port <n>", "port", "4321")
  .description("Serve a live HTML preview in the browser")
  .action(async (dir: string, opts: { watch?: boolean; port: string }) => {
    let lastChange = Date.now();
    const reloadScript = `<script>let v=0;setInterval(async()=>{try{const t=await (await fetch('/__rps/changed')).text();if(!v)v=t;else if(t!==v)location.reload();}catch{}},1000)</script>`;

    const server = createServer(async (req, res) => {
      if (req.url === "/__rps/changed") {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end(String(lastChange));
        return;
      }
      try {
        const loaded = await loadPosterProjectFs(dir);
        const { project, diagram } = await prepareForRender(loaded);
        let html = buildHtml(project, { diagram });
        if (opts.watch) html = html.replace("</body>", `${reloadScript}</body>`);
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(html);
      } catch (e: any) {
        res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
        res.end(`Error: ${e?.message ?? e}`);
      }
    });

    if (opts.watch) {
      const watcher = chokidar.watch(
        ["poster.yaml", "content", "themes", "figures"].map((p) => path.join(dir, p)),
        { ignoreInitial: true },
      );
      watcher.on("all", (_e, p) => {
        lastChange = Date.now();
        console.log(`changed: ${p}`);
      });
    }

    const port = Number(opts.port);
    server.listen(port, () => {
      console.log(`rps preview: http://localhost:${port}${opts.watch ? "  (watching)" : ""}`);
    });
  });

// ---- export --------------------------------------------------------------
program
  .command("export")
  .argument("<format>", "pdf | png | svg | html | marp")
  .argument("[dir]", "project directory", ".")
  .description("Export the poster to exports/")
  .action(async (format: string, dir: string) => {
    const loaded = await loadPosterProjectFs(dir);
    const { project, diagram } = await prepareForRender(loaded, (m) => console.log(`⚠ ${m}`));
    const outDir = path.join(dir, "exports");
    await fs.mkdir(outDir, { recursive: true });
    const html = buildHtml(project, { diagram });
    if (hasUnconvertibleDiagrams(project)) {
      console.log(
        "⚠ Mermaid / PDF はプレースホルダのままです（CLI は変換しません．デスクトップアプリを使ってください）．",
      );
    }
    switch (format) {
      case "pdf": {
        const out = path.join(outDir, "poster.pdf");
        await htmlToPdf(html, out);
        console.log(`✓ ${out}`);
        break;
      }
      case "png": {
        const out = path.join(outDir, "poster.png");
        await htmlToPng(html, out);
        console.log(`✓ ${out}`);
        break;
      }
      case "svg": {
        const out = path.join(outDir, "poster.svg");
        await fs.writeFile(out, buildSvg(project, { diagram }), "utf8");
        console.log(`✓ ${out}`);
        break;
      }
      case "html": {
        const out = path.join(outDir, "poster.html");
        await fs.writeFile(out, html, "utf8");
        console.log(`✓ ${out}`);
        break;
      }
      case "marp": {
        const out = path.join(outDir, "poster.marp.md");
        await fs.writeFile(out, buildMarp(project), "utf8");
        console.log(`✓ ${out}`);
        break;
      }
      default:
        console.error(`✗ unknown format: ${format} (pdf|png|svg|html|marp)`);
        process.exit(1);
    }
  });

program.parseAsync();
