// Proofreading mode (校正モード) support.
//
// Extracts every piece of human-readable text in the poster as a flat list in
// *reading order* (header top-to-bottom, then bands; inside a band the columns
// run left -> center -> right; child blocks recurse the same way). The desktop
// GUI renders this list as a 1-column read-through view with in-place editing.
//
// Also provides a lightweight 表記ゆれ (notation consistency) check:
//   - 、。 vs ，． punctuation mixing across the whole poster
//   - half-width parentheses adjacent to Japanese characters
//   - half-width ? / ! adjacent to Japanese characters
//   - full-width vs half-width Latin letters / digits mixing, with a
//     markdown-safe unifier (unifyAlnumWidth) to convert to either style
// This is intentionally heuristic — no spell checking, no grammar.

import type { Block, Figure, PosterDoc } from "./types";
import { computeBands, computeChildBands, type Band } from "./layout";

// ---- proof items -----------------------------------------------------------

/** What a ProofItem edits when the user changes its text. */
export type ProofTarget =
  | { type: "meta-title" }
  | { type: "meta-subtitle" }
  | { type: "conference-name" }
  | { type: "conference-date" }
  | { type: "author"; index: number }
  | { type: "affiliation"; index: number }
  | { type: "keyword"; index: number }
  | { type: "block-title"; blockId: string }
  | { type: "block-body"; blockId: string }
  | { type: "figure-caption"; figureId: string };

export interface ProofItem {
  /** stable id, e.g. "meta-title", "body:intro", "caption:fig1" */
  id: string;
  /** display label, e.g. 本文「はじめに」 */
  label: string;
  /** current text (markdown for block bodies) */
  text: string;
  /** render as a multi-line editor */
  multiline: boolean;
  target: ProofTarget;
}

const JP = "\\u3040-\\u30ff\\u4e00-\\u9fff";

function item(
  id: string,
  label: string,
  text: string,
  multiline: boolean,
  target: ProofTarget,
): ProofItem {
  return { id, label, text, multiline, target };
}

/** Figures rendered inside a block (same rule as the renderer). */
function figuresForBlock(doc: PosterDoc, block: Block): Figure[] {
  return doc.figures
    .filter((f) => f.block === block.id || (block.figures ?? []).includes(f.id))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * All poster text in reading order. `content` is the markdown map keyed by
 * block id (PosterProject.content). Hidden blocks are skipped — the view is a
 * read-through of the poster as displayed.
 */
export function proofItems(doc: PosterDoc, content: Record<string, string>): ProofItem[] {
  const out: ProofItem[] = [];
  const seenFigures = new Set<string>();
  const p = doc.project;

  // ---- header ----
  if (p.conference?.name != null) {
    out.push(item("conf-name", "学会名", p.conference.name, false, { type: "conference-name" }));
  }
  if (p.conference?.date != null) {
    out.push(item("conf-date", "会期", p.conference.date, false, { type: "conference-date" }));
  }
  out.push(item("meta-title", "ポスタータイトル", p.title, true, { type: "meta-title" }));
  if (p.subtitle != null) {
    out.push(item("meta-subtitle", "サブタイトル", p.subtitle, true, { type: "meta-subtitle" }));
  }
  p.authors.forEach((a, i) => {
    out.push(item(`author:${i}`, `著者 ${i + 1}`, a.name, false, { type: "author", index: i }));
  });
  (p.affiliations ?? []).forEach((a, i) => {
    out.push(item(`affil:${i}`, `所属 ${i + 1}`, a, false, { type: "affiliation", index: i }));
  });
  (p.keywords ?? []).forEach((k, i) => {
    out.push(item(`keyword:${i}`, `キーワード ${i + 1}`, k, false, { type: "keyword", index: i }));
  });

  // ---- blocks (reading order via the band layout) ----
  const pushFigureCaption = (f: Figure) => {
    if (seenFigures.has(f.id)) return;
    seenFigures.add(f.id);
    out.push(
      item(`caption:${f.id}`, `図キャプション「${f.id}」`, f.caption ?? "", true, {
        type: "figure-caption",
        figureId: f.id,
      }),
    );
  };

  const visitBlock = (b: Block, parentName?: string) => {
    // synthesized children (<id>__text etc.) have no title — show the parent's
    const name =
      b.title.trim() !== "" ? b.title.replace(/\n/g, " ") : parentName ?? b.id;
    if (b.type === "figure" && b.figure_id) {
      if (b.title.trim() !== "") {
        out.push(item(`title:${b.id}`, `見出し「${name}」`, b.title, true, { type: "block-title", blockId: b.id }));
      }
      const f = doc.figures.find((x) => x.id === b.figure_id);
      if (f) pushFigureCaption(f);
      return;
    }
    if (b.title.trim() !== "") {
      out.push(item(`title:${b.id}`, `見出し「${name}」`, b.title, true, { type: "block-title", blockId: b.id }));
    }
    // body only when the block actually renders markdown (same rule as the
    // renderer) — container parents whose body moved to a __text child are
    // skipped, so the text appears once, at its child
    if (b.source !== undefined || content[b.id] !== undefined) {
      out.push(
        item(`body:${b.id}`, `本文「${name}」`, content[b.id] ?? "", true, {
          type: "block-body",
          blockId: b.id,
        }),
      );
    }
    for (const f of figuresForBlock(doc, b)) pushFigureCaption(f);
    if (b.children?.length) visitBands(computeChildBands(b), name);
  };

  const visitBands = (bands: Band[], parentName?: string) => {
    for (const band of bands) {
      if (band.kind === "wide") {
        visitBlock(band.block, parentName);
      } else {
        for (const col of band.columns) {
          for (const b of col.blocks) visitBlock(b, parentName);
        }
      }
    }
  };
  visitBands(computeBands(doc));

  return out;
}

// ---- 表記ゆれ簡易チェック ---------------------------------------------------

export type ProofWarningCode =
  | "punct-mix"
  | "paren-width"
  | "punct-width"
  | "alpha-width"
  | "digit-width";

export interface ProofWarning {
  code: ProofWarningCode;
  message: string;
  /** ProofItem ids containing the offending text (jump targets in the GUI) */
  itemIds: string[];
}

function countChars(text: string, chars: string): number {
  let n = 0;
  for (const ch of text) if (chars.includes(ch)) n++;
  return n;
}

// ---- full/half-width alphanumerics ------------------------------------------

export type AlnumKind = "alpha" | "digit";
export type WidthTarget = "half" | "full";

/** segments that must never be converted (markdown / data syntax) */
const PROTECTED_BASE: RegExp[] = [
  /```[\s\S]*?```/g, // fenced code blocks
  /`[^`\n]+`/g, // inline code
  /\]\([^)\n]*\)/g, // link / image destinations: ](url)
  /https?:\/\/[^\s)]+/g, // bare URLs
];

const RE_FW = { alpha: /[Ａ-Ｚａ-ｚ]/g, digit: /[０-９]/g } as const;
const RE_HW = { alpha: /[A-Za-z]/g, digit: /[0-9]/g } as const;

/** apply `fn` only to the parts of `text` outside protected segments */
function mapUnprotected(text: string, fn: (s: string) => string, extra: RegExp[] = []): string {
  const ranges: Array<[number, number]> = [];
  for (const re of [...PROTECTED_BASE, ...extra]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      ranges.push([m.index, m.index + m[0].length]);
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  let out = "";
  let pos = 0;
  for (const [s, e] of ranges) {
    if (s < pos) {
      // overlapping protected ranges — extend
      if (e > pos) {
        out += text.slice(pos, e);
        pos = e;
      }
      continue;
    }
    out += fn(text.slice(pos, s)) + text.slice(s, e);
    pos = e;
  }
  return out + fn(text.slice(pos));
}

/** the convertible (unprotected) part of a text, for counting */
function unprotectedText(text: string): string {
  const parts: string[] = [];
  mapUnprotected(text, (s) => {
    parts.push(s);
    return s;
  });
  return parts.join("");
}

const FW_HW_DELTA = 0xfee0; // Ａ(0xFF21) - A(0x41)

/**
 * Convert full-width / half-width Latin letters or digits to one style.
 * Markdown-safe: code spans, fenced code, link destinations and URLs are left
 * untouched; ordered-list markers ("1. ") keep half-width digits even when
 * converting to full width (full-width markers would break the list).
 */
export function unifyAlnumWidth(text: string, kind: AlnumKind, target: WidthTarget): string {
  const extra: RegExp[] = [];
  if (kind === "digit" && target === "full") {
    extra.push(/^[ \t]*\d+\.(?=[ \t])/gm); // ordered-list markers stay half-width
  }
  const re = target === "half" ? RE_FW[kind] : RE_HW[kind];
  const delta = target === "half" ? -FW_HW_DELTA : FW_HW_DELTA;
  return mapUnprotected(
    text,
    (s) => s.replace(re, (ch) => String.fromCharCode(ch.charCodeAt(0) + delta)),
    extra,
  );
}

/**
 * Whole-poster notation consistency check. Heuristic only:
 * - punct-mix: both 、。 and ，． appear somewhere on the poster. The items
 *   listed are the ones containing the *minority* style.
 * - paren-width: half-width ( ) directly adjacent to a Japanese character.
 * - punct-width: half-width ? or ! directly after a Japanese character.
 * - alpha-width / digit-width: both full-width and half-width Latin letters /
 *   digits appear (code spans, URLs and link destinations are not counted).
 *   The items listed contain the minority style.
 */
export function checkTextConsistency(items: ProofItem[]): ProofWarning[] {
  const warnings: ProofWarning[] = [];

  // 句読点の混在（、。 vs ，．）
  let nKuten = 0; // 、。
  let nComma = 0; // ，．
  for (const it of items) {
    nKuten += countChars(it.text, "、。");
    nComma += countChars(it.text, "，．");
  }
  if (nKuten > 0 && nComma > 0) {
    const minority = nKuten <= nComma ? "、。" : "，．";
    const ids = items.filter((it) => countChars(it.text, minority) > 0).map((it) => it.id);
    warnings.push({
      code: "punct-mix",
      message:
        `句読点が混在しています（「，．」${nComma} 箇所 / 「、。」${nKuten} 箇所）．` +
        `少数派「${minority}」を含む項目を確認してください`,
      itemIds: ids,
    });
  }

  // 半角括弧が日本語文字に隣接
  const parenRe = new RegExp(`[${JP}][()]|[()][${JP}]`);
  const parenIds = items.filter((it) => parenRe.test(it.text)).map((it) => it.id);
  if (parenIds.length > 0) {
    warnings.push({
      code: "paren-width",
      message: "日本語文字に隣接する半角括弧 ( ) があります．全角（ ）との混在を確認してください",
      itemIds: parenIds,
    });
  }

  // 半角 ? ! が日本語文字の直後
  const punctRe = new RegExp(`[${JP}][?!]`);
  const punctIds = items.filter((it) => punctRe.test(it.text)).map((it) => it.id);
  if (punctIds.length > 0) {
    warnings.push({
      code: "punct-width",
      message: "日本語文字の直後に半角の ? ! があります．全角 ？ ！ との混在を確認してください",
      itemIds: punctIds,
    });
  }

  // 英字・数字の全角/半角混在（コード・URL・リンク先は対象外）
  const plain = items.map((it) => ({ id: it.id, text: unprotectedText(it.text) }));
  const widthCheck = (
    kind: AlnumKind,
    code: ProofWarningCode,
    label: string,
  ): ProofWarning | null => {
    let fw = 0;
    let hw = 0;
    for (const p of plain) {
      fw += p.text.match(RE_FW[kind])?.length ?? 0;
      hw += p.text.match(RE_HW[kind])?.length ?? 0;
    }
    if (fw === 0 || hw === 0) return null;
    const minorityRe = fw <= hw ? RE_FW[kind] : RE_HW[kind];
    const minorityName = fw <= hw ? "全角" : "半角";
    const ids = plain
      .filter((p) => (p.text.match(minorityRe)?.length ?? 0) > 0)
      .map((p) => p.id);
    return {
      code,
      message:
        `全角${label}と半角${label}が混在しています（全角 ${fw} 文字 / 半角 ${hw} 文字）．` +
        `少数派（${minorityName}）を含む項目を確認するか，「統一」ボタンでどちらかに揃えてください`,
      itemIds: ids,
    };
  };
  const aw = widthCheck("alpha", "alpha-width", "英字");
  if (aw) warnings.push(aw);
  const dw = widthCheck("digit", "digit-width", "数字");
  if (dw) warnings.push(dw);

  return warnings;
}
