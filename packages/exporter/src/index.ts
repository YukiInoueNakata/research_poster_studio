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

export interface OverflowReport {
  /** content height vs page height (mm) when the poster is taller than its page */
  page: { contentMm: number; pageMm: number } | null;
  /** ids of blocks whose content is taller than the block box */
  blocks: string[];
  /** requested font families not installed here (text falls back to another font) */
  missingFonts: string[];
}

/**
 * Lay the poster out in headless Chromium and report overflow, using the same
 * rule as the desktop preview (scrollHeight > clientHeight + 2px).
 */
export async function measureOverflow(html: string): Promise<OverflowReport> {
  return withPage(html, (page) =>
    page.evaluate(() => {
      const pxToMm = (px: number) => Math.round((px * 25.4) / 96);
      const root = document.querySelector("[data-poster-root]") as HTMLElement | null;
      if (!root) return { page: null, blocks: [], missingFonts: [] };
      const pageOver = root.scrollHeight > root.clientHeight + 2;
      const blocks: string[] = [];
      root.querySelectorAll<HTMLElement>("[data-block-id]").forEach((el) => {
        const id = el.getAttribute("data-block-id")!;
        if (id !== "__header__" && el.scrollHeight > el.clientHeight + 2) blocks.push(id);
      });
      // A family that renders exactly like the generic fallback is not installed.
      // (document.fonts.check() reports system fonts as available, so measure.)
      const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-.*|emoji|math|fangsong)$/i;
      // The author's list ends where the renderer's own fallbacks begin (fontStack
      // appends "Hiragino ..."): a poster may list metric-compatible alternatives
      // (Arial, Helvetica, Liberation Sans), and is fine if any one of them exists.
      const FALLBACK = /^(Hiragino Sans|Hiragino Mincho ProN)$/i;
      const lists = new Map<string, string[]>();
      root.querySelectorAll<HTMLElement>("*").forEach((el) => {
        const all = getComputedStyle(el).fontFamily.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
        const own: string[] = [];
        for (const f of all) { if (!f || GENERIC.test(f) || FALLBACK.test(f)) break; own.push(f); }
        if (own.length) lists.set(own.join(","), own);
      });
      const ctx = document.createElement("canvas").getContext("2d")!;
      const sample = "mmmmmmmmmmlli1WWあいう漢字";
      const width = (font: string) => {
        ctx.font = `72px ${font}`;
        return ctx.measureText(sample).width;
      };
      const absent = (f: string) => ["monospace", "serif"].every((g) => width(`"${f}", ${g}`) === width(g));
      const missingFonts = [...new Set([...lists.values()].filter((own) => own.every(absent)).map((own) => own[0]))];
      return {
        page: pageOver ? { contentMm: pxToMm(root.scrollHeight), pageMm: pxToMm(root.clientHeight) } : null,
        blocks,
        missingFonts,
      };
    }),
  );
}

export const RPS_EXPORTER_VERSION = "0.1.3";
