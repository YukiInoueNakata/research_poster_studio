// QR code -> self-contained SVG (N18).
//
// A ```qr fenced block (URL + optional options) renders a QR code as a crisp
// vector SVG, like the chart/diagram pipeline. Synchronous and dependency-light
// (qrcode-generator is a pure-JS encoder that works in Node and the browser).

import qrcode from "qrcode-generator";

export interface QrSpec {
  text: string;
  /** error-correction level (default M) */
  ecc?: "L" | "M" | "Q" | "H";
  /** foreground / background colors */
  dark?: string;
  light?: string;
  /** rendered size in mm (default 32 via CSS); also makes the QR inline so
   *  several sized QRs sit side-by-side / wrap into a grid (C3) */
  size?: number;
}

/** Parse a ```qr block: first non-empty line is the URL/text; `key: value`
 *  lines set options (ecc / dark / light). A bare block is treated as the text. */
export function parseQrSpec(src: string): QrSpec {
  const lines = (src ?? "").split(/\r?\n/);
  const spec: QrSpec = { text: "" };
  const textParts: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^(ecc|dark|light|size|text|url)\s*:\s*(.+)$/i.exec(line);
    if (m) {
      const k = m[1].toLowerCase();
      const v = m[2].trim();
      if (k === "ecc") spec.ecc = v.toUpperCase() as QrSpec["ecc"];
      else if (k === "dark") spec.dark = v;
      else if (k === "light") spec.light = v;
      else if (k === "size") {
        const num = parseFloat(v);
        if (num > 0) spec.size = num;
      } else textParts.push(v);
    } else {
      textParts.push(line);
    }
  }
  spec.text = textParts.join("");
  return spec;
}

/** Render a QR code to an SVG string (1 unit per module + a quiet-zone border). */
export function qrSvg(spec: QrSpec): string {
  const text = (spec.text ?? "").trim();
  if (!text) return "";
  const ecc = spec.ecc && "LMQH".includes(spec.ecc) ? spec.ecc : "M";
  const dark = sanitizeColor(spec.dark) ?? "#000000";
  const light = sanitizeColor(spec.light) ?? "#ffffff";
  let qr;
  try {
    qr = qrcode(0, ecc);
    qr.addData(text);
    qr.make();
  } catch {
    return "";
  }
  const n = qr.getModuleCount();
  const quiet = 4;
  const size = n + quiet * 2;
  const rects: string[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) rects.push(`<rect x="${c}" y="${r}" width="1" height="1"/>`);
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" ` +
    `width="100%" height="100%" shape-rendering="crispEdges" role="img" aria-label="QR code">` +
    `<rect width="${size}" height="${size}" fill="${light}"/>` +
    `<g fill="${dark}" transform="translate(${quiet},${quiet})">${rects.join("")}</g></svg>`
  );
}

function sanitizeColor(c?: string): string | undefined {
  if (!c) return undefined;
  return /^#[0-9a-fA-F]{3,8}$|^[a-zA-Z]+$|^rgb/.test(c.trim()) ? c.trim() : undefined;
}
