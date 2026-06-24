// @rps/core/node — Node-only helpers (filesystem project loader for the CLI).
// Not part of the browser/DOM-free entry; uses node:fs.

import { promises as fs } from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import { flattenBlocks } from "./layout";
import { normalizeDoc } from "./normalize";
import { combinedFilesOf, mergeCombinedContent, splitContentAnchor } from "./combinedContent";
import { parseBibtex, type BibEntry } from "./bibtex";
import { normalizeCitationStyle, type CitationStyle } from "./citation";
import type { FigureAsset, PosterProject } from "./types";

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
// text-source figures (csv table / pdf / mermaid / graphviz). Loaded so the
// renderer can draw CSV tables and show the 未変換 placeholder for figures
// that only the desktop WebView converts to images (see docs/export-matrix.md).
// emf/wmf are vector formats the browser can't draw — loaded only so the
// renderer shows the EMF/WMF placeholder (convert to PNG in the desktop app).
const TEXT_FIGURE_EXT = ["csv", "pdf", "mmd", "dot", "gv", "emf", "wmf"];

function mimeFor(ext: string): string {
  switch (ext.toLowerCase()) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "csv":
      return "text/csv";
    case "pdf":
      return "application/pdf";
    case "mmd":
    case "dot":
    case "gv":
      return "text/plain";
    case "emf":
      return "image/x-emf";
    case "wmf":
      return "image/x-wmf";
    default:
      return "application/octet-stream";
  }
}

/** Load a poster project from a directory (poster.yaml + content/ + figures/). */
export async function loadPosterProjectFs(dir: string): Promise<PosterProject> {
  const text = await fs.readFile(path.join(dir, "poster.yaml"), "utf8");
  let doc = normalizeDoc(yaml.load(text));

  // single-file body content (content.md#anchor)
  const fileTexts: Record<string, string> = {};
  for (const f of combinedFilesOf(doc)) {
    try {
      fileTexts[f] = await fs.readFile(path.join(dir, f), "utf8");
    } catch {
      fileTexts[f] = "";
    }
  }
  const merged = mergeCombinedContent(doc, fileTexts);
  doc = merged.doc;
  const content: Record<string, string> = { ...merged.content };

  // legacy per-block content markdown (content/<id>.md)
  for (const b of flattenBlocks(doc.blocks)) {
    if (content[b.id] !== undefined || !b.source) continue;
    if (splitContentAnchor(b.source)) continue;
    try {
      content[b.id] = await fs.readFile(path.join(dir, b.source), "utf8");
    } catch {
      content[b.id] = "";
    }
  }

  const figures: Record<string, FigureAsset> = {};
  const figDir = path.join(dir, "figures");
  let files: string[] = [];
  try {
    files = await fs.readdir(figDir);
  } catch {
    files = [];
  }
  const byName = new Map<string, FigureAsset>();
  for (const name of files) {
    const ext = path.extname(name).slice(1).toLowerCase();
    if (!IMAGE_EXT.includes(ext) && !TEXT_FIGURE_EXT.includes(ext)) continue;
    const buf = await fs.readFile(path.join(figDir, name));
    byName.set(name, {
      name,
      path: path.join(figDir, name),
      dataUri: `data:${mimeFor(ext)};base64,${buf.toString("base64")}`,
      bytes: buf.length,
    });
  }
  for (const f of doc.figures) {
    const base = f.path.split("/").pop() ?? f.path;
    const a = byName.get(base);
    if (a) figures[f.id] = a;
  }
  for (const [name, a] of byName) {
    if (!figures[name]) figures[name] = a;
  }

  // BibTeX (citation mode): doc.references.bib or the default references.bib
  let bib: BibEntry[] | undefined;
  let bibErrors: string[] | undefined;
  try {
    const bibText = await fs.readFile(
      path.join(dir, doc.references?.bib ?? "references.bib"),
      "utf8",
    );
    const parsed = parseBibtex(bibText);
    bib = parsed.entries;
    bibErrors = parsed.errors.length > 0 ? parsed.errors : undefined;
  } catch {
    // no .bib file -> citation mode stays inactive
  }

  // user citation styles: styles/*.yaml
  let citationStyles: Record<string, CitationStyle> | undefined;
  try {
    const stylesDir = path.join(dir, "styles");
    for (const name of await fs.readdir(stylesDir)) {
      if (!/\.ya?ml$/i.test(name)) continue;
      try {
        const raw = yaml.load(await fs.readFile(path.join(stylesDir, name), "utf8"));
        const style = normalizeCitationStyle(raw, name.replace(/\.ya?ml$/i, ""));
        if (style) {
          citationStyles = citationStyles ?? {};
          citationStyles[style.name] = style;
        }
      } catch {
        // skip unreadable style files
      }
    }
  } catch {
    // no styles/ directory
  }

  return { dir, doc, content, figures, bib, bibErrors, citationStyles };
}
