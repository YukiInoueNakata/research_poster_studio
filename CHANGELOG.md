# Changelog

All notable changes to Research Poster Studio are listed here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed
- The desktop preview reported false overflow errors (blocks and the whole page) when
  zoomed out. Preview-only overlays (pt / overflow badges, page frame, margin guide,
  scale bar) grow by 1/zoom and were counted as content; they are now excluded while
  measuring, and preview borders keep their real width in the layout (the extra
  on-screen thickness is drawn as an inset shadow). Overflow is judged against the paper
  at every zoom level.

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
