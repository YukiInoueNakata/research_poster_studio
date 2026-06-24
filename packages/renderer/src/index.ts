// @rps/renderer — render a poster project to React markup / HTML / SVG / Marp.
// Shared by the desktop app, the CLI, and (later) the VS Code extension.

import type { PosterProject } from "@rps/core";
import { buildHtml } from "./html";

export { default as PosterCanvas } from "./PosterCanvas";
export type { PosterCanvasProps } from "./PosterCanvas";
export * from "./style";
export * from "./posterCss";
export * from "./markdown";
export * from "./fancyLists";
export { buildHtml, renderPosterMarkup } from "./html";
export type { RenderMarkupOptions } from "./html";
export { buildSvg } from "./svg";
export { buildMarp } from "./marp";

export interface RenderHtmlOptions {
  zoom?: number;
  showBlockBorders?: boolean;
  showWarnings?: boolean;
}

/**
 * Render a poster project to a self-contained, print-ready HTML document
 * (figures embedded as data URIs; @page sized to A0/A1).
 */
export function renderPosterToHtml(
  project: PosterProject,
  _opts: RenderHtmlOptions = {},
): string {
  // options reserved for future use (borders/warnings overlays)
  return buildHtml(project);
}

export const RPS_RENDERER_VERSION = "0.1.0";
