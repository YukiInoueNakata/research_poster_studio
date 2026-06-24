// Print-to-PDF via a hidden iframe. The webview's print dialog offers
// "Save as PDF" / "Microsoft Print to PDF", producing an exact A0/A1 PDF
// because the export HTML declares @page size (設計書 §12.3). Cross-platform:
// works on the WebView2 / WebKit / WKWebView backends Tauri uses.

import type { PosterProject } from "@rps/core";
import { buildHtml, type RenderMarkupOptions } from "@rps/renderer";

export function printPoster(project: PosterProject, opts?: RenderMarkupOptions): Promise<void> {
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
