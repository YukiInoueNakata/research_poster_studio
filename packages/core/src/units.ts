// Unit conversions and paper sizes.
//
// CSS treats `1mm` as a real millimetre (96px / 25.4mm). We render the poster
// at true mm size and scale it for preview with a CSS transform, so the same
// markup prints to an exact A0/A1 PDF via @page.

import type { Orientation, PaperSize, ProjectMeta, UnitSystem } from "./types";

export const MM_PER_INCH = 25.4;
export const PX_PER_INCH = 96; // CSS reference pixel density
export const PT_PER_INCH = 72;

export const mmToPx = (mm: number) => (mm * PX_PER_INCH) / MM_PER_INCH;
export const ptToMm = (pt: number) => (pt * MM_PER_INCH) / PT_PER_INCH;
export const ptToPx = (pt: number) => (pt * PX_PER_INCH) / PT_PER_INCH;
export const pxToMm = (px: number) => (px * MM_PER_INCH) / PX_PER_INCH;

/** Paper dimensions in mm, portrait (width x height). "custom" is resolved
 *  from ProjectMeta.custom_size by posterSizeMm; the entry here is a fallback. */
export const PAPER_MM: Record<PaperSize, { w: number; h: number }> = {
  A0: { w: 841, h: 1189 },
  A1: { w: 594, h: 841 },
  A2: { w: 420, h: 594 },
  // US conference poster presets (portrait base; landscape swaps)
  "36x48in": { w: 36 * MM_PER_INCH, h: 48 * MM_PER_INCH },
  "42x56in": { w: 42 * MM_PER_INCH, h: 56 * MM_PER_INCH },
  "48x96in": { w: 48 * MM_PER_INCH, h: 96 * MM_PER_INCH },
  custom: { w: 841, h: 1189 },
};

export function paperSizeMm(
  size: PaperSize,
  orientation: Orientation,
): { w: number; h: number } {
  const base = PAPER_MM[size] ?? PAPER_MM.A0;
  return orientation === "landscape" ? { w: base.h, h: base.w } : { ...base };
}

/**
 * Poster dimensions in mm for a project, including custom sizes.
 * Custom sizes are taken as-is (width x height as entered); orientation only
 * swaps the preset sizes.
 */
export function posterSizeMm(
  meta: Pick<ProjectMeta, "poster_size" | "orientation" | "custom_size">,
): { w: number; h: number } {
  if (meta.poster_size === "custom" && meta.custom_size) {
    const w = meta.custom_size.width_mm;
    const h = meta.custom_size.height_mm;
    if (w > 0 && h > 0) return { w, h };
  }
  return paperSizeMm(meta.poster_size, meta.orientation);
}

/** Human-readable poster size, e.g. "A0", "36×48 in", "900×1200 mm". */
export function posterSizeLabel(
  meta: Pick<ProjectMeta, "poster_size" | "orientation" | "custom_size" | "units">,
): string {
  if (meta.poster_size === "custom") {
    const { w, h } = posterSizeMm(meta);
    return meta.units === "in"
      ? `${formatMm(w, "in")}×${formatMm(h, "in")} in`
      : `${formatMm(w, "mm")}×${formatMm(h, "mm")} mm`;
  }
  const m = meta.poster_size.match(/^(\d+)x(\d+)in$/);
  return m ? `${m[1]}×${m[2]} in` : meta.poster_size;
}

/** Format a length in mm as a number string in the given display unit. */
export function formatMm(mm: number, units: UnitSystem): string {
  const v = units === "in" ? mm / MM_PER_INCH : mm;
  // up to 1 decimal, trimming trailing ".0"
  return String(Math.round(v * 10) / 10);
}

/** Parse a CSS-ish length string ("160mm", "22pt", "120") to mm. */
export function parseLengthMm(value: string | number | undefined): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") return value;
  const m = value.trim().match(/^([0-9]*\.?[0-9]+)\s*(mm|cm|pt|px|in)?$/);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  switch (m[2]) {
    case "cm":
      return n * 10;
    case "pt":
      return ptToMm(n);
    case "px":
      return pxToMm(n);
    case "in":
      return n * MM_PER_INCH;
    case "mm":
    default:
      return n;
  }
}

/** Parse a font-size string ("22pt", "18px") to points. */
export function parseFontPt(value: string | number | undefined): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") return value;
  const m = value.trim().match(/^([0-9]*\.?[0-9]+)\s*(pt|px|mm)?$/);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  switch (m[2]) {
    case "px":
      return (n * PT_PER_INCH) / PX_PER_INCH;
    case "mm":
      return (n * PT_PER_INCH) / MM_PER_INCH;
    case "pt":
    default:
      return n;
  }
}

export const ZOOM_LEVELS = [0.1, 0.2, 0.33, 0.5, 0.75, 1.0];
