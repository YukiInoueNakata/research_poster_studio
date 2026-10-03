# Security policy

## Reporting a vulnerability

Please report security issues privately by email to dj.y.nakata@gmail.com rather than in a
public issue. Include the version, your OS, and steps to reproduce. You will get a reply
within two weeks.

## Threat model

Research Poster Studio is a local, single-user authoring tool. It reads and writes the
poster project you open (`poster.yaml`, Markdown, BibTeX, figures) and renders it in a
WebView (desktop app) or headless Chromium (CLI export). Treat poster projects from other
people like any other document from an untrusted source.

## Hardening in the desktop app

- Markdown and raw HTML in poster bodies are sanitized with DOMPurify before rendering.
- A Content Security Policy only allows the app's own scripts (plus WebAssembly for
  Graphviz); inline scripts, `data:` scripts and event-handler attributes are blocked and
  no remote resources are loaded.
- On macOS and Linux (WebKit) the policy also allows `'unsafe-eval'`, because older WebKit
  (Safari 15 / macOS 12) does not understand `'wasm-unsafe-eval'` and refuses to compile
  Graphviz's WebAssembly otherwise. Injected inline / `data:` scripts stay blocked there too.
- Remaining limitation: the file commands behind the UI (read/write/list) accept any path
  the user can access, because projects and exports may live anywhere. They are reachable
  only from the app's own code, which the two layers above protect.

## Known advisories in dependencies

`npm audit --omit=dev` reports the following; none is reachable in the shipped app:

| Package | Pulled in by | Why it does not apply |
|---|---|---|
| `@xmldom/xmldom` (high), `speech-rule-engine` (moderate) | `mathjax-full` | Speech/semantic enrichment is not enabled; math is rendered TeX → SVG only, and these modules are not in the desktop bundle. `speech-rule-engine` pins the vulnerable version exactly, so it cannot be upgraded independently. |
| `image-size` (high), `pptxgenjs` (high) | `pptxgenjs` | `pptxgenjs` declares `image-size` but does not use it; image sizes come from data URIs in the browser. The latest `pptxgenjs` (4.0.1) still requires `image-size@^1`. |

These are re-checked at each release.
