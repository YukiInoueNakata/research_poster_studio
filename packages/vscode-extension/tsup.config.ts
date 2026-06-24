import { defineConfig } from "tsup";

// VS Code extensions are CommonJS modules that `require('vscode')` from the
// host. @rps/core / @rps/renderer are ESM-only, so they must be bundled (not
// left as external requires) into a single dist/extension.js. Only `vscode`
// stays external.
export default defineConfig({
  entry: { extension: "src/extension.ts" },
  format: ["cjs"],
  platform: "node",
  target: "node18",
  dts: false,
  clean: true,
  sourcemap: true,
  external: ["vscode"],
  // bundle the whole dependency graph (@rps/core is ESM-only) except `vscode`
  noExternal: [/^(?!vscode$).*/],
});
