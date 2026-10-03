// Print-to-PDF. Windows (WebView2) and Linux (WebKitGTK) print a hidden iframe;
// the print dialog offers "Save as PDF" and the export HTML declares the
// @page size (設計書 §12.3), giving an exact A0/A1 PDF. macOS WKWebView ignores
// iframe printing, so it uses the native webview print (see below).

import { invoke } from "@tauri-apps/api/core";
import type { PosterProject } from "@rps/core";
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
  await new Promise((r) => setTimeout(r, 300)); // let images decode / layout settle
  await invoke("print_webview");
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
