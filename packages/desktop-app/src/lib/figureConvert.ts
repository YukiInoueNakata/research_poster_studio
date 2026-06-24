// Convert non-image figure sources into image data URIs inside the WebView
// (設計書 §10.1 将来対応分: PDF 貼り込み / Mermaid / Graphviz).
//
// Conversion happens once at load / add time; downstream (preview, HTML/SVG/
// PNG/PPTX export) sees a normal image asset, so no other pipeline changes.
//   *.pdf        -> 1 ページ目を canvas にラスタライズ（pdfjs-dist，PNG）
//   *.mmd        -> mermaid render（SVG）
//   *.dot / *.gv -> Graphviz（@viz-js/viz, WASM．SVG）
// *.csv is NOT converted — the renderer draws it as a table directly.
// Heavy libraries are lazy-imported so app startup stays fast.

import type { DiagramKind, FigureAsset } from "@rps/core";
import { dataUriToText, textToDataUri } from "@rps/core";

/** target raster width (px) for PDF page rendering */
const PDF_TARGET_PX = 2200;

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;
async function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((m) => {
      m.default.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        // pure-SVG labels so the output survives sanitization and PPTX/PNG
        // rasterization (no foreignObject)
        htmlLabels: false,
        flowchart: { htmlLabels: false },
      });
      return m.default;
    });
  }
  return mermaidPromise;
}

let vizPromise: Promise<import("@viz-js/viz").Viz> | null = null;
async function getViz() {
  if (!vizPromise) {
    vizPromise = import("@viz-js/viz").then((m) => m.instance());
  }
  return vizPromise;
}

function dataUriToBytes(uri: string): Uint8Array {
  const m = uri.match(/^data:[^,]*;base64,(.*)$/s);
  if (!m) throw new Error("base64 data URI ではありません");
  const bin = atob(m[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Ensure the SVG root has explicit pixel width/height (for <img> sizing). */
function ensureSvgSize(svg: string): { svg: string; w?: number; h?: number } {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = doc.documentElement;
  if (root.nodeName.toLowerCase() !== "svg") return { svg };
  const num = (v: string | null) => {
    if (!v) return undefined;
    const f = parseFloat(v);
    return Number.isFinite(f) ? f : undefined;
  };
  let w = num(root.getAttribute("width"));
  let h = num(root.getAttribute("height"));
  if (w == null || h == null) {
    const vb = (root.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(parseFloat);
    if (vb.length === 4 && vb.every((n) => Number.isFinite(n))) {
      w = w ?? vb[2];
      h = h ?? vb[3];
    }
  }
  if (w != null && h != null) {
    root.setAttribute("width", String(w));
    root.setAttribute("height", String(h));
    // mermaid emits style="max-width: ...px" which fights <img> scaling
    root.style.maxWidth = "";
  }
  return { svg: new XMLSerializer().serializeToString(root), w, h };
}

/** Rasterize page 1 of a PDF into a PNG data URI. */
export async function pdfToPngDataUri(
  pdfDataUri: string,
): Promise<{ dataUri: string; width: number; height: number }> {
  const pdfjs = await getPdfjs();
  const task = pdfjs.getDocument({ data: dataUriToBytes(pdfDataUri) });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.max(1, Math.min(6, PDF_TARGET_PX / base.width));
    const vp = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context を取得できません");
    await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
    return {
      dataUri: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    await task.destroy().catch(() => {});
  }
}

/**
 * Knock out a white / near-white background to true alpha (transparency that
 * works on ANY page background, unlike the multiply-blend `transparent_white`
 * render option). Pixels whose R,G,B are all >= 255-tolerance become fully
 * transparent. Returns a new PNG data URI. Runs in the browser/webview via
 * canvas, so it is a desktop-side bake (not available in headless CLI).
 */
export async function knockoutWhiteToDataUri(
  dataUri: string,
  tolerance = 18,
): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("画像を読み込めませんでした"));
    im.src = dataUri;
  });
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context を取得できません");
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  const thr = 255 - tolerance;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] >= thr && d[i + 1] >= thr && d[i + 2] >= thr) d[i + 3] = 0;
  }
  ctx.putImageData(id, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * N13 (C): auto-detect the non-white bounding box of an image and return crop
 * fractions (top/right/bottom/left) that trim the surrounding whitespace.
 * Returns enabled:false when the image is essentially blank.
 */
export async function autoTrimCrop(
  dataUri: string,
  tolerance = 12,
): Promise<{ enabled: boolean; top: number; right: number; bottom: number; left: number }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("画像を読み込めませんでした"));
    im.src = dataUri;
  });
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context を取得できません");
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, w, h).data;
  const thr = 255 - tolerance;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const opaque = d[i + 3] > 10;
      const white = d[i] >= thr && d[i + 1] >= thr && d[i + 2] >= thr;
      if (opaque && !white) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { enabled: false, top: 0, right: 0, bottom: 0, left: 0 };
  const pad = Math.round(Math.min(w, h) * 0.02);
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);
  return {
    enabled: true,
    left: +(minX / w).toFixed(3),
    top: +(minY / h).toFixed(3),
    right: +((w - 1 - maxX) / w).toFixed(3),
    bottom: +((h - 1 - maxY) / h).toFixed(3),
  };
}

let mermaidSeq = 0;

/** Render diagram source (mermaid / dot) to an SVG string. */
export async function renderDiagramSvg(kind: DiagramKind, code: string): Promise<string> {
  if (kind === "mermaid") {
    const mermaid = await getMermaid();
    const { svg } = await mermaid.render(`rps-mmd-${++mermaidSeq}`, code);
    return ensureSvgSize(svg).svg;
  }
  const viz = await getViz();
  const svg = viz.renderString(code, { format: "svg" });
  return ensureSvgSize(svg).svg;
}

const CONVERTIBLE = /\.(pdf|mmd|dot|gv)$/i;

/** Does this figure filename need conversion before display? */
export function isConvertibleFigure(name: string): boolean {
  return CONVERTIBLE.test(name);
}

/**
 * Convert one asset (by file extension). Returns the converted asset, or the
 * original when no conversion applies. Throws on conversion failure.
 */
export async function convertFigureAsset(asset: FigureAsset): Promise<FigureAsset> {
  const ext = (asset.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? "").toLowerCase();
  if (ext === "pdf") {
    const r = await pdfToPngDataUri(asset.dataUri);
    return { ...asset, dataUri: r.dataUri, naturalWidth: r.width, naturalHeight: r.height };
  }
  if (ext === "mmd" || ext === "dot" || ext === "gv") {
    const kind: DiagramKind = ext === "mmd" ? "mermaid" : "dot";
    const svg = await renderDiagramSvg(kind, dataUriToText(asset.dataUri));
    const sized = ensureSvgSize(svg);
    return {
      ...asset,
      dataUri: textToDataUri(sized.svg, "image/svg+xml"),
      naturalWidth: sized.w != null ? Math.round(sized.w) : asset.naturalWidth,
      naturalHeight: sized.h != null ? Math.round(sized.h) : asset.naturalHeight,
    };
  }
  return asset;
}

/**
 * Convert every convertible asset in a figures map (in place keys, new map).
 * Failures keep the original asset and are reported via onWarn.
 */
export async function convertFigureAssets(
  figures: Record<string, FigureAsset>,
  onWarn?: (message: string) => void,
): Promise<Record<string, FigureAsset>> {
  const out: Record<string, FigureAsset> = { ...figures };
  // convert each distinct file once (the map indexes assets by id AND name)
  const done = new Map<string, FigureAsset>();
  for (const [key, asset] of Object.entries(figures)) {
    if (!isConvertibleFigure(asset.name)) continue;
    try {
      let conv = done.get(asset.name);
      if (!conv) {
        conv = await convertFigureAsset(asset);
        done.set(asset.name, conv);
      }
      out[key] = conv;
    } catch (e: any) {
      onWarn?.(`図表の変換に失敗（${asset.name}）: ${e?.message ?? e}`);
    }
  }
  return out;
}
