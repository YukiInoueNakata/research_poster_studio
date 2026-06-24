// Optimal reading distance index (最適読書距離インデックス).
//
// Model: a character is comfortably readable when its cap height subtends
// at least ~21 arcmin of visual angle (ANSI/HFES 100 recommends 20-22' as
// the preferred character height for reading tasks), and remains legible
// down to ~16 arcmin (the same standard's minimum). Cap height is taken as
// 0.70 em of the font size. Distances are returned in meters.
//
// This is an *index* shown to the user, not a hard rule — the only enforced
// threshold stays MIN_BODY_PT (warnings.ts / 設計書 §8.5).

import type { PosterDoc } from "./types";
import { parseFontPt } from "./units";

/** 1 pt in mm */
export const PT_TO_MM = 25.4 / 72;
/** cap height as a fraction of the em size (typical Latin/Japanese UI fonts) */
const CAP_HEIGHT_EM = 0.7;
/** preferred visual angle for comfortable reading (arcmin) */
const COMFORT_ARCMIN = 21;
/** minimum visual angle for legibility (arcmin) */
const LEGIBLE_ARCMIN = 16;

const arcminToRad = (m: number) => (m / 60) * (Math.PI / 180);

/** approximate rendered cap height of a font size, in mm */
export function capHeightMm(pt: number): number {
  return pt * PT_TO_MM * CAP_HEIGHT_EM;
}

/** maximum comfortable / maximum legible viewing distance for a font size */
export function readingDistanceM(pt: number): { comfortable: number; legible: number } {
  const hM = capHeightMm(pt) / 1000;
  return {
    comfortable: hM / Math.tan(arcminToRad(COMFORT_ARCMIN)),
    legible: hM / Math.tan(arcminToRad(LEGIBLE_ARCMIN)),
  };
}

/** smallest font size (pt) that is comfortably readable from a distance (m) */
export function requiredPtForDistance(distanceM: number): number {
  const hMm = distanceM * 1000 * Math.tan(arcminToRad(COMFORT_ARCMIN));
  return hMm / (PT_TO_MM * CAP_HEIGHT_EM);
}

export interface ReadingDistanceEntry {
  /** "title" | "heading1" | "body" | "caption" | "references" | "block:<id>" */
  key: string;
  label: string;
  pt: number;
  /** max distance (m) at the preferred visual angle */
  comfortableM: number;
  /** max distance (m) at the minimum legible visual angle */
  legibleM: number;
  blockId?: string;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

function entry(key: string, label: string, pt: number, blockId?: string): ReadingDistanceEntry {
  const d = readingDistanceM(pt);
  return {
    key,
    label,
    pt,
    comfortableM: round1(d.comfortable),
    legibleM: round1(d.legible),
    blockId,
  };
}

/**
 * Reading-distance entries for the theme's text roles plus any per-block
 * body-size overrides (visible blocks whose size differs from the theme).
 */
export function readingDistanceIndex(doc: PosterDoc): ReadingDistanceEntry[] {
  const fs = doc.theme.font_size;
  const out: ReadingDistanceEntry[] = [];
  const roles: { key: string; label: string; value: string }[] = [
    { key: "title", label: "タイトル", value: fs.title },
    { key: "heading1", label: "見出し", value: fs.heading1 },
    { key: "body", label: "本文", value: fs.body },
    { key: "caption", label: "キャプション", value: fs.caption },
    { key: "references", label: "引用文献", value: fs.references },
  ];
  const bodyPt = parseFontPt(fs.body);
  for (const r of roles) {
    const pt = parseFontPt(r.value);
    if (pt != null) out.push(entry(r.key, r.label, pt));
  }
  // per-block overrides (top level only; nested children rarely override size)
  const walk = (blocks: PosterDoc["blocks"]) => {
    for (const b of blocks) {
      if (b.visible === false) continue;
      const pt = parseFontPt(b.style?.body_font_size);
      if (pt != null && pt !== bodyPt) {
        out.push(entry(`block:${b.id}`, `本文「${b.title || b.id}」`, pt, b.id));
      }
      if (b.children?.length) walk(b.children);
    }
  };
  walk(doc.blocks);
  return out;
}
