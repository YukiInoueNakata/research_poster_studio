// N3 chart block: a tiny, dependency-free bar / line chart rendered to an SVG
// string. Isomorphic (no DOM), so it works in the live preview and every
// export. Driven by a ```chart fenced code block in the markdown body:
//
//   ```chart
//   type: bar          (optional: bar | line, default bar)
//   title: My chart    (optional)
//   2019: 12
//   2020: 18
//   2021: 9
//   ```

import type { ThemeColors } from "@rps/core";

export interface ChartSpec {
  type: "bar" | "line";
  title?: string;
  data: { label: string; value: number }[];
}

/** Parse the body of a ```chart fence into a ChartSpec. */
export function parseChartSpec(text: string): ChartSpec {
  const spec: ChartSpec = { type: "bar", data: [] };
  for (const raw of (text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    const val = line.slice(i + 1).trim();
    const kl = key.toLowerCase();
    if (kl === "type") spec.type = val.toLowerCase() === "line" ? "line" : "bar";
    else if (kl === "title") spec.title = val;
    else {
      const num = Number(val.replace(/[, ]/g, ""));
      if (!Number.isNaN(num)) spec.data.push({ label: key, value: num });
    }
  }
  return spec;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Render a ChartSpec to a self-contained SVG string. */
export function chartSvg(spec: ChartSpec, colors: ThemeColors): string {
  const W = 400;
  const H = 240;
  const padL = 12;
  const padR = 12;
  const padT = spec.title ? 30 : 12;
  const padB = 40;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const data = spec.data;
  const n = data.length;
  const accent = colors.accent;
  const text = colors.text;
  const muted = colors.muted;
  if (n === 0) {
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"></svg>`;
  }
  const maxV = Math.max(1, ...data.map((d) => d.value));
  const baseY = padT + plotH;
  const y = (v: number) => baseY - (v / maxV) * plotH;
  const parts: string[] = [];

  if (spec.title) {
    parts.push(
      `<text x="${W / 2}" y="16" text-anchor="middle" font-size="14" font-weight="700" fill="${text}">${esc(spec.title)}</text>`,
    );
  }
  // baseline
  parts.push(`<line x1="${padL}" y1="${baseY}" x2="${W - padR}" y2="${baseY}" stroke="${muted}" stroke-width="0.8"/>`);

  const slot = plotW / n;
  if (spec.type === "bar") {
    const bw = slot * 0.62;
    data.forEach((d, i) => {
      const cx = padL + slot * (i + 0.5);
      const top = y(d.value);
      parts.push(
        `<rect x="${(cx - bw / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${(baseY - top).toFixed(1)}" fill="${accent}"/>`,
      );
      parts.push(`<text x="${cx.toFixed(1)}" y="${(top - 4).toFixed(1)}" text-anchor="middle" font-size="11" fill="${text}">${esc(String(d.value))}</text>`);
    });
  } else {
    const pts = data.map((d, i) => `${(padL + slot * (i + 0.5)).toFixed(1)},${y(d.value).toFixed(1)}`);
    parts.push(`<polyline points="${pts.join(" ")}" fill="none" stroke="${accent}" stroke-width="2.2"/>`);
    data.forEach((d, i) => {
      const cx = padL + slot * (i + 0.5);
      parts.push(`<circle cx="${cx.toFixed(1)}" cy="${y(d.value).toFixed(1)}" r="3" fill="${accent}"/>`);
      parts.push(`<text x="${cx.toFixed(1)}" y="${(y(d.value) - 6).toFixed(1)}" text-anchor="middle" font-size="11" fill="${text}">${esc(String(d.value))}</text>`);
    });
  }
  // category labels
  data.forEach((d, i) => {
    const cx = padL + slot * (i + 0.5);
    parts.push(`<text x="${cx.toFixed(1)}" y="${(baseY + 16).toFixed(1)}" text-anchor="middle" font-size="11" fill="${muted}">${esc(d.label)}</text>`);
  });

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="rps-chart-svg" style="width:100%;height:auto">${parts.join("")}</svg>`;
}
