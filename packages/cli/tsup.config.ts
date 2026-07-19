import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: false,
  clean: true,
  sourcemap: true,
  banner: { js: "#!/usr/bin/env node" },
  // `rps init` reads templates from dist/templates in the published package.
  onSuccess: "node scripts/copy-templates.mjs",
});
