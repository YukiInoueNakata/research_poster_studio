// Export dispatch (extracted from App.tsx). Given a kind and a context (the
// loaded project, diagram resolver, preview root, t/log), it shows a save
// dialog where needed and writes the file. PDF goes through the print dialog;
// PPTX needs the live preview DOM.

import { save } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import type { DiagramResolver, PosterProject } from "@rps/core";
import { buildHtml, buildSvg, buildMarp } from "@rps/renderer";
import { ensureDir, writeText, writeFileFromBase64 } from "../lib/tauri";
import { buildPptxBase64 } from "./pptx";
import { buildPngBase64 } from "./png";
import { printPoster } from "./print";
import type { ExportKind } from "../components/Toolbar";

type Log = (level: "ok" | "info" | "warn" | "error", message: string) => void;
type Translate = (key: string, vars?: Record<string, string | number>) => string;

export interface ExportCtx {
  project: PosterProject;
  diagram: DiagramResolver;
  posterRoot: HTMLElement | null;
  t: Translate;
  log: Log;
}

/** Default export path for a format, from export config or exports/poster.<ext>. */
export function exportName(project: PosterProject | null, ext: string): string {
  const cfg = project?.doc.export;
  const map: Record<string, string | undefined> = {
    html: cfg?.pdf?.filename?.replace(/\.pdf$/, ".html"),
    png: cfg?.png?.filename,
    svg: cfg?.svg?.filename,
    pptx: cfg?.pptx?.filename,
    "marp.md": cfg?.marp?.filename,
  };
  return map[ext] ?? `exports/poster.${ext}`;
}

/** Save dialog defaulting to the project's exports/ location. */
async function pickExportPath(
  ctx: ExportCtx,
  rel: string,
  ext: string,
  label: string,
): Promise<string | null> {
  const { project, t, log } = ctx;
  const segs = rel.split("/");
  if (segs.length > 1) {
    const dir = await invoke<string>("join_path", { base: project.dir, segments: segs.slice(0, -1) });
    await ensureDir(dir).catch(() => {});
  }
  const def = await invoke<string>("join_path", { base: project.dir, segments: segs });
  const sel = await save({
    title: t("app.exportSaveTitle", { label }),
    defaultPath: def,
    filters: [{ name: label, extensions: [ext] }],
  });
  if (!sel) {
    log("info", t("log.exportCancelled", { label }));
    return null;
  }
  return sel;
}

/** Run one export. Errors are logged (does not throw). */
export async function runExport(kind: ExportKind, ctx: ExportCtx): Promise<void> {
  const { project, diagram, posterRoot, t, log } = ctx;
  try {
    switch (kind) {
      case "pdf": {
        log("info", t("log.printDialogOpening"));
        await printPoster(project, { diagram });
        break;
      }
      case "png": {
        const path = await pickExportPath(ctx, exportName(project, "png"), "png", "PNG");
        if (!path) break;
        const dpi = project.doc.export?.png?.dpi ?? 150;
        log("info", t("log.pngRasterizing", { dpi }));
        const b64 = await buildPngBase64(project, dpi, { diagram });
        await writeFileFromBase64(path, b64);
        log("ok", t("log.pngExported", { path, dpi }));
        await openPath(path).catch(() => {});
        break;
      }
      case "html": {
        const path = await pickExportPath(ctx, exportName(project, "html"), "html", "HTML");
        if (!path) break;
        await writeText(path, buildHtml(project, { diagram }));
        log("ok", t("log.htmlExported", { path }));
        await openPath(path).catch(() => {});
        break;
      }
      case "svg": {
        const path = await pickExportPath(ctx, exportName(project, "svg"), "svg", "SVG");
        if (!path) break;
        await writeText(path, buildSvg(project, { diagram }));
        log("ok", t("log.svgExported", { path }));
        await openPath(path).catch(() => {});
        break;
      }
      case "marp": {
        const path = await pickExportPath(ctx, exportName(project, "marp.md"), "md", "Marp Markdown");
        if (!path) break;
        await writeText(path, buildMarp(project));
        log("ok", t("log.marpExported", { path }));
        break;
      }
      case "pptx": {
        if (!posterRoot) {
          log("error", t("log.pptxNoPreview"));
          break;
        }
        const path = await pickExportPath(ctx, exportName(project, "pptx"), "pptx", "PPTX");
        if (!path) break;
        const b64 = await buildPptxBase64(project, posterRoot);
        await writeFileFromBase64(path, b64);
        log("ok", t("log.pptxExported", { path }));
        await openPath(path).catch(() => {});
        break;
      }
    }
  } catch (e: any) {
    log("error", t("log.exportFailed", { kind, msg: e?.message ?? e }));
  }
}
