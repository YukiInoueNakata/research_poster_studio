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
import { texToSvg } from "./math";
import { parseQrSpec, qrSvg } from "./qr";

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

/** Allow only safe colour values (hex / rgb[a] / plain named) for inline style. */
function safeColor(v: string | undefined): string | null {
  const c = (v ?? "").trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(c)) return c;
  if (/^rgba?\([\d.,\s%]+\)$/.test(c)) return c;
  if (/^[a-zA-Z]{1,20}$/.test(c)) return c;
  return null;
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
        // `::: <type> [label...]` — type = note/warning/muted/heading; the rest
        // of the line is an optional label rendered as a tab chip (N14, for the
        // "Important / Challenge 1 / Main Idea" boxes common in STEM posters).
        // `theorem` / `boxed` render the label as a full-width title BAR instead
        // (amsthm-style). Colours via `::: {theorem title_bg=#1c3d5a title_color=#fff bg=#eef} Theorem 1`.
        const m = /^::: *([A-Za-z0-9_-]+|\{[^}]*\})?[ \t]*([^\n]*)\n([\s\S]*?)\n::: *(?:\n+|$)/.exec(src);
        if (!m) return undefined;
        let cls = "note";
        const attrs: Record<string, string> = {};
        const head = (m[1] ?? "").trim();
        if (head.startsWith("{")) {
          const parts = head.replace(/^\{|\}$/g, "").trim().split(/\s+/);
          cls = (parts.shift() ?? "note").replace(/[.#]/g, "") || "note";
          for (const p of parts) {
            const i = p.indexOf("=");
            if (i > 0) attrs[p.slice(0, i)] = p.slice(i + 1);
          }
        } else {
          cls = head.replace(/[{}.#]/g, "") || "note";
        }
        const label = (m[2] ?? "").trim();
        const token: any = { type: "calloutDiv", raw: m[0], cls, label, attrs, tokens: [] };
        this.lexer.blockTokens(m[3], token.tokens);
        return token;
      },
      renderer(this: any, token: any) {
        const cls = String(token.cls).replace(/[^A-Za-z0-9_-]/g, "");
        const label = String(token.label ?? "").trim();
        const a = (token.attrs ?? {}) as Record<string, string>;
        const banner = cls === "theorem" || cls === "boxed" || a.title_full_width === "true";
        const sty = (pairs: [string, string | undefined][]) => {
          const css = pairs
            .map(([k, v]) => (v && safeColor(v) ? `${k}:${safeColor(v)}` : ""))
            .filter(Boolean)
            .join(";");
          return css ? ` style="${css}"` : "";
        };
        let head = "";
        if (label && banner) {
          head = `<div class="rps-callout-title"${sty([["background", a.title_bg], ["color", a.title_color]])}>${escapeHtml(label)}</div>`;
        } else if (label) {
          head = `<span class="rps-callout-label">${escapeHtml(label)}</span>`;
        }
        const variant = banner ? " rps-callout-banner" : label ? " rps-callout-labeled" : "";
        const boxStyle = sty([["background", a.bg], ["border-color", a.border]]);
        return `<div class="rps-callout rps-callout-${cls}${variant}"${boxStyle}>${head}${this.parser.parse(token.tokens)}</div>`;
      },
    },
  ],
});
// LaTeX math: `$$…$$` / `\[…\]` => display (block), `$…$` / `\(…\)` => inline.
// Rendered to self-contained SVG (math.ts) and spliced like diagrams so the
// restrictive HTML sanitize pass keeps the SVG intact. `$…$` follows Pandoc
// rules (no space just inside; closing `$` not before a digit) so currency
// like "$5 and $10" is not mistaken for math; escape a literal dollar as `\$`.
md.use({
  extensions: [
    {
      name: "rpsMathBlock",
      level: "block",
      start(src: string) {
        const m = /\$\$|\\\[/.exec(src);
        return m ? m.index : undefined;
      },
      tokenizer(_src: string) {
        let m = /^\$\$([\s\S]+?)\$\$/.exec(_src);
        if (!m) m = /^\\\[([\s\S]+?)\\\]/.exec(_src);
        if (!m) return undefined;
        return { type: "rpsMathBlock", raw: m[0], tex: m[1] } as any;
      },
      renderer(token: any) {
        diagramSlots.push(texToSvg(String(token.tex), true));
        return `<div class="rps-math-display" data-rps-slot="${diagramSlots.length - 1}"></div>`;
      },
    },
    {
      name: "rpsMathInline",
      level: "inline",
      start(src: string) {
        const m = /\$|\\\(/.exec(src);
        return m ? m.index : undefined;
      },
      tokenizer(_src: string) {
        let m = /^\\\(([\s\S]+?)\\\)/.exec(_src);
        if (m) return { type: "rpsMathInline", raw: m[0], tex: m[1] } as any;
        m = /^\$(?![\s$])((?:\\\$|[^$\n])+?)\$(?!\d)/.exec(_src);
        if (m && /\S$/.test(m[1])) {
          return { type: "rpsMathInline", raw: m[0], tex: m[1].replace(/\\\$/g, "$") } as any;
        }
        return undefined;
      },
      renderer(token: any) {
        diagramSlots.push(texToSvg(String(token.tex), false));
        return `<span class="rps-math" data-rps-slot="${diagramSlots.length - 1}"></span>`;
      },
    },
    {
      // A3: inline coloured chip / tag pill — `[label]{role}` or `[label]{#hex}`.
      // role = a theme role (accent/warning/muted/heading) → class; `#hex` → style.
      name: "rpsChip",
      level: "inline",
      start(src: string) {
        const m = /\[[^\]\n]+\]\{\.?[A-Za-z0-9_#-]+\}/.exec(src);
        return m ? m.index : undefined;
      },
      tokenizer(_src: string) {
        const m = /^\[([^\]\n]+)\]\{\.?([A-Za-z0-9_#-]+)\}/.exec(_src);
        if (!m) return undefined;
        return { type: "rpsChip", raw: m[0], label: m[1], role: m[2] } as any;
      },
      renderer(token: any) {
        const role = String(token.role);
        const label = escapeHtml(String(token.label));
        if (role.startsWith("#") && safeColor(role)) {
          return `<span class="rps-chip" style="background:${role}">${label}</span>`;
        }
        const safe = role.replace(/[^A-Za-z0-9_-]/g, "") || "accent";
        return `<span class="rps-chip rps-chip-${safe}">${label}</span>`;
      },
    },
  ],
});
md.use({
  renderer: {
    code(token) {
      const lang = (token.lang ?? "").trim().toLowerCase();
      if (lang === "csv") return csvTableHtml(token.text);
      if (lang === "qr") {
        diagramSlots.push(qrSvg(parseQrSpec(token.text)));
        return `<div class="rps-qr" data-rps-slot="${diagramSlots.length - 1}"></div>`;
      }
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
    // N15: a table cell wrapped in ==…== renders highlighted (best-value box),
    // e.g. `| ==**0.79**== |`. Other cells render normally.
    tablecell(this: any, token: any) {
      const inner = this.parser.parseInline(token.tokens);
      const tag = token.header ? "th" : "td";
      const align = token.align ? ` style="text-align:${token.align}"` : "";
      const m = /^\s*==([\s\S]*?)==\s*$/.exec(inner);
      if (m) return `<${tag} class="rps-cell-hl"${align}>${m[1]}</${tag}>`;
      return `<${tag}${align}>${inner}</${tag}>`;
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
  // Splice the held SVG/HTML back into its slot, preserving the placeholder's
  // tag (div = block diagram/chart/display-math, span = inline math) and class.
  return clean.replace(
    /<(div|span)\b([^>]*?)data-rps-slot="(\d+)"([^>]*?)><\/\1>/g,
    (_m, tag: string, pre: string, n: string, post: string) => {
      const inner = slots[Number(n)] ?? "";
      const safe = DOMPurify.sanitize(inner, {
        USE_PROFILES: { html: true, svg: true, svgFilters: true },
        ADD_TAGS: ["foreignObject"],
        ADD_ATTR: ["dominant-baseline", "transform-origin"],
      });
      const clsMatch = (pre + post).match(/class="([^"]*)"/);
      const cls = clsMatch ? clsMatch[1] : tag === "span" ? "rps-math" : "rps-diagram";
      return `<${tag} class="${cls}">${safe}</${tag}>`;
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
