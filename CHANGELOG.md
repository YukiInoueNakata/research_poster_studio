# Changelog

All notable changes to Research Poster Studio are listed here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Security
- Updated production dependencies within their semver ranges (js-yaml, DOMPurify,
  mermaid, pdf.js, undici and others): `npm audit --omit=dev` goes from 9 to 4 advisories.
  The remaining four are not reachable in the app; see `SECURITY.md`.

### Changed
- Reading-distance index: the "comfortable" visual angle is 22 arcmin (was 21), the lower
  bound of the preferred range in ANSI/HFES 100-2007 §7.2.6.1; the 16-arcmin minimum is
  unchanged. Comfortable distances are about 5% shorter.

### Fixed
- The desktop preview reported false overflow errors (blocks and the whole page) when
  zoomed out. Preview-only overlays (pt / overflow badges, page frame, margin guide,
  scale bar) grow by 1/zoom and were counted as content; they are now excluded while
  measuring, and preview borders keep their real width in the layout (the extra
  on-screen thickness is drawn as an inset shadow). Overflow is judged against the paper
  at every zoom level.
- `flex` height mode followed the design (keep the content height, share the remaining
  space by weight) only in the last band. Elsewhere it used a zero basis, so flex blocks
  above a full-width block collapsed to 0 height and overlapped the next block; this
  affected the `qualitative` and `multi-study` templates of `rps init`. CI now validates
  all three templates.
- List bullets overlapped the left border of a bordered (or shaded) block at large body
  sizes; such blocks now indent lists by `max(6mm, 1.15em)`. Unboxed blocks are unchanged.
- Saving a single-file `content.md` no longer rewrites untitled headings as `#  {#id}` or
  adds blank lines; saving is idempotent.
- Desktop PNG export never wrote a file ("Tainted canvases may not be exported"): the
  poster SVG is now rasterized from a data: URL.
- Desktop PDF export printed white headers unless "Background graphics" was ticked in the
  print dialog; backgrounds now always print (`print-color-adjust: exact`).
- Marp export omitted every child block, so nested posters (including the demos) came out
  almost empty; child blocks and figures are now exported in reading order.
- "Save as" ignored the chosen folder and always wrote into the current project folder,
  so nothing appeared where the user saved. Choosing another folder now copies the whole
  project there (excluding `exports/`, `backups/`) and continues in it.
- PPTX export: text of child blocks was duplicated into their parent (overlapping text),
  the header background was missing, and all Markdown formatting, bullets and tables were
  flattened to plain text. Each block now gets its own title/body boxes, backgrounds and
  borders from the rendered styles, formatted runs (bold, italic, underline, sub/super,
  colour, bullets / numbering) and native PowerPoint tables at their measured positions.

## [0.1.1] - 2026-10-03

Archived on Zenodo: [10.5281/zenodo.23115929](https://doi.org/10.5281/zenodo.23115929).

### Added
- Standard demo posters in Japanese and English (`examples/sample-cat-paws-ja`,
  `examples/sample-cat-paws-en`): a fictional A0 IMRAD study with only real references.
- `rps validate` now lays the poster out in headless Chromium and reports content that
  runs off the page or out of a block (`--no-measure` skips it; without Chromium it is
  skipped with a notice). CI validates both demos this way.
- App icon (replaces the default Tauri logo) and a proper window title / favicon.
- `CHANGELOG.md`.

### Changed
- "Open sample" in the desktop app offers Japanese and English. The demos are bundled
  with the installers and copied to `Documents/Research Poster Studio/samples/` before
  opening, so they can be edited and saved (an existing copy is reused).
- The previous samples moved to `tests/fixtures/` (smoke and acceptance tests only);
  `sample-poster` was removed.
- README lists both authors with their roles; the citation example uses the concept DOI
  without a fixed version.
- Release workflow: type-check and smoke tests gate the installer builds; Node 22;
  manual runs require an existing tag. GitHub Actions moved to the Node 24 runtime.
- Node.js requirement is stated as 20.19+ everywhere.

### Fixed
- "Open sample" failed in installed builds because the samples were not bundled.
- The old samples cited a fabricated reference ("Nakata, 2024") carrying the real DOI of
  an unrelated article; it is now an obviously fictional placeholder with a dummy DOI.
- LaTeX-style quotes in BibTeX fields (``` ``text'' ```) are rendered as typographic quotes.

### Known issues
- At small preview zoom the desktop preview can report overflow that does not occur on
  paper (fixed in Unreleased); `rps validate` measures at full size.

## [0.1.0] - 2026-10-03

First public release (archived on Zenodo: [10.5281/zenodo.23114418](https://doi.org/10.5281/zenodo.23114418)).

Note: the sample posters in this archived version contain the fabricated reference
described under 0.1.1 "Fixed"; it is corrected from 0.1.1 on.

[0.1.1]: https://github.com/YukiInoueNakata/research_poster_studio/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/YukiInoueNakata/research_poster_studio/releases/tag/v0.1.0
