# Poster Reproduction Skill

## Purpose

Reproduce an **existing** poster (a PDF/PNG image, or a PowerPoint/PPTX) as a
faithful Research Poster Studio project. The deliverable is an RPS project
(`poster.yaml` + `content/*.md` + `figures/*`) whose rendered output matches the
original at a glance — same scale, density, structure, colour, and figures.

Reproductions stay **outside** the RPS git repo (scratchpad / a separate folder).
Anonymise real names in anything that may become a public sample.

## The one rule: MEASURE, never guess

A reproduction is ~20 independent decisions (per-section position, height, column
structure, font size, colour, figure crop box, text wording…). If each is "85%
right" by eye, `0.85^20 ≈ 4%` — the whole is *always* "quite different". You
cannot eyeball your way to a faithful copy, and you cannot eyeball your way to a
correct *diagnosis* of why it is off either.

> Cautionary tale (real). Reproducing a NeurIPS A0 poster, the gap was diagnosed
> by eye twice — first "subtle font/spacing", then "everything is half-scale".
> Measurement refuted **both**: the body was already ~right (≈30 pt), the title
> was only ~20% small (46 vs measured 58 pt), and the real gaps were content
> density, a stacked-vs-side-by-side structure, figure sizing, and an off colour
> (`#b01c2e` used vs measured `#ca2128`). Two confident visual judgements, both
> wrong. **Run the numbers before changing anything.**

The project's best reproductions (TEMerPlus / EAAPL, >90%) succeeded by measuring
the PPTX ground truth shape-by-shape in mm and matching the font family — not by
the screenshot-tweak loop.

## Work top-down, not bottom-up

Failure mode: assemble parts, verify each part is *present*, ship. The human eye
judges the **whole** first (scale, density, balance, fullness). So:

1. Lock the **global scale** (title / heading / body pt, figure mm) to measured
   values *first*.
2. Lock the **structure** (columns, which sections are side-by-side sub-columns,
   which are full-width bands).
3. Only then fill in content.
4. Compare the **whole**, not the checklist of parts.

## Process

### Phase 0 — Ground truth

- **PPTX available → use it.** It carries exact positions/sizes/fonts/colours in
  EMU (1 inch = 914400 EMU = 25.4 mm). This is the gold path: read shape geometry
  directly, no pixel guessing. (See `office-automation` / python-pptx.)
- **Only an image/PDF → render to PNG at known DPI.** Establish the pixel↔mm
  scale from the paper size: `mm_per_px = paper_width_mm / image_width_px`
  (A0 portrait width = 841 mm, A1 = 594 mm).

### Phase 1 — Measure (use `scripts/measure-poster.py`, via `uv run`)

```
uv run measure-poster.py info  ORIG.png [--wmm 841]          # dims + mm_per_px
uv run measure-poster.py color ORIG.png X Y                  # exact colour at px
uv run measure-poster.py text  ORIG.png X0 Y0 X1 Y1 [--mode dark|white]
uv run measure-poster.py bands ORIG.png --x 1000 [--target R,G,B]  # colour-band y-ranges
uv run measure-poster.py crop  ORIG.png X Y W H OUT.png      # exact figure crop
```

Capture into a measurement table before writing any YAML:

- **Type scale**: title, each heading level, body — point sizes (`text` reports
  font pt from line pitch and from cap-height). A0 posters typically run title
  ~80–110 pt, headings ~50–70 pt, body ~30–44 pt. If your body is <28 pt on A0 it
  will look empty.
- **Colours**: header band, headings, accents, footer — exact hex (`color`).
- **Structure**: columns, sub-columns, full-width bands; section y-boundaries via
  `bands` (find the coloured header / central card / footer extents → mm).
- **Figures**: bounding box of every figure/diagram in px → mm; crop with `crop`
  (no more eyeballed coordinates).
- **Text**: transcribe **verbatim**. Do not summarise — summarising changes line
  count and density, which is what the eye reads as "different".
- **Font family**: identify (or match serif/sans + weight). Mismatched metrics
  alone caused +262 mm overflow in EAAPL — it is decisive, not cosmetic.

### Phase 2 — Build to the measured spec

Map measurements onto `poster.yaml` (see Mapping below). Set the type scale and
colours in `theme` first, lay out the structure, place figures at measured size,
and set section `height: { mode: fixed, value: "<measured>mm" }` so the columns
reach the page edges exactly (no "fill with an arbitrary number" guessing).

### Phase 3 — Gestalt compare (data-driven, not eyeball-tweak)

- Export the RPS poster to PNG at the original's pixel size.
- Put the two side by side / overlaid. Ask of the **whole**: same fullness? same
  scale? same balance? — not "are the parts there".
- For anything off, **re-measure** the offending element in both images and
  correct by the delta. Do not nudge by feel.

## Mapping: measurement → poster.yaml

| Measured | poster.yaml |
|---|---|
| title pt | `header.title_font_size` |
| heading pt | `theme.font_size.heading1` (and per-block `style.heading_font_size`) |
| body pt | `theme.font_size.body` |
| line spacing | `theme.line_height`, `theme.paragraph_spacing_mm` |
| header / accent / footer hex | `header.background`, `theme.colors.*`, `header.footer_*` |
| margins, column gap, column ratio | `layout.margin_mm`, `column_gap_mm`, `columns.ratio` |
| side-by-side sub-columns | nested columns / two blocks in `left`+`right` of a band (do **not** stack) |
| full-width band (thesis card, footer) | block `column: "wide"`; footer via `header.footer_*` |
| section height (mm) | block `height: { mode: "fixed", value: "Nmm" }` |
| figure box (mm) | `figures[].scale` (fraction of column width) or a fixed-height host block |
| logos / QR / corner marks | `header.logos[]` (positions flow via the header inner row) |

## Failure-mode checklist (all observed, all from skipping measurement)

- [ ] Body type too small for A0 → looks empty. (Measure it; don't default.)
- [ ] Text summarised, not transcribed → wrong density.
- [ ] Sub-columns stacked vertically instead of side by side → wrong shape.
- [ ] Figures cropped by eyeballed coordinates → wrong size / wrong region / stray
      bleed (e.g. a red band fragment). Use `crop` with measured boxes.
- [ ] Page filled with arbitrary fixed heights instead of measured section mm.
- [ ] Colour eyeballed instead of sampled (`#b01c2e` vs measured `#ca2128`).
- [ ] Font family left at default.
- [ ] Verified "parts present" but never compared the whole gestalt.

## Notes

- A0 = 841 × 1189 mm; A1 = 594 × 841 mm. RPS renders mm real-size.
- `measure-poster.py` needs only Pillow + numpy; PEP 723 header runs it under
  `uv run` with no setup.
- For overflow, RPS warns rather than auto-shrinking — so a faithful copy must be
  measured to fit, not squeezed.
