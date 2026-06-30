// Base CSS for the rendered poster. Shared by the live preview and the
// self-contained HTML/SVG export so they look identical.

import type { PosterDoc } from "@rps/core";
import { roleColorCss } from "./markdown";
import { fancyListCss } from "./fancyLists";

export function posterCss(doc: PosterDoc): string {
  const t = doc.theme;
  const lineHeight = t.line_height ?? 1.45;
  const paraMm = t.paragraph_spacing_mm ?? 2;
  return `
.rps-poster{
  box-sizing:border-box;
  background:${t.colors.background};
  color:${t.colors.text};
  font-family:${t.font_family.body}, "Yu Gothic", "Hiragino Sans", sans-serif;
  display:flex; flex-direction:column;
  /* On screen, overflowing content stays VISIBLE (spills past the A0 frame) so
     the overflow is obvious and the overflow warning is actionable — never
     silently clipped (設計書 §8.5: あふれは警告，自動縮小しない). Print clips to
     the page below. This fixes content (e.g. lower sections) vanishing when the
     poster overflows A0 — including with sync_row, which can push a section
     past the bottom edge. */
  overflow:visible;
  position:relative;
  /* own stacking context so .rps-bg (z-index:-1) paints above the poster
     background color but below all content */
  z-index:0;
}
@media print { .rps-poster{ overflow:hidden; } }
.rps-poster *{ box-sizing:border-box; }
.rps-header{ text-align:center; padding:0 0 6mm; border-bottom:2pt solid ${t.colors.accent}; }
.rps-title{ font-family:${t.font_family.title}; font-size:${t.font_size.title}; color:${t.colors.heading}; margin:0 0 3mm; line-height:1.1; font-weight:700; white-space:pre-line; }
.rps-subtitle{ font-size:${t.font_size.subtitle}; color:${t.colors.accent}; margin:0 0 4mm; white-space:pre-line; }
.rps-authors{ font-size:${t.font_size.heading2}; color:${t.colors.text}; }
.rps-affil{ font-size:${t.font_size.caption}; color:${t.colors.muted}; margin-top:2mm; }
.rps-conf{ font-size:${t.font_size.caption}; color:${t.colors.muted}; margin-top:2mm; }
.rps-body{ flex:1 1 auto; display:flex; flex-direction:column; padding:8mm 10mm; gap:8mm; min-height:0; position:relative; isolation:isolate; }
/* A1: per-column background bands sit behind the blocks (own stacking layer). */
.rps-col-bg{ position:absolute; inset:0; z-index:-1; pointer-events:none; }
.rps-band-columns{ display:flex; align-items:stretch; }
.rps-column{ display:flex; flex-direction:column; min-width:0; }
.rps-band-wide{ width:100%; }
.rps-band-grid{ width:100%; }
.rps-grid-cell{ display:flex; flex-direction:column; min-width:0; min-height:0; }
/* N10: in a sync_row grid the cell stretches to the row height; force the
   block to fill it so paired sections/cards share the same visible height. */
.rps-grid-cell > .rps-block{ flex:1 1 auto; min-height:100%; }
.rps-follow-fill{ position:absolute; inset:0; display:flex; flex-direction:column; }
.rps-follow-fill > .rps-block{ flex:1 1 auto; min-height:0; }
.rps-keywords{ font-size:${t.font_size.caption}; color:${t.colors.muted}; margin-top:2mm; }
.rps-block{ display:flex; flex-direction:column; min-height:0; }
.rps-block-title{ font-family:${t.font_family.heading}; font-size:${t.font_size.heading1}; color:${t.colors.heading}; margin:0 0 2mm; line-height:1.15; font-weight:700; border-left:6pt solid ${t.colors.accent}; padding-left:4mm; white-space:pre-line; text-wrap:balance; overflow-wrap:break-word; }
.rps-section-num{ margin-right:0.5em; }
.rps-heading-badge{ vertical-align:0.02em; box-sizing:border-box; }
/* N2 card: title bar bleeds flush to top/edges (section padding is 0); the
   body / figures / children get their inset here. */
.rps-card > .rps-block-title{ margin-bottom:3mm; }
.rps-card > .rps-block-body,
.rps-card > .rps-block-children,
.rps-card > .rps-figure,
.rps-card > .rps-ref-list{ padding-left:4mm; padding-right:4mm; }
.rps-card > .rps-block-body:last-child,
.rps-card > .rps-block-children:last-child,
.rps-card > .rps-figure:last-child{ padding-bottom:4mm; }
.rps-block-body{ font-size:${t.font_size.body}; line-height:${lineHeight}; flex:1 1 auto; min-height:0; }
.rps-block-body p{ margin:0 0 var(--rps-para, ${paraMm}mm); }
.rps-block-body ul,.rps-block-body ol{ margin:0 0 var(--rps-para, ${paraMm}mm); padding-left:6mm; }
.rps-block-body li{ margin:0 0 1mm; }
.rps-block-body h1,.rps-block-body h2,.rps-block-body h3,.rps-block-body h4,.rps-block-body h5,.rps-block-body h6{
  font-family:${t.font_family.heading}; color:${t.colors.heading};
  margin:3mm 0 1.5mm; line-height:1.2; font-weight:700;
}
.rps-block-body h3{ font-size:${t.font_size.heading2}; }
.rps-block-body h4,.rps-block-body h5,.rps-block-body h6{ font-size:1em; }
.rps-block-body > :first-child{ margin-top:0; }
${fancyListCss(paraMm)}
.rps-block-body u{ text-decoration:underline; }
.rps-block-body blockquote{ border-left:3pt solid ${t.colors.muted}; margin:0 0 var(--rps-para, ${paraMm}mm); padding-left:4mm; color:${t.colors.muted}; }
/* N9 callout boxes (::: note / warning / accent / muted) */
.rps-block-body .rps-callout{ border-left:3pt solid ${t.colors.accent}; background:color-mix(in srgb, ${t.colors.accent} 8%, ${t.colors.background}); padding:2.5mm 3mm; margin:0 0 var(--rps-para, ${paraMm}mm); border-radius:1mm; }
.rps-block-body .rps-callout > :last-child{ margin-bottom:0; }
.rps-block-body .rps-callout-warning{ border-left-color:${t.colors.warning}; background:color-mix(in srgb, ${t.colors.warning} 8%, ${t.colors.background}); }
.rps-block-body .rps-callout-muted{ border-left-color:${t.colors.muted}; background:color-mix(in srgb, ${t.colors.muted} 8%, ${t.colors.background}); }
.rps-block-body .rps-callout-heading{ border-left-color:${t.colors.heading}; background:color-mix(in srgb, ${t.colors.heading} 8%, ${t.colors.background}); }
/* N14 labeled callout: full border + a tab chip (Important / Challenge / Main Idea) */
.rps-block-body .rps-callout-labeled{ border:1.2pt solid ${t.colors.accent}; border-left-width:3pt; padding-top:2mm; }
.rps-callout-label{ display:inline-block; background:${t.colors.accent}; color:#fff; font-weight:700; padding:0.3mm 2.5mm; border-radius:1mm; margin:0 0 1.5mm; font-size:0.92em; line-height:1.3; }
.rps-block-body .rps-callout-warning.rps-callout-labeled{ border-color:${t.colors.warning}; }
.rps-block-body .rps-callout-warning .rps-callout-label{ background:${t.colors.warning}; }
.rps-block-body .rps-callout-muted.rps-callout-labeled{ border-color:${t.colors.muted}; }
.rps-block-body .rps-callout-muted .rps-callout-label{ background:${t.colors.muted}; }
.rps-block-body .rps-callout-heading.rps-callout-labeled{ border-color:${t.colors.heading}; }
.rps-block-body .rps-callout-heading .rps-callout-label{ background:${t.colors.heading}; }
/* A4: theorem / boxed callout — full-width title bar (amsthm-style). */
.rps-block-body .rps-callout-banner{ border:1.2pt solid ${t.colors.heading}; border-left-width:1.2pt; padding:0; overflow:hidden; }
.rps-block-body .rps-callout-banner > .rps-callout-title{ display:block; background:${t.colors.heading}; color:#fff; font-weight:700; padding:1.5mm 3mm; margin:0; line-height:1.25; text-wrap:balance; overflow-wrap:break-word; }
.rps-block-body .rps-callout-banner > :not(.rps-callout-title){ padding-left:3mm; padding-right:3mm; }
.rps-block-body .rps-callout-banner > .rps-callout-title + *{ margin-top:2.5mm; }
.rps-block-body .rps-callout-banner > :last-child{ margin-bottom:2.5mm; }
.rps-block-body .rps-callout-theorem{ background:color-mix(in srgb, ${t.colors.heading} 7%, ${t.colors.background}); }
.rps-block-body .rps-callout-boxed{ background:${t.colors.background}; }
/* A3: inline coloured chip / tag pill */
.rps-block-body .rps-chip{ display:inline-block; background:${t.colors.accent}; color:#fff; font-weight:700; font-size:0.82em; padding:0.2mm 1.8mm; border-radius:1mm; line-height:1.35; white-space:nowrap; vertical-align:baseline; }
.rps-block-body .rps-chip-warning{ background:${t.colors.warning}; }
.rps-block-body .rps-chip-muted{ background:${t.colors.muted}; }
.rps-block-body .rps-chip-heading{ background:${t.colors.heading}; }
.rps-block-body .rps-chip-accent{ background:${t.colors.accent}; }
.rps-figure{ margin:3mm 0; text-align:center; }
.rps-figure img{ max-width:100%; height:auto; }
.rps-figcaption{ font-size:${t.font_size.caption}; color:${t.colors.muted}; margin-top:1.5mm; }
.rps-figure-title{ font-size:${t.font_size.heading2}; font-weight:700; color:${t.colors.heading}; margin:0 0 2mm; white-space:pre-line; }
.rps-refs .rps-block-body{ font-size:${t.font_size.references}; line-height:1.3; }
.rps-ref-list p{ padding-left:2em; text-indent:-2em; margin:0 0 1.2mm; }
.rps-ref-empty{ color:${t.colors.muted}; }
.rps-footer{ padding:5mm 10mm; border-top:1pt solid ${t.colors.muted}; font-size:${t.font_size.caption}; color:${t.colors.muted}; display:flex; justify-content:space-between; }
/* N24: header logos laid out in flow (left | center | right) so they never
   overlap a centered title; replaces the old absolute overlay. */
.rps-header-inner{ display:flex; align-items:center; gap:6mm; }
.rps-header-center{ flex:1 1 auto; min-width:0; }
.rps-header-side{ flex:0 0 auto; display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:3mm; }
/* B1: header text badge / pill */
.rps-header-badge{ display:inline-block; background:${t.colors.accent}; color:#fff; font-weight:700; font-size:${t.font_size.caption}; padding:1mm 3mm; border-radius:1.5mm; line-height:1.2; white-space:nowrap; }
.rps-header-logo-row .rps-header-badge{ margin:0 1mm; }
.rps-header-logo-row{ display:flex; justify-content:center; align-items:center; gap:4mm; margin:0 0 3mm; }
.rps-header-logos{ position:absolute; top:50%; transform:translateY(-50%); display:flex; align-items:center; gap:4mm; }
.rps-header-logos.rps-pos-left{ left:0; }
.rps-header-logos.rps-pos-right{ right:0; }
.rps-header-logos.rps-pos-center{ left:50%; transform:translate(-50%,-50%); }
.rps-poster-footer{ display:flex; align-items:center; flex:0 0 auto; }
.rps-footer-zone{ flex:1 1 0; display:flex; align-items:center; gap:4mm; min-width:0; }
.rps-footer-zone.rps-pos-center{ justify-content:center; }
.rps-footer-zone.rps-pos-right{ justify-content:flex-end; }
.rps-footer-text{ white-space:pre-line; }
.rps-logo-img{ display:block; width:auto; }
.rps-logo-missing{ display:inline-flex; align-items:center; padding:0 3mm; border:1pt dashed ${t.colors.muted}; color:${t.colors.muted}; font-size:${t.font_size.caption}; }
.rps-bg{ position:absolute; inset:0; z-index:-1; }
.rps-block-body table,.rps-table{ border-collapse:collapse; margin:0 auto var(--rps-para, ${paraMm}mm); }
.rps-block-body th,.rps-block-body td,.rps-table th,.rps-table td{ border:0.5pt solid ${t.colors.muted}; padding:1mm 2.5mm; text-align:left; }
.rps-block-body th,.rps-table th{ border-bottom:1.2pt solid ${t.colors.text}; border-top:1.2pt solid ${t.colors.text}; background:transparent; font-weight:700; }
/* N15: highlighted table cell (==value==) — tinted box + accent border for best values */
.rps-cell-hl{ background:color-mix(in srgb, ${t.colors.accent} 16%, ${t.colors.background}); box-shadow:inset 0 0 0 1.2pt ${t.colors.accent}; font-weight:700; }
.rps-tablewrap .rps-table{ margin:0; }
.rps-diagram{ margin:0 0 var(--rps-para, ${paraMm}mm); text-align:center; }
.rps-diagram svg{ max-width:100%; height:auto; }
.rps-chart{ text-align:center; margin:0 0 var(--rps-para, ${paraMm}mm); }
.rps-chart-svg{ width:100%; height:auto; max-width:520px; }
.rps-diagram-pending{ border:1pt dashed ${t.colors.muted}; color:${t.colors.muted}; padding:3mm; font-size:${t.font_size.caption}; text-align:center; }
.rps-diagram-error{ border:1pt dashed ${t.colors.warning}; color:${t.colors.warning}; padding:3mm; font-size:${t.font_size.caption}; text-align:left; white-space:pre-wrap; }
.rps-math-display{ display:block; text-align:center; margin:0 0 var(--rps-para, ${paraMm}mm); overflow-x:auto; }
.rps-math-display svg{ max-width:100%; height:auto; }
.rps-math svg{ max-width:100%; }
.rps-math-error{ color:${t.colors.warning}; border-bottom:1px dotted ${t.colors.warning}; }
.rps-qr{ text-align:center; margin:0 0 var(--rps-para, ${paraMm}mm); }
.rps-qr svg{ width:32mm; height:32mm; max-width:100%; display:inline-block; }
/* C3: sized QR (size: N mm) renders inline-block so several wrap into a row/grid */
.rps-qr-sized{ display:inline-block; margin:1mm 1.5mm; vertical-align:top; }
.rps-qr-sized svg{ width:100%; height:100%; }
.rps-gallery{ display:inline-flex; flex-direction:column; gap:2mm; vertical-align:top; max-width:100%; }
.rps-gallery-row{ display:flex; gap:2mm; align-items:stretch; width:100%; }
.rps-gallery-item{ flex-basis:0; flex-shrink:1; min-width:0; }
.rps-gallery-item img{ display:block; width:100%; height:auto; max-width:none; }
${roleColorCss(t.colors)}
`;
}
