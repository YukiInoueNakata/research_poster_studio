// Markdown -> sanitized HTML for block bodies.
//
// We allow a small set of inline HTML (underline, colored spans, sub/sup, mark)
// on top of standard Markdown, matching 設計書 §9.4. Role-based colors are
// expressed as <span class="role-accent"> etc. and mapped to theme colors.
//
// Fenced code blocks get special treatment (設計書 §10.1 将来対応分):
//   ```csv      -> 簡易表（<table class="rps-table">，1 行目をヘッダー扱い）
//   ```mermaid  -> 図（環境依存レンダラを DiagramResolver 経由で注入）
//   ```dot / ```graphviz -> 図（同上．Graphviz）
// Diagram SVG is spliced in after sanitization (and sanitized itself with the
// SVG profile) so DOMPurify's HTML pass doesn't mangle it.

import DOMPurify from "isomorphic-dompurify";
import { Marked } from "marked";
import type { DiagramResolver, ThemeColors } from "@rps/core";
import { diagramKindOf, parseCsv } from "@rps/core";
import { preprocessFancyLists } from "./fancyLists";
import { parseChartSpec, chartSvg } from "./chart";

const ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s", "del", "ins", "mark",
  "sub", "sup", "span", "a", "ul", "ol", "li", "blockquote", "code", "pre",
  "h1", "h2", "h3", "h4", "h5", "h6", "table", "thead", "tbody", "tr", "th",
  "td", "hr", "small", "abbr", "div",
];

const ALLOWED_ATTR = [
  "class", "style", "href", "title", "colspan", "rowspan", "data-rps-slot",
];

export interface MarkdownOptions {
  /** returns rendered SVG/HTML for a diagram fence, or undefined when pending */
  diagram?: DiagramResolver;
  /** theme colors used to draw ```chart fences (N3) */
  colors?: ThemeColors;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Render CSV text as a simple table (first row = header). */
export function csvTableHtml(text: string): string {
  const rows = parseCsv(text);
  if (rows.length === 0) return "";
  const head = rows[0];
  const body = rows.slice(1);
  const tr = (cells: string[], tag: "th" | "td") =>
    `<tr>${cells.map((c) => `<${tag}>${escapeHtml(c)}</${tag}>`).join("")}</tr>`;
  return (
    `<table class="rps-table"><thead>${tr(head, "th")}</thead>` +
    `<tbody>${body.map((r) => tr(r, "td")).join("")}</tbody></table>`
  );
}

// per-parse state for the (synchronous) marked run
let currentOpts: MarkdownOptions = {};
let diagramSlots: string[] = [];

const md = new Marked({ gfm: true, breaks: true });
// N9 callout boxes: Pandoc-style fenced divs `::: note` … `:::` become
// <div class="rps-callout rps-callout-<name>">, styled in posterCss (tinted
// box with a left accent bar). The body inside is parsed as normal Markdown.
md.use({
  extensions: [
    {
      name: "calloutDiv",
      level: "block",
      start(src: string) {
        const m = /^:::/m.exec(src);
        return m ? m.index : undefined;
      },
      tokenizer(this: any, src: string) {
        const m = /^::: *([A-Za-z0-9_-]+|\{[^}]*\})? *\n([\s\S]*?)\n::: *(?:\n+|$)/.exec(src);
        if (!m) return undefined;
        const cls = (m[1] ?? "note").replace(/[{}.#]/g, "").trim() || "note";
        const token: any = { type: "calloutDiv", raw: m[0], cls, tokens: [] };
        this.lexer.blockTokens(m[2], token.tokens);
        return token;
      },
      renderer(this: any, token: any) {
        const cls = String(token.cls).replace(/[^A-Za-z0-9_-]/g, "");
        return `<div class="rps-callout rps-callout-${cls}">${this.parser.parse(token.tokens)}</div>`;
      },
    },
  ],
});
md.use({
  renderer: {
    code(token) {
      const lang = (token.lang ?? "").trim().toLowerCase();
      if (lang === "csv") return csvTableHtml(token.text);
      if (lang === "chart" && currentOpts.colors) {
        const svg = chartSvg(parseChartSpec(token.text), currentOpts.colors);
        diagramSlots.push(svg);
        return `<div class="rps-diagram rps-chart" data-rps-slot="${diagramSlots.length - 1}"></div>`;
      }
      const kind = diagramKindOf(lang);
      if (kind) {
        const rendered = currentOpts.diagram?.(kind, token.text);
        diagramSlots.push(
          rendered !== undefined
            ? rendered
            : `<div class="rps-diagram-pending">（${kind} 図は未生成です）</div>`,
        );
        return `<div class="rps-diagram" data-rps-slot="${diagramSlots.length - 1}"></div>`;
      }
      return false; // default code rendering
    },
  },
});

export function renderMarkdown(src: string, opts?: MarkdownOptions): string {
  currentOpts = opts ?? {};
  diagramSlots = [];
  // fancy ordered lists ((1) / a) / ① / ア． / #. …) -> auto-renumbered <ul>
  const pre = preprocessFancyLists(
    src ?? "",
    (t) => md.parseInline(t, { async: false }) as string,
  );
  const rawHtml = md.parse(pre, { async: false }) as string;
  const slots = diagramSlots;
  currentOpts = {};
  diagramSlots = [];
  const clean = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // allow data: nothing; keep simple inline styles (color) only
  });
  if (slots.length === 0) return clean;
  return clean.replace(
    /<div\b[^>]*data-rps-slot="(\d+)"[^>]*><\/div>/g,
    (_m, n: string) => {
      const inner = slots[Number(n)] ?? "";
      const safe = DOMPurify.sanitize(inner, {
        USE_PROFILES: { html: true, svg: true, svgFilters: true },
        ADD_TAGS: ["foreignObject"],
        ADD_ATTR: ["dominant-baseline", "transform-origin"],
      });
      return `<div class="rps-diagram">${safe}</div>`;
    },
  );
}

/**
 * Map role-based span classes (warning/accent/muted) to inline colors so the
 * exported HTML/SVG/PPTX is self-contained.
 */
export function roleColorCss(colors: ThemeColors): string {
  return [
    `.role-accent{color:${colors.accent};}`,
    `.role-warning,.warning{color:${colors.warning};}`,
    `.role-muted,.muted{color:${colors.muted};}`,
    `.role-heading{color:${colors.heading};}`,
  ].join("");
}
