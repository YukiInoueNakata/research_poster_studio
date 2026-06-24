// Load and save a poster project directory.

import yaml from "js-yaml";
import type { CitationStyle, PosterDoc, PosterProject } from "@rps/core";
import {
  buildCombinedContent,
  combinedFilesOf,
  flattenBlocks,
  mergeCombinedContent,
  normalizeCitationStyle,
  normalizeDoc,
  parseBibtex,
  splitContentAnchor,
} from "@rps/core";
import {
  ensureDir,
  joinPath,
  listDir,
  loadFigures,
  pathExists,
  readText,
  writeText,
} from "./tauri";

export const POSTER_FILE = "poster.yaml";

export async function loadProject(
  dir: string,
  posterFile: string = POSTER_FILE,
): Promise<PosterProject> {
  const yamlPath = await joinPath(dir, [posterFile]);
  if (!(await pathExists(yamlPath))) {
    throw new Error(`${posterFile} が見つかりません: ${dir}`);
  }
  const yamlText = await readText(yamlPath);
  const raw = yaml.load(yamlText) as any;
  let doc = normalizeDoc(raw);

  // single-file body content (content.md#anchor): read each combined file once
  const fileTexts: Record<string, string> = {};
  for (const f of combinedFilesOf(doc)) {
    const p = await joinPath(dir, f.split("/"));
    fileTexts[f] = (await pathExists(p)) ? await readText(p) : "";
  }
  const merged = mergeCombinedContent(doc, fileTexts);
  doc = merged.doc;
  const content: Record<string, string> = { ...merged.content };

  // legacy per-block content markdown (content/<id>.md), including child blocks
  for (const block of flattenBlocks(doc.blocks)) {
    if (content[block.id] !== undefined || !block.source) continue;
    if (splitContentAnchor(block.source)) continue; // anchored: handled above
    const p = await joinPath(dir, block.source.split("/"));
    content[block.id] = (await pathExists(p)) ? await readText(p) : "";
  }

  // load figures from figures/ directory
  const figsDir = await joinPath(dir, ["figures"]);
  const figFiles = await loadFigures(figsDir);
  const figures: PosterProject["figures"] = {};
  const byName = new Map(figFiles.map((f) => [f.name, f]));
  // map declared figures (by id) to their files via path basename
  for (const f of doc.figures) {
    const base = f.path.split("/").pop() ?? f.path;
    const file = byName.get(base);
    if (file) {
      figures[f.id] = {
        name: file.name,
        path: file.path,
        dataUri: file.data_uri,
        bytes: file.bytes,
      };
    }
  }
  // also index every figure file by filename so undeclared files are usable
  for (const file of figFiles) {
    if (!figures[file.name]) {
      figures[file.name] = {
        name: file.name,
        path: file.path,
        dataUri: file.data_uri,
        bytes: file.bytes,
      };
    }
  }

  // BibTeX (citation mode): doc.references.bib or the default references.bib
  let bib: PosterProject["bib"];
  let bibErrors: string[] | undefined;
  const bibRel = doc.references?.bib ?? "references.bib";
  const bibPath = await joinPath(dir, bibRel.split("/"));
  if (await pathExists(bibPath)) {
    const parsed = parseBibtex(await readText(bibPath));
    bib = parsed.entries;
    bibErrors = parsed.errors.length > 0 ? parsed.errors : undefined;
  }

  // user citation styles: styles/*.yaml
  let citationStyles: Record<string, CitationStyle> | undefined;
  const stylesDir = await joinPath(dir, ["styles"]);
  if (await pathExists(stylesDir)) {
    for (const entry of await listDir(stylesDir)) {
      if (entry.is_dir || !/\.ya?ml$/i.test(entry.name)) continue;
      try {
        const raw = yaml.load(await readText(entry.path));
        const style = normalizeCitationStyle(raw, entry.name.replace(/\.ya?ml$/i, ""));
        if (style) {
          citationStyles = citationStyles ?? {};
          citationStyles[style.name] = style;
        }
      } catch {
        // skip unreadable style files
      }
    }
  }

  return { dir, posterFile, doc, content, figures, bib, bibErrors, citationStyles };
}

/** Serialize the document back to poster.yaml (preserving key order roughly). */
export function docToYaml(doc: PosterDoc): string {
  return yaml.dump(doc, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
  });
}

export async function saveProjectYaml(project: PosterProject): Promise<void> {
  const yamlPath = await joinPath(project.dir, [project.posterFile ?? POSTER_FILE]);
  await writeText(yamlPath, docToYaml(project.doc));
}

export async function saveBlockContent(
  project: PosterProject,
  blockId: string,
  markdown: string,
): Promise<void> {
  const block = flattenBlocks(project.doc.blocks).find((b) => b.id === blockId);
  if (!block?.source) return;
  // combined-file mode: rewrite the whole content.md from the live content map
  if (splitContentAnchor(block.source)) {
    await saveCombinedContent({ ...project, content: { ...project.content, [blockId]: markdown } });
    return;
  }
  const p = await joinPath(project.dir, block.source.split("/"));
  await writeText(p, markdown);
}

/** Single-file mode: rewrite each combined content file from the block tree. */
export async function saveCombinedContent(project: PosterProject): Promise<void> {
  const files = buildCombinedContent(project.doc, project.content);
  for (const [rel, text] of Object.entries(files)) {
    const p = await joinPath(project.dir, rel.split("/"));
    await writeText(p, text);
  }
}

/** Whether the project stores body content in one or more combined files. */
export function usesCombinedContent(project: PosterProject): boolean {
  return combinedFilesOf(project.doc).length > 0;
}

export async function writeExport(
  project: PosterProject,
  relPath: string,
  contents: string,
): Promise<string> {
  const segs = relPath.split("/");
  const p = await joinPath(project.dir, segs);
  // ensure exports dir
  const exportDir = await joinPath(project.dir, segs.slice(0, -1));
  await ensureDir(exportDir);
  await writeText(p, contents);
  return p;
}
