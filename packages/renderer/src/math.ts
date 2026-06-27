// LaTeX math -> self-contained SVG (via MathJax).
//
// We render to SVG (not KaTeX HTML+CSS) so equations embed with no font
// dependency and travel intact through every export (preview / HTML / SVG /
// PDF), matching the chart/diagram SVG pipeline. PPTX rasterizes like figures.
//
// Conversion is synchronous: the MathJax document is built once with a
// lite adaptor (works in both Node/CLI and the browser bundle), so renderMarkdown
// stays synchronous.

import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";

type MJDoc = ReturnType<typeof mathjax.document>;

let adaptor: ReturnType<typeof liteAdaptor> | null = null;
let mjDoc: MJDoc | null = null;

function getDoc(): MJDoc {
  if (!mjDoc) {
    adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);
    // tags 'ams' numbers equation/align/gather environments and enables
    // \tag{…} / \label / \eqref (within one equation block). Bare `$$…$$` /
    // `$…$` stay unnumbered. Cross-block \eqref is out of scope (each equation
    // is rendered independently). (E1)
    const tex = new TeX({ packages: AllPackages, tags: "ams" });
    // fontCache 'none' inlines every glyph as a direct <path> (no <defs>/<use>).
    // 'local' would reference glyphs via <use xlink:href="#…">, which the SVG
    // sanitizer strips — leaving the equation blank. 'none' is self-contained and
    // survives sanitization at the cost of slightly larger SVG.
    const svg = new SVG({ fontCache: "none" });
    mjDoc = mathjax.document("", { InputJax: tex, OutputJax: svg });
  }
  return mjDoc;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Render a LaTeX string to an SVG element string. On a parse error returns a
 * small inline error marker rather than throwing (so one bad formula never
 * breaks the whole block).
 */
export function texToSvg(tex: string, display: boolean): string {
  const src = (tex ?? "").trim();
  if (!src) return "";
  try {
    const doc = getDoc();
    const node = doc.convert(src, { display });
    // innerHTML of the mjx-container is the <svg>…</svg> (carries its own
    // vertical-align for inline use).
    return adaptor!.innerHTML(node);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return `<span class="rps-math-error" title="${escapeHtml(msg)}">$${escapeHtml(src)}$</span>`;
  }
}
