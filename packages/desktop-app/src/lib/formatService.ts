// Format package export / import / apply (extracted from App.tsx). A format
// package is a single YAML carrying theme + layout + header style + block
// structure (no body text), with background / logo images embedded as data
// URIs. See core/formatPackage.ts.

import { open, save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import yaml from "js-yaml";
import type { FormatPackage, FormatSections, PosterProject } from "@rps/core";
import {
  applyFormatPackage,
  buildFormatPackage,
  flattenBlocks,
  isFormatPackage,
  normalizeDoc,
} from "@rps/core";
import { ensureDir, readText, writeText, writeFileFromBase64 } from "./tauri";

type Log = (level: "ok" | "info" | "warn" | "error", message: string) => void;
type Translate = (key: string, vars?: Record<string, string | number>) => string;

export interface FormatCtx {
  project: PosterProject;
  setProject: (p: PosterProject) => void;
  setDirty: (v: boolean) => void;
  t: Translate;
  log: Log;
}

/** Export theme / layout / header / structure to a single format.yaml. */
export async function exportFormat(ctx: FormatCtx): Promise<void> {
  const { project, t, log } = ctx;
  try {
    const def = await invoke<string>("join_path", { base: project.dir, segments: ["format.yaml"] });
    const sel = await save({
      title: t("app.exportFormatTitle"),
      defaultPath: def,
      filters: [{ name: t("app.formatYamlFilter"), extensions: ["yaml", "yml"] }],
    });
    if (typeof sel !== "string") return;
    const name = (sel.split(/[\\/]/).pop() ?? "format").replace(/\.ya?ml$/i, "");
    const pkg = buildFormatPackage(project.doc, project.figures, name);
    await writeText(sel, yaml.dump(pkg, { indent: 2, lineWidth: 120, noRefs: true, sortKeys: false }));
    log("ok", t("log.formatExported", { path: sel, n: pkg.assets?.length ?? 0 }));
  } catch (e: any) {
    log("error", t("log.formatExportFailed", { msg: e?.message ?? e }));
  }
}

/** Pick a format YAML (or poster.yaml) and parse it; does not apply yet. */
export async function pickFormatFile(ctx: FormatCtx): Promise<FormatPackage | null> {
  const { t, log } = ctx;
  try {
    const sel = await open({
      title: t("app.importFormatTitle"),
      multiple: false,
      filters: [{ name: t("app.formatPosterYamlFilter"), extensions: ["yaml", "yml"] }],
    });
    if (typeof sel !== "string") return null;
    const raw = yaml.load(await readText(sel));
    if (isFormatPackage(raw)) {
      log("ok", t("log.formatLoaded", { name: raw.name ?? sel }));
      return raw;
    }
    // poster.yaml fallback: treat look & structure as a package (画像は埋め込まれない)
    const name = (sel.split(/[\\/]/).pop() ?? "poster").replace(/\.ya?ml$/i, "");
    const pkg = buildFormatPackage(normalizeDoc(raw), undefined, name);
    log("warn", t("log.formatNotPackage"));
    return pkg;
  } catch (e: any) {
    log("error", t("log.formatLoadFailed", { msg: e?.message ?? e }));
    return null;
  }
}

/** Apply selected sections of a loaded format package to the project. */
export async function applyFormat(
  ctx: FormatCtx,
  pkg: FormatPackage,
  sections: FormatSections,
): Promise<void> {
  const { project, setProject, setDirty, t, log } = ctx;
  try {
    const res = applyFormatPackage(project.doc, pkg, sections);
    // embedded images -> figures/ (既存の同名ファイルは温存して再利用)
    const figures = { ...project.figures };
    for (const a of res.assets) {
      if (figures[a.name]) continue;
      const figDir = await invoke<string>("join_path", { base: project.dir, segments: ["figures"] });
      await ensureDir(figDir);
      const dest = await invoke<string>("join_path", {
        base: project.dir,
        segments: ["figures", a.name],
      });
      await writeFileFromBase64(dest, a.data);
      figures[a.name] = { name: a.name, path: `figures/${a.name}`, dataUri: a.data, bytes: 0 };
    }
    // re-normalize so layout invariants / figure sync passes run
    const doc = normalizeDoc(JSON.parse(JSON.stringify(res.doc)));
    // structure import: keep body text for surviving ids, blank for new ones
    let content = project.content;
    if (sections.structure && pkg.structure) {
      content = {};
      for (const b of flattenBlocks(doc.blocks)) {
        if (b.source) content[b.id] = project.content[b.id] ?? "";
      }
      const contentDir = await invoke<string>("join_path", {
        base: project.dir,
        segments: ["content"],
      });
      await ensureDir(contentDir);
    }
    setProject({ ...project, doc, figures, content });
    setDirty(true);
    for (const w of res.warnings) log("warn", w);
    const applied = (
      [
        ["theme", t("app.formatSectionTheme")],
        ["layout", t("app.formatSectionLayout")],
        ["header", t("app.formatSectionHeader")],
        ["structure", t("app.formatSectionStructure")],
      ] as const
    )
      .filter(([k]) => sections[k] && (pkg as any)[k])
      .map(([, label]) => label);
    log("ok", t("log.formatApplied", { applied: applied.join(" / ") }));
  } catch (e: any) {
    log("error", t("log.formatApplyFailed", { msg: e?.message ?? e }));
  }
}
