// Print-to-PDF. Windows (WebView2) and Linux (WebKitGTK) print a hidden iframe;
// the print dialog offers "Save as PDF" and the export HTML declares the
// @page size (設計書 §12.3), giving an exact A0/A1 PDF. macOS WKWebView ignores
// iframe printing, so it uses the native webview print (see below).

import { invoke } from "@tauri-apps/api/core";
import { posterSizeMm, type PosterProject } from "@rps/core";
import { buildHtml, type RenderMarkupOptions } from "@rps/renderer";

/** macOS WKWebView ignores window.print() inside an iframe (nothing happens). */
const IS_MAC = typeof navigator !== "undefined" && /Macintosh|Mac OS X/.test(navigator.userAgent);

/**
 * macOS path: put the export markup into a print-only root of the app page
 * (its CSS confined to @media print, so the screen is untouched) and ask the
 * native webview to print. The root stays hidden on screen and is replaced on
 * the next print, because the native print sheet runs asynchronously.
 */
async function printViaNativeWebview(html: string): Promise<void> {
  mountPrintRoot(html);
  await new Promise((r) => setTimeout(r, 300)); // let images decode / layout settle
  await invoke("print_webview");
}

/**
 * macOS: save the poster straight to a PDF of its own size (no print panel).
 * The print panel offers no paper size on a Mac without printers, so the
 * poster was split over A4 pages (macOS 26, 2026-10-19).
 *
 * WebKit's createPDF writes CSS px as PDF points, so for the capture the page
 * shows only the poster, zoomed by 72/96 (= mm * 72 / 25.4 pt per side); the
 * app's UI is hidden for that moment and restored afterwards.
 */
export async function savePosterPdfMac(
  project: PosterProject,
  path: string,
  opts?: RenderMarkupOptions,
): Promise<void> {
  const doc = new DOMParser().parseFromString(buildHtml(project, opts), "text/html");
  const css = Array.from(doc.querySelectorAll("style")).map((s) => s.textContent ?? "").join("\n");
  const { w, h } = posterSizeMm(project.doc.project);
  const pt = (mm: number) => (mm * 72) / 25.4;
  const style = document.createElement("style");
  style.id = "rps-pdf-style";
  style.textContent =
    `${css}\n` +
    `html,body{margin:0!important;padding:0!important;overflow:visible!important;height:auto!important;background:#fff!important}\n` +
    `body>*:not(#rps-pdf-root){display:none!important}\n` +
    `#rps-pdf-root{display:block!important;zoom:0.75;width:max-content}`;
  const root = document.createElement("div");
  root.id = "rps-pdf-root";
  root.innerHTML = doc.body.innerHTML;
  document.head.appendChild(style);
  document.body.appendChild(root);
  try {
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 500)); // images decode, layout settles
    const [wp, hp] = [pt(w), pt(h)];
    // a poster smaller than the window would otherwise get the window's blank area
    const rect = wp < window.innerWidth || hp < window.innerHeight ? [wp, hp] : null;
    await invoke("save_webview_pdf", { path, rect });
  } finally {
    root.remove();
    style.remove();
  }
}

export const IS_MAC_DESKTOP = IS_MAC;

/** Put the export markup in a print-only root (CSS confined to @media print). */
function mountPrintRoot(html: string): void {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const css = Array.from(doc.querySelectorAll("style")).map((s) => s.textContent ?? "").join("\n");
  document.getElementById("rps-print-root")?.remove();
  document.getElementById("rps-print-style")?.remove();
  const style = document.createElement("style");
  style.id = "rps-print-style";
  style.textContent =
    `#rps-print-root{display:none}\n@media print{\n${css}\n` +
    `html,body,#root{height:auto!important;overflow:visible!important;background:#fff!important;margin:0!important;padding:0!important}\n` +
    `body>*:not(#rps-print-root){display:none!important}\n#rps-print-root{display:block!important}\n}`;
  const root = document.createElement("div");
  root.id = "rps-print-root";
  root.innerHTML = doc.body.innerHTML;
  document.head.appendChild(style);
  document.body.appendChild(root);
}

export function printPoster(project: PosterProject, opts?: RenderMarkupOptions): Promise<void> {
  if (IS_MAC) return printViaNativeWebview(buildHtml(project, opts));
  return new Promise((resolve) => {
    const html = buildHtml(project, opts);
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const cw = iframe.contentWindow!;
    cw.document.open();
    cw.document.write(html);
    cw.document.close();
    // Guard against firing twice: both iframe.onload and the fallback timer can
    // race, which previously opened the print dialog two times.
    let printed = false;
    const doPrint = () => {
      if (printed) return;
      printed = true;
      try {
        cw.focus();
        cw.print();
      } finally {
        setTimeout(() => {
          iframe.remove();
          resolve();
        }, 500);
      }
    };
    // data-URI images load synchronously enough; wait a tick for layout
    iframe.onload = () => setTimeout(doPrint, 200);
    // fallback if onload doesn't fire
    setTimeout(doPrint, 800);
  });
}
