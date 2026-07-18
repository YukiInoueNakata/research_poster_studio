# Contributing to Research Poster Studio

Research Poster Studio へのご関心ありがとうございます。バグ報告・機能要望・コード貢献を歓迎します。
*Thanks for your interest in contributing. Bug reports, feature requests, and code contributions are all welcome.*

This project follows our [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

## Ways to contribute / 貢献の方法

- **Report a bug** — open an issue with the **Bug report** template.
- **Request a feature** — open an issue with the **Feature request** template.
- **Ask for help / usage questions** — see [SUPPORT.md](./SUPPORT.md).
- **Submit code** — open a pull request (see below).

## Development setup / 開発環境

Prerequisites（前提）:

- Node.js 18+（開発は 22 で確認 / tested on 22）
- Rust / Cargo (stable) — desktop app build にのみ必要 / required only for building the desktop app
- OS-specific Tauri prerequisites (Windows: WebView2, Linux: webkit2gtk, macOS: Xcode CLT)

```bash
npm install            # npm workspaces (first time)
npm run build:libs     # build shared libraries (@rps/core, @rps/renderer, @rps/exporter)
npm run dev            # build:libs → tauri dev (desktop GUI)
```

The CLI and shared libraries can be developed without the desktop app (`build:libs`
must have been run first; paths are relative to the repository root):

```bash
npm run build:libs
npm run rps -- validate examples/sample-poster   # run the CLI against a sample
```

## Tests & checks / テスト・検査

Please make sure these pass before opening a PR (the CI runs the same):

```bash
npm run build:libs   # required before smoke
npm run typecheck    # type-check all workspaces
npm run smoke        # smoke tests (column layout + CLI validate/info/export)
```

PDF / PNG export requires `npx playwright install chromium` once; HTML / SVG / Marp need no extra dependencies. GUI changes should be checked manually against `docs/acceptance-tests.md`.

## Coding guidelines / コーディング規約

- TypeScript for the libraries, CLI, desktop, and VS Code extension; Rust for the Tauri backend.
- Layout, validation, and rendering logic live in the shared packages (`@rps/core` / `@rps/renderer` / `@rps/exporter`) and are reused by the desktop app, the `rps` CLI, and the VS Code extension. Put cross-surface logic there, not in a single front end.
- Keep changes focused; add or update a smoke test when you change layout or CLI behavior.
- Do not commit generated output (`exports/`, `backups/`) — they are git-ignored.

## Pull requests / プルリクエスト

1. Fork and create a feature branch (`git checkout -b feature/short-description`).
2. Make your change; run `typecheck` and `smoke`.
3. Use the PR template; describe what changed and why, and link any related issue.
4. One logical change per PR where possible.

## License of contributions / 貢献のライセンス

This project is released under the **Apache License 2.0**. By submitting a contribution, you agree that your contribution is licensed under the same Apache-2.0 terms (inbound = outbound), and that you have the right to submit it.

連絡先 / Contact: dj.y.nakata@gmail.com
