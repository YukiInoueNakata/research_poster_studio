// PNG export (desktop). Rasterizes the self-contained foreignObject SVG
// (same markup/CSS as the preview and HTML/SVG exports) on an offscreen
// canvas inside the WebView — no headless browser needed, unlike the CLI's
// Playwright path. Figures are data URIs so the canvas stays untainted.
//
// Default 150 dpi (A0 portrait ≈ 4967x7022 px). 300 dpi A0 (≈ 9933x14043 px)
// still fits Chromium's canvas limits but is slow and memory-heavy; set it
// per project via export.png.dpi in poster.yaml.

import type { PosterProject } from "@rps/core";
import { MM_PER_INCH, posterSizeMm } from "@rps/core";
import { buildSvg, type RenderMarkupOptions } from "@rps/renderer";

export async function buildPngBase64(
  project: PosterProject,
  dpi = 150,
  opts?: RenderMarkupOptions,
): Promise<string> {
  const size = posterSizeMm(project.doc.project);
  const w = Math.round((size.w / MM_PER_INCH) * dpi);
  const h = Math.round((size.h / MM_PER_INCH) * dpi);

  const svg = buildSvg(project, opts);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context が取得できません");
    // posters are printed on paper — flatten on white
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("SVG のラスタライズ読み込みに失敗しました"));
    img.src = src;
  });
}
