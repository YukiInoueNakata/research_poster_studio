// Validation warnings (設計書 §11). Static checks here; overflow / column
// height-difference checks are measured in the preview and merged in.

import type { PosterDoc, PosterProject } from "./types";
import { parseFontPt } from "./units";
import { columnOrder } from "./layout";

export type WarnLevel = "error" | "warn" | "info";

export interface Warning {
  level: WarnLevel;
  /** stable code; the desktop app translates by code + params (message is the
   *  Japanese fallback, also used by the CLI) */
  code: string;
  message: string;
  /** interpolation values for the translated message (keyed by placeholder) */
  params?: Record<string, string | number>;
  blockId?: string;
  figureId?: string;
}

// readability thresholds (pt) for large-format posters
const MIN_BODY_PT = 18;
const MIN_REF_PT = 12;
const MIN_CAPTION_PT = 14;
const MIN_HEADING_BODY_GAP_PT = 4;

/**
 * Asset-independent checks (readability, caption, duplicate ids). Usable from
 * the CLI / core where figure files may not be loaded.
 */
export function docWarnings(doc: PosterDoc): Warning[] {
  const w: Warning[] = [];
  const theme = doc.theme;

  const bodyPt = parseFontPt(theme.font_size.body) ?? 22;
  const refPt = parseFontPt(theme.font_size.references) ?? 13;
  const h1Pt = parseFontPt(theme.font_size.heading1) ?? 34;

  if (bodyPt < MIN_BODY_PT) {
    w.push({
      level: "warn",
      code: "body-too-small",
      params: { size: theme.font_size.body, min: MIN_BODY_PT },
      message: `本文フォント ${theme.font_size.body} は小さすぎます（推奨 ${MIN_BODY_PT}pt 以上）．`,
    });
  }
  if (refPt < MIN_REF_PT) {
    w.push({
      level: "warn",
      code: "refs-too-small",
      params: { size: theme.font_size.references, min: MIN_REF_PT },
      message: `引用文献フォント ${theme.font_size.references} は読めない可能性があります（推奨 ${MIN_REF_PT}pt 以上）．`,
    });
  }
  if (h1Pt - bodyPt < MIN_HEADING_BODY_GAP_PT) {
    w.push({
      level: "info",
      code: "heading-body-gap",
      message: "見出しと本文のサイズ差が小さく，階層が分かりにくい可能性があります．",
    });
  }

  // blocks pointing at a column that does not exist (e.g. col5 with 4 columns)
  // — layout falls back to the first column, so flag it
  {
    const count = doc.layout.columns.count;
    const cols = new Set<string>(columnOrder(count));
    for (const b of doc.blocks) {
      if (b.visible === false) continue;
      const c = b.column;
      if (c === "wide" || cols.has(c)) continue;
      // left / center / right always resolve as first / middle / last aliases
      if (c === "left" || c === "center" || c === "right") continue;
      const m = /^col([1-9]\d*)$/.exec(c);
      if (m && Number(m[1]) <= count) continue;
      w.push({
        level: "warn",
        code: "unknown-column",
        blockId: b.id,
        params: { title: b.title || b.id, column: c, count },
        message: `ブロック「${b.title || b.id}」のカラム「${c}」は存在しません（カラム数 ${count}）．先頭列に配置されます．`,
      });
    }
  }

  // per-block body font checks
  for (const b of doc.blocks) {
    if (b.visible === false) continue;
    const bf = parseFontPt(b.style?.body_font_size);
    if (bf != null && bf < MIN_BODY_PT) {
      w.push({
        level: "warn",
        code: "block-body-too-small",
        blockId: b.id,
        params: { title: b.title || b.id, size: String(b.style?.body_font_size) },
        message: `ブロック「${b.title || b.id}」の本文 ${b.style?.body_font_size} は小さすぎます．`,
      });
    }
  }

  // figure checks
  const idSeen = new Set<string>();
  for (const f of doc.figures) {
    if (idSeen.has(f.id)) {
      w.push({
        level: "error",
        code: "dup-figure-id",
        figureId: f.id,
        params: { id: f.id },
        message: `図表IDが重複しています: ${f.id}`,
      });
    }
    idSeen.add(f.id);

    if (!f.caption || !f.caption.trim()) {
      w.push({
        level: "warn",
        code: "caption-missing",
        figureId: f.id,
        params: { id: f.id },
        message: `図表 ${f.id} にキャプションがありません．`,
      });
    }
  }

  // duplicate figure/table numbers in captions（図N / 表N / Figure N / Table N …）
  const numSeen = new Map<string, string>(); // normalized label -> first figure id
  for (const f of doc.figures) {
    const label = captionNumberLabel(f.caption);
    if (!label) continue;
    const first = numSeen.get(label);
    if (first) {
      w.push({
        level: "warn",
        code: "dup-figure-number",
        figureId: f.id,
        params: { label, first, second: f.id },
        message: `図表番号「${label}」が重複しています（${first} と ${f.id}）．`,
      });
    } else {
      numSeen.set(label, f.id);
    }
  }

  return w;
}

/**
 * Extract a normalized figure/table number label from the leading part of a
 * caption: 図1 / 表 2 / Figure 3 / Fig. 4 / Table 5（全角数字も可）.
 * Returns e.g. "図1" / "Figure 3", or undefined when the caption has no number.
 */
export function captionNumberLabel(caption?: string): string | undefined {
  if (!caption) return undefined;
  const m = caption
    .trim()
    .match(/^(図|表|Figure|Fig\.?|Table|Tab\.?)\s*([0-9０-９]+)/i);
  if (!m) return undefined;
  const num = m[2].replace(/[０-９]/g, (d) =>
    String.fromCharCode(d.charCodeAt(0) - 0xfee0),
  );
  const kindRaw = m[1].toLowerCase();
  const kind =
    kindRaw === "図" ? "図"
    : kindRaw === "表" ? "表"
    : kindRaw.startsWith("fig") ? "Figure"
    : "Table";
  return `${kind}${kind === "図" || kind === "表" ? "" : " "}${num}`;
}

/**
 * Full static checks including figure-asset presence / resolution. Requires a
 * loaded PosterProject (figures map). Used by the desktop app and CLI.
 */
export function staticWarnings(project: PosterProject): Warning[] {
  const w: Warning[] = docWarnings(project.doc);
  for (const f of project.doc.figures) {
    const asset = project.figures[f.id];
    if (!asset) {
      w.push({
        level: "error",
        code: "figure-missing",
        figureId: f.id,
        params: { path: f.path },
        message: `図表ファイルが見つかりません: ${f.path}`,
      });
    } else if (asset.naturalWidth && asset.naturalHeight) {
      const isVector = /\.svg$/i.test(asset.name);
      if (!isVector && asset.naturalWidth < 600) {
        w.push({
          level: "warn",
          code: "figure-low-res",
          figureId: f.id,
          params: { id: f.id, width: asset.naturalWidth },
          message: `図表 ${f.id} の解像度が低い可能性があります（${asset.naturalWidth}px）．`,
        });
      }
    }
  }
  return w;
}

export const MINIMUMS = { MIN_BODY_PT, MIN_REF_PT, MIN_CAPTION_PT };
