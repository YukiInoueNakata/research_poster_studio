// @rps/exporter — turn self-contained poster HTML (from @rps/renderer) into
// PDF / PNG via headless Chromium (Playwright). The HTML declares @page with
// the A0/A1 size, so `preferCSSPageSize` yields an exactly-sized PDF.
//
// Requires the Chromium browser: run `npx playwright install chromium` once.

import { chromium } from "playwright";

async function withPage<T>(html: string, fn: (page: import("playwright").Page) => Promise<T>): Promise<T> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    return await fn(page);
  } finally {
    await browser.close();
  }
}

/** Render print-ready HTML to a PDF file at its CSS @page size (A0/A1). */
export async function htmlToPdf(html: string, outPath: string): Promise<void> {
  await withPage(html, async (page) => {
    await page.pdf({
      path: outPath,
      printBackground: true,
      preferCSSPageSize: true,
    });
  });
}

/** Render the poster element to a PNG file. */
export async function htmlToPng(
  html: string,
  outPath: string,
  opts: { scale?: number } = {},
): Promise<void> {
  await withPage(html, async (page) => {
    if (opts.scale && opts.scale !== 1) {
      await page.evaluate((s) => {
        const root = document.querySelector(".rps-poster") as HTMLElement | null;
        if (root) root.style.zoom = String(s);
      }, opts.scale);
    }
    const el = await page.$(".rps-poster");
    if (el) {
      await el.screenshot({ path: outPath });
    } else {
      await page.screenshot({ path: outPath, fullPage: true });
    }
  });
}

export const RPS_EXPORTER_VERSION = "0.1.0";
