# Changelog

All notable changes to Research Poster Studio are listed here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.2] - 2026-10-05

### Security
- The desktop app now sets a Content Security Policy (was `null`): only its own scripts
  (and WebAssembly for Graphviz) run, so script injected through poster content cannot
  reach the file commands. Verified in a release build: samples, Mermaid / Graphviz / PDF
  figures, math, PNG / PPTX export and printing work; injected scripts are blocked.
- `THIRD_PARTY_NOTICES.md` lists the 722 bundled npm packages and Rust crates with their
  license texts (and Graphviz, EPL-2.0, inside `@viz-js/viz`); it ships with the installers.
- Updated production dependencies within their semver ranges (js-yaml, DOMPurify,
  mermaid, pdf.js, undici and others): `npm audit --omit=dev` goes from 9 to 4 advisories.
  The remaining four are not reachable in the app; see `SECURITY.md`.

### Changed
- "Open sample" says where the editable copy goes: the start dialog shows the
  `Documents/Research Poster Studio/samples` path and the first copy is logged (later opens
  reuse it; delete the folder to start over). README documents the locations.
- "Marp" export renamed to **Markdown**: it is the poster text in reading order with a
  Marp-oriented front matter, not a Marp rendition of the layout. The ineffective
  `size: <mm>` line (Marp only accepts theme presets) is gone; the default file is
  `exports/poster.md`. `rps export markdown` is the new name (`marp` remains an alias), and
  `buildMarp` remains as an alias of `buildMarkdown`; the `export.marp` config key is kept.
- Reading-distance index: the "comfortable" visual angle is 22 arcmin (was 21), the lower
  bound of the preferred range in ANSI/HFES 100-2007 §7.2.6.1; the 16-arcmin minimum is
  unchanged. Comfortable distances are about 5% shorter.

### Added
- Beginner's getting-started guide with step-by-step screenshots, in Japanese and English
  (`docs/getting-started.ja.md`, `docs/getting-started.en.md`): which file to download,
  install / start / uninstall for each OS, running and updating from source, and a first
  walk-through from the sample to a PDF.
- The Windows `.exe` installer and uninstaller follow the OS language (English or Japanese).
- Missing-font warning in `rps validate` and the desktop preview: if a font the poster
  asks for is not installed, text silently falls back to another font and may overflow on
  that machine only (seen on macOS, where "Noto Sans JP" fell back to Helvetica).
- Unit tests with vitest (`npm test`, run in CI) and a desktop UI smoke test that
  catches the blank-window regression (`npm run smoke:desktop`).

### Fixed
- Markdown export follows the reading order of `sync_row` layouts: blocks that share a row
  are read left to right (the demo now reads 1, 2, 3, 4, 5 instead of 1, 2, 4, 3, 5);
  independent columns are still read one column at a time.
- English interface: the preview badges (body size, too small, overflow), the wizard's
  structure choices, and the placeholders of a new English poster were in Japanese; the
  wizard's headings/body language now defaults to the interface language.
- Settings: the two numbering checkboxes wrapped one or two characters per line; they now
  have their own row.
- Toolbar: the export buttons wrap as one group and the unsaved mark keeps its width, so
  the PDF button no longer jumps between rows with the window width or after an edit.
- PDF on Windows: the log now says to switch the printer to "Save as PDF" (the dialog opens
  on the default printer, which may print on paper) and to leave the other settings alone;
  the PDF takes the poster's size even when the dialog shows A4. macOS gets its own hint.
- New-project wizard: a parent folder typed as a bare name was resolved against the app's
  working directory (e.g. `packages/desktop-app/src-tauri` under `npm run dev`). The parent
  now defaults to `Documents/Research Poster Studio`, must be an absolute path, and the
  preview path uses the OS separator (it showed `\` on Linux/macOS).
- macOS 12: Graphviz figures were not converted (the CSP keyword `wasm-unsafe-eval` is unknown
  to Safari 15, which then refuses WebAssembly); macOS/Linux builds also allow `unsafe-eval`.
- Titles and headings fell back to the browser default (a serif face in WebKit, e.g. Times on
  macOS) when the requested font was missing; every theme and block font now gets platform
  fallbacks and a generic family (sans or serif to match).
- The desktop app showed a blank (black) window on macOS 12 (Safari 15 WebView): a
  citation regex used a lookbehind, which Safari before 16.4 cannot parse. Rewritten
  without lookbehind; a unit test keeps lookbehinds out of the sources.
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
- Linux (.deb) and macOS: buttons, selects and parts of the settings dialog were drawn as
  light native widgets on the dark UI; controls are now styled by the app.
- Ctrl+Z / Ctrl+Y did nothing while typing in the body editor (only after clicking the
  preview); poster-bound fields now use the app's undo history.
- README explains the print-dialog settings for PDF (paper size, margins, scale).
- `validatePosterYaml` threw on structurally wrong input (e.g. `blocks` not a list) instead
  of returning errors; the CLI only exited 1 because it crashed.

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

[Unreleased]: https://github.com/YukiInoueNakata/research_poster_studio/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/YukiInoueNakata/research_poster_studio/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/YukiInoueNakata/research_poster_studio/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/YukiInoueNakata/research_poster_studio/releases/tag/v0.1.0
