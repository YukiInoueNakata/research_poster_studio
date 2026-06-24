// Fancy ordered lists + auto-renumbering (設計: Pandoc fancy_lists に準拠＋拡張).
//
// Markdown's `marked` only understands `1.` / `1)` ordered lists. Authors often
// want other markers and "type the same marker, get a clean sequence":
//   (1) (1) (1)   -> (1) (2) (3)
//   a) a) a)      -> a) b) c)
//   i. i. i.      -> i. ii. iii.
//   ① ① ①        -> ① ② ③       (extension: circled)
//   ア．ア．        -> ア． イ．      (extension: kana, requires a delimiter)
//   一、一、        -> 一、 二、      (extension: kanji)
//   #. #. #.      -> 1. / 1.1 / ... (Pandoc auto-number; hierarchical when nested)
//
// We detect such list blocks, renumber each level, and emit an <ul> with an
// explicit marker span per item (list-style:none) so the exact style is kept.
// Plain `1.` decimal lists are left to `marked` (it already auto-renumbers).
// Markers are computed from position, so the typed numbers are irrelevant.

type Style =
  | "paren-dec"
  | "rparen-dec"
  | "paren-alpha-lower"
  | "paren-alpha-upper"
  | "rparen-alpha-lower"
  | "rparen-alpha-upper"
  | "dot-alpha-lower"
  | "dot-alpha-upper"
  | "roman-lower"
  | "roman-upper"
  | "circled"
  | "kana-katakana"
  | "kana-hiragana"
  | "kanji"
  | "outline";

interface Item {
  indent: number;
  style: Style;
  /** explicit starting number for the first decimal item (else 1) */
  start: number;
  text: string;
  children: Item[];
}

const ROMAN_RE = /^m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/;

function isRoman(s: string): boolean {
  return s.length > 0 && ROMAN_RE.test(s.toLowerCase());
}

function toRoman(n: number, upper: boolean): string {
  if (n < 1 || n > 3999) return String(n);
  const table: [number, string][] = [
    [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"],
    [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
  ];
  let out = "";
  let v = n;
  for (const [val, sym] of table) while (v >= val) (out += sym), (v -= val);
  return upper ? out.toUpperCase() : out;
}

function toAlpha(n: number, upper: boolean): string {
  if (n < 1 || n > 26) return String(n);
  const c = String.fromCharCode(96 + n);
  return upper ? c.toUpperCase() : c;
}

function toCircled(n: number): string {
  return n >= 1 && n <= 20 ? String.fromCodePoint(0x2460 + n - 1) : `(${n})`;
}

const KATAKANA = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン".split("");
const HIRAGANA = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん".split("");

function toKanji(n: number): string {
  const d = "〇一二三四五六七八九";
  if (n < 1) return String(n);
  if (n <= 10) return n < 10 ? d[n] : "十";
  if (n < 20) return "十" + (n % 10 === 0 ? "" : d[n % 10]);
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return d[t] + "十" + (o === 0 ? "" : d[o]);
  }
  return String(n);
}

/** Format the marker text for a 1-based index in a given style. */
function formatMarker(style: Style, index: number, start: number): string {
  const n = start - 1 + index;
  switch (style) {
    case "paren-dec": return `(${n})`;
    case "rparen-dec": return `${n})`;
    case "paren-alpha-lower": return `(${toAlpha(index, false)})`;
    case "paren-alpha-upper": return `(${toAlpha(index, true)})`;
    case "rparen-alpha-lower": return `${toAlpha(index, false)})`;
    case "rparen-alpha-upper": return `${toAlpha(index, true)})`;
    case "dot-alpha-lower": return `${toAlpha(index, false)}.`;
    case "dot-alpha-upper": return `${toAlpha(index, true)}.`;
    case "roman-lower": return `${toRoman(index, false)}.`;
    case "roman-upper": return `${toRoman(index, true)}.`;
    case "circled": return toCircled(index);
    case "kana-katakana": return `${KATAKANA[index - 1] ?? `(${index})`}．`;
    case "kana-hiragana": return `${HIRAGANA[index - 1] ?? `(${index})`}．`;
    case "kanji": return `${toKanji(index)}、`;
    default: return `${n}.`;
  }
}

/** Try to match a fancy list marker at the start of `s` (after indent). */
function matchMarker(s: string): { style: Style; start: number; rest: string } | null {
  let m: RegExpExecArray | null;
  // outline auto-number: #.
  if ((m = /^#\.[ \t]+(.*)$/.exec(s))) return { style: "outline", start: 1, rest: m[1] };
  // (n) / n)
  if ((m = /^\((\d+)\)[ \t]+(.*)$/.exec(s))) return { style: "paren-dec", start: +m[1], rest: m[2] };
  if ((m = /^(\d+)\)[ \t]+(.*)$/.exec(s))) return { style: "rparen-dec", start: +m[1], rest: m[2] };
  // (x) / (X)
  if ((m = /^\(([a-z])\)[ \t]+(.*)$/.exec(s))) return { style: "paren-alpha-lower", start: 1, rest: m[2] };
  if ((m = /^\(([A-Z])\)[ \t]+(.*)$/.exec(s))) return { style: "paren-alpha-upper", start: 1, rest: m[2] };
  // dot/paren forms with a letter token: decide roman vs single-alpha
  if ((m = /^([A-Za-z]+)([.)])[ \t]+(.*)$/.exec(s))) {
    const token = m[1];
    const delim = m[2];
    const upper = token === token.toUpperCase();
    if (isRoman(token) && token.length >= 1 && /^[ivxlcdmIVXLCDM]+$/.test(token)) {
      if (delim === ".") return { style: upper ? "roman-upper" : "roman-lower", start: 1, rest: m[3] };
    }
    if (token.length === 1) {
      if (delim === ")") return { style: upper ? "rparen-alpha-upper" : "rparen-alpha-lower", start: 1, rest: m[3] };
      return { style: upper ? "dot-alpha-upper" : "dot-alpha-lower", start: 1, rest: m[3] };
    }
    return null;
  }
  // circled ①..⑳ (delimiter optional)
  if ((m = /^[①-⑳][ \t]*(.*)$/.exec(s))) return { style: "circled", start: 1, rest: m[1] };
  // kana / kanji require an explicit delimiter to avoid matching prose
  if ((m = /^[ァ-ヶ][.)．）、][ \t]*(.*)$/.exec(s))) return { style: "kana-katakana", start: 1, rest: m[1] };
  if ((m = /^[ぁ-ゖ][.)．）、][ \t]*(.*)$/.exec(s))) return { style: "kana-hiragana", start: 1, rest: m[1] };
  if ((m = /^[一二三四五六七八九十]+[.)．）、][ \t]*(.*)$/.exec(s))) return { style: "kanji", start: 1, rest: m[1] };
  return null;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Build a nested item tree from a flat run of marked lines (by indent). */
function buildTree(flat: { indent: number; style: Style; start: number; text: string }[]): Item[] {
  const roots: Item[] = [];
  const stack: Item[] = [];
  for (const f of flat) {
    const item: Item = { ...f, children: [] };
    while (stack.length && stack[stack.length - 1].indent >= f.indent) stack.pop();
    if (stack.length === 0) roots.push(item);
    else stack[stack.length - 1].children.push(item);
    stack.push(item);
  }
  return roots;
}

function renderList(items: Item[], renderInline: (s: string) => string, prefix: string): string {
  if (items.length === 0) return "";
  const style = items[0].style;
  const start = items[0].start;
  const li = items
    .map((it, i) => {
      const idx = i + 1;
      const marker =
        style === "outline" ? `${prefix}${idx}` : formatMarker(style, idx, start);
      const childPrefix = style === "outline" ? `${prefix}${idx}.` : prefix;
      const inner = renderInline(it.text);
      const nested = it.children.length ? renderList(it.children, renderInline, childPrefix) : "";
      return `<li><span class="rps-li-marker">${escapeAttr(marker)}</span> ${inner}${nested}</li>`;
    })
    .join("");
  return `<ul class="rps-fancy-list">${li}</ul>`;
}

/**
 * Replace fancy-marker list blocks in `src` with rendered HTML <ul> blocks
 * (auto-renumbered). `renderInline` turns item text into inline HTML.
 */
export function preprocessFancyLists(src: string, renderInline: (s: string) => string): string {
  const lines = (src ?? "").split(/\r?\n/);
  const out: string[] = [];
  let fence: string | null = null;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fm = /^[ \t]*(```+|~~~+)/.exec(line);
    if (fm) {
      const marker = fm[1][0].repeat(3);
      if (fence == null) fence = marker;
      else if (line.trimStart().startsWith(fence)) fence = null;
      out.push(line);
      i++;
      continue;
    }
    if (fence == null) {
      const indentMatch = /^([ \t]*)(.*)$/.exec(line)!;
      const marker = matchMarker(indentMatch[2]);
      if (marker) {
        // collect a contiguous run of fancy-marker lines
        const flat: { indent: number; style: Style; start: number; text: string }[] = [];
        let j = i;
        while (j < lines.length) {
          const im = /^([ \t]*)(.*)$/.exec(lines[j])!;
          const ind = im[1].replace(/\t/g, "    ").length;
          const mk = matchMarker(im[2]);
          if (!mk) break;
          flat.push({ indent: ind, style: mk.style, start: mk.start, text: mk.rest });
          j++;
        }
        const isCjk = (s: Style) => s === "kana-katakana" || s === "kana-hiragana" || s === "kanji";
        // guard CJK false positives: only treat as a list if 2+ items
        if (!(isCjk(flat[0].style) && flat.length < 2)) {
          const tree = buildTree(flat);
          out.push("", renderList(tree, renderInline, ""), "");
          i = j;
          continue;
        }
      }
    }
    out.push(line);
    i++;
  }
  return out.join("\n");
}

/** CSS for fancy lists (hanging indent + explicit marker). */
export function fancyListCss(paraMm: number): string {
  return [
    `.rps-fancy-list{ list-style:none; margin:0 0 var(--rps-para, ${paraMm}mm); padding-left:0; }`,
    `.rps-fancy-list li{ padding-left:1.9em; }`,
    `.rps-fancy-list li > .rps-li-marker{ display:inline-block; width:1.9em; margin-left:-1.9em; }`,
    `.rps-fancy-list .rps-fancy-list{ margin:1mm 0 0; padding-left:1.6em; }`,
  ].join("");
}
