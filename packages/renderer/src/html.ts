// Self-contained, print-ready HTML export.
//
// Figures are already embedded as data URIs, so the output is a single file
// that opens in any browser and prints to an exact A0/A1 PDF via @page.

import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { DiagramResolver, PosterProject } from "@rps/core";
import { posterSizeMm } from "@rps/core";
import { posterCss } from "./posterCss";
import PosterCanvas from "./PosterCanvas";

export interface RenderMarkupOptions {
  /** rendered SVG lookup for ```mermaid / ```dot code blocks */
  diagram?: DiagramResolver;
}

export function renderPosterMarkup(
  project: PosterProject,
  opts?: RenderMarkupOptions,
): string {
  return renderToStaticMarkup(
    createElement(PosterCanvas, {
      project,
      mode: "export",
      showBoundaries: false,
      diagram: opts?.diagram,
    }),
  );
}

export function buildHtml(project: PosterProject, opts?: RenderMarkupOptions): string {
  const { doc } = project;
  const size = posterSizeMm(doc.project);
  const body = renderPosterMarkup(project, opts);
  const css = posterCss(doc);
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>${escapeHtml(doc.project.title)}</title>
<style>
@page { size: ${size.w}mm ${size.h}mm; margin: 0; }
html,body{ margin:0; padding:0; }
@media screen { body{ background:#444; padding:20px; } .rps-poster{ margin:0 auto; box-shadow:0 0 30px rgba(0,0,0,0.5);} }
${css}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
