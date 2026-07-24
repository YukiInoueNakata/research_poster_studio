import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // mathjax-full (pulled in via @rps/renderer for LaTeX math) ships a CommonJS
  // build whose components/version.js reads its own package.json through
  // `eval('require')` unless the global PACKAGE_VERSION is defined. In a browser
  // bundle `require` is undefined, so that eval throws "require is not defined"
  // at module load — which blanks the whole app (the React root never renders).
  // Defining PACKAGE_VERSION makes version.js take its constant branch and skip
  // the eval, both in dev (esbuild pre-bundle) and in the production build.
  define: {
    PACKAGE_VERSION: JSON.stringify("3.2.1"),
  },

  // Split heavy, independently-loaded libraries into their own chunks so the
  // main app bundle stays small and the big exporters (pptx) load lazily.
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          pptx: ["pptxgenjs"],
          markdown: ["marked", "dompurify"],
          yaml: ["js-yaml"],
        },
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
