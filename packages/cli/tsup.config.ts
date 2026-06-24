import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: false,
  clean: true,
  sourcemap: true,
  banner: { js: "#!/usr/bin/env node" },
});
