// Desktop UI smoke test (node scripts/smoke-desktop.mjs): builds the desktop
// front end with Vite, serves it with `vite preview` and loads it in headless
// Chromium. Fails if the page throws or #root stays empty — the "blank window"
// regression (mathjax-full's eval("require"), fixed in 440acda) would show up
// here before it reaches an installer.
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = path.join(ROOT, "packages", "desktop-app");
const PORT = 4173;
const shell = process.platform === "win32";

const build = spawnSync("npx", ["vite", "build"], { cwd: APP, stdio: "inherit", shell });
if (build.status !== 0) {
  console.error("NG   vite build failed");
  process.exit(1);
}
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { cwd: APP, shell });
let ok = false;
try {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let loaded = false;
  for (let i = 0; i < 60 && !loaded; i++) {
    try {
      await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load", timeout: 2000 });
      loaded = true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!loaded) throw new Error("vite preview did not start");
  await page.waitForTimeout(3000);
  const rootLen = await page.evaluate(() => document.getElementById("root")?.innerHTML.length ?? 0);
  // Tauri APIs are absent in a plain browser; only *render* errors count.
  const fatal = errors.filter((m) => !/__TAURI|invoke|transformCallback|ipc/i.test(m));
  console.log(`${rootLen > 500 ? "OK" : "NG"}   desktop UI renders (#root ${rootLen} chars)`);
  console.log(`${fatal.length === 0 ? "OK" : "NG"}   no page errors${fatal.length ? ": " + fatal.join(" | ") : ""}`);
  if (errors.length > fatal.length) console.log(`info ignored Tauri-only errors: ${errors.length - fatal.length}`);
  ok = rootLen > 500 && fatal.length === 0;
  await browser.close();
} catch (e) {
  console.error("NG  ", e?.message ?? e);
} finally {
  server.kill();
  if (shell) spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
}
process.exit(ok ? 0 : 1);
