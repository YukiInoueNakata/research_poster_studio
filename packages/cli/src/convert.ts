// Node-side figure conversion for the CLI (Phase 3). Graphviz (.dot / .gv and
// ```dot code blocks) is rendered to SVG with @viz-js/viz (WASM, no DOM), so
// CLI exports no longer show placeholders for them. Mermaid (.mmd / ```mermaid)
// and PDF stay as placeholders — they need a browser / heavy native deps and
// are best produced by the desktop app (see docs/export-matrix.md).

import type { DiagramResolver, PosterProject } from "@rps/core";
import {
  dataUriToText,
  diagramKey,
  extractDiagramBlocks,
  flattenBlocks,
  textToDataUri,
} from "@rps/core";

let vizPromise: Promise<import("@viz-js/viz").Viz> | null = null;
async function getViz() {
  if (!vizPromise) vizPromise = import("@viz-js/viz").then((m) => m.instance());
  return vizPromise;
}

/** Render Graphviz DOT source to an SVG string. */
export async function renderDotSvg(code: string): Promise<string> {
  const viz = await getViz();
  return viz.renderString(code, { format: "svg" });
}

/** Pull explicit width/height from an <svg> root (Node-safe, regex-based). */
function svgSize(svg: string): { w?: number; h?: number } {
  const head = svg.slice(0, svg.indexOf(">") + 1);
  const w = /\bwidth="([\d.]+)/.exec(head)?.[1];
  const h = /\bheight="([\d.]+)/.exec(head)?.[1];
  return { w: w ? Math.round(+w) : undefined, h: h ? Math.round(+h) : undefined };
}

/** Convert every Graphviz figure asset to an SVG data URI (others untouched). */
export async function convertProjectFigures(
  project: PosterProject,
  onWarn?: (message: string) => void,
): Promise<PosterProject> {
  const figures = { ...project.figures };
  const done = new Map<string, (typeof figures)[string]>();
  for (const [key, asset] of Object.entries(project.figures)) {
    if (!/\.(dot|gv)$/i.test(asset.name)) continue;
    try {
      let conv = done.get(asset.name);
      if (!conv) {
        const svg = await renderDotSvg(dataUriToText(asset.dataUri));
        const { w, h } = svgSize(svg);
        conv = {
          ...asset,
          dataUri: textToDataUri(svg, "image/svg+xml"),
          naturalWidth: w ?? asset.naturalWidth,
          naturalHeight: h ?? asset.naturalHeight,
        };
        done.set(asset.name, conv);
      }
      figures[key] = conv;
    } catch (e: any) {
      onWarn?.(`Graphviz 変換に失敗（${asset.name}）: ${e?.message ?? e}`);
    }
  }
  return { ...project, figures };
}

/** Pre-render all ```dot code blocks; mermaid resolves to undefined (placeholder). */
export async function makeDiagramResolver(
  project: PosterProject,
  onWarn?: (message: string) => void,
): Promise<DiagramResolver> {
  const cache = new Map<string, string>();
  const blocks = flattenBlocks(project.doc.blocks);
  const sources = blocks.map((b) => project.content[b.id] ?? "");
  for (const md of sources) {
    for (const spec of extractDiagramBlocks(md)) {
      if (spec.kind !== "dot" || cache.has(spec.key)) continue;
      try {
        cache.set(spec.key, await renderDotSvg(spec.code));
      } catch (e: any) {
        onWarn?.(`Graphviz コードブロックの変換に失敗: ${e?.message ?? e}`);
      }
    }
  }
  return (kind, code) => (kind === "dot" ? cache.get(diagramKey("dot", code)) : undefined);
}

/** Whether the project still has figures/blocks the CLI cannot convert. */
export function hasUnconvertibleDiagrams(project: PosterProject): boolean {
  const figs = Object.values(project.figures).some((a) => /\.(mmd|pdf)$/i.test(a.name));
  const code = flattenBlocks(project.doc.blocks).some((b) =>
    extractDiagramBlocks(project.content[b.id] ?? "").some((s) => s.kind === "mermaid"),
  );
  return figs || code;
}

/** Load a project and convert what the CLI can (Graphviz). Returns the
 *  converted project + a diagram resolver for ```dot blocks. */
export async function prepareForRender(
  project: PosterProject,
  onWarn?: (message: string) => void,
): Promise<{ project: PosterProject; diagram: DiagramResolver }> {
  const diagram = await makeDiagramResolver(project, onWarn);
  const converted = await convertProjectFigures(project, onWarn);
  return { project: converted, diagram };
}
