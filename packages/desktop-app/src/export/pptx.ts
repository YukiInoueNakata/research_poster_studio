// PPTX export.
//
// PowerPoint has no HTML/flexbox, so we reproduce the *result* of the layout:
// the live preview DOM is measured (block + figure bounding boxes, normalized
// against the poster root) and each element is placed as an absolutely
// positioned text box / image on a single A0/A1-sized slide. Fidelity is
// approximate (block text, not full Markdown styling) but editable in
// PowerPoint, satisfying 設計書 §12.2.

import pptxgen from "pptxgenjs";
import type { PosterProject, Block } from "@rps/core";
import { posterSizeMm, MM_PER_INCH } from "@rps/core";
import { groupPptxBase64 } from "./pptxGroup";

const hex = (c: string | undefined, fallback: string) =>
  (c ?? fallback).replace("#", "").slice(0, 6).padEnd(6, "0");

// Map each block id -> its slash-joined ancestry path (block / child-block …),
// so PPTX shapes can be tagged for grouping (see pptxGroup.ts).
function buildBlockPaths(
  blocks: Block[],
  prefix = "",
  out = new Map<string, string>(),
): Map<string, string> {
  for (const b of blocks) {
    const path = prefix ? `${prefix}/${b.id}` : b.id;
    out.set(b.id, path);
    if (b.children?.length) buildBlockPaths(b.children, path, out);
  }
  return out;
}
const grpName = (path: string) => `rps|${path}`;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function normRect(el: Element, root: DOMRect): Box {
  const r = el.getBoundingClientRect();
  return {
    x: (r.left - root.left) / root.width,
    y: (r.top - root.top) / root.height,
    w: r.width / root.width,
    h: r.height / root.height,
  };
}

/** CSS px (1/96 in) -> pt (1/72 in). */
const PX_TO_PT = 0.75;
/** Preview-only overlays and non-text content skipped when collecting text. */
const SKIP_SEL =
  ".rps-fontbadge, .rps-overflow-badge, .rps-figure, .rps-gallery, .rps-figure-missing, figure, table, img, svg, script, style";

/** "rgb(r, g, b)" / "rgba(...)" -> "rrggbb"; null when transparent. */
function cssHex(c: string): string | null {
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const v = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (v.length > 3 && v[3] === 0) return null;
  return v.slice(0, 3).map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");
}

type Run = pptxgen.TextProps;
type RunOpts = NonNullable<pptxgen.TextProps["options"]>;

/**
 * Convert rendered HTML into PowerPoint text runs: paragraphs, bulleted /
 * numbered lists, bold / italic / underline / strike, super/subscript, color,
 * font and size, all read from computed styles.
 */
function textRuns(root: Element): Run[] {
  // pptxgenjs starts a new paragraph at every run that carries `bullet` (and
  // then drops that run's breakLine), so paragraph-level options must sit on
  // the first run of each paragraph only. Build paragraphs first, then flatten.
  interface Para { p: RunOpts; runs: Run[] }
  const paras: Para[] = [];
  let cur: Para | null = null;
  const isBlock = (e: Element) => /^(block|list-item|flex|grid|table)/.test(getComputedStyle(e).display);
  const open = (p: RunOpts) => {
    if (!cur) cur = { p, runs: [] };
  };
  const close = () => {
    if (cur && cur.runs.some((r) => (r.text ?? "").trim())) paras.push(cur);
    cur = null;
  };
  const paraOf = (e: Element, base: RunOpts): RunOpts => {
    const cs = getComputedStyle(e);
    const lh = parseFloat(cs.lineHeight);
    return {
      ...base,
      paraSpaceAfter: (parseFloat(cs.marginBottom) || 0) * PX_TO_PT,
      ...(lh ? { lineSpacing: lh * PX_TO_PT } : { lineSpacingMultiple: 1.2 }),
    };
  };
  const inline = (node: Node, p: RunOpts) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? "").replace(/\s+/g, " ");
      if (!text.trim() && !cur?.runs.length) return;
      open(p);
      const pe = node.parentElement!;
      const cs = getComputedStyle(pe);
      const deco = cs.textDecorationLine || "";
      const va = cs.verticalAlign;
      cur!.runs.push({
        text: cur!.runs.length ? text : text.replace(/^\s+/, ""),
        options: {
          bold: (parseInt(cs.fontWeight, 10) || 400) >= 600,
          italic: cs.fontStyle === "italic",
          underline: deco.includes("underline") ? { style: "sng" } : undefined,
          strike: deco.includes("line-through") ? "sngStrike" : undefined,
          superscript: va === "super" || undefined,
          subscript: va === "sub" || undefined,
          fontSize: Math.round((parseFloat(cs.fontSize) || 16) * PX_TO_PT * 10) / 10,
          fontFace: cs.fontFamily.split(",")[0].replace(/["']/g, "").trim() || undefined,
          color: cssHex(cs.color) ?? undefined,
          highlight: pe.tagName === "MARK" ? cssHex(cs.backgroundColor) ?? undefined : undefined,
        },
      });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const e = node as Element;
    if (e.matches(SKIP_SEL)) return;
    if (e.tagName === "BR") {
      close();
      return;
    }
    if (isBlock(e)) {
      block(e, p);
      return;
    }
    e.childNodes.forEach((c) => inline(c, p));
  };
  const block = (e: Element, base: RunOpts) => {
    if (e.matches(SKIP_SEL)) return;
    if (e.tagName === "UL" || e.tagName === "OL") {
      close();
      const level = (base.indentLevel ?? -1) + 1;
      for (const li of Array.from(e.children)) {
        if (li.tagName !== "LI") continue;
        const bullet: RunOpts["bullet"] = e.tagName === "OL" ? { type: "number", indent: 18 } : { indent: 18 };
        block(li, { ...base, bullet, indentLevel: level });
      }
      return;
    }
    close();
    const p = paraOf(e, base);
    for (const c of Array.from(e.childNodes)) {
      if (c.nodeType === Node.ELEMENT_NODE && isBlock(c as Element)) {
        close();
        // a nested block inside a list item continues without its own bullet
        const ce = c as Element;
        block(ce, ce.tagName === "UL" || ce.tagName === "OL" ? base : { ...base, bullet: undefined });
      } else {
        inline(c, p);
      }
    }
    close();
  };
  block(root, {});
  close();
  const out: Run[] = [];
  paras.forEach((para, i) => {
    para.runs.forEach((r, j) => {
      const o: RunOpts = { ...r.options };
      if (j === 0) Object.assign(o, para.p);
      if (j === para.runs.length - 1 && i < paras.length - 1) o.breakLine = true;
      out.push({ text: r.text, options: o });
    });
  });
  return out;
}

/** Place an HTML table as a native PowerPoint table at its measured box. */
function addTable(slide: pptxgen.Slide, table: Element, box: Box, objectName: string) {
  const rows: pptxgen.TableRow[] = [];
  table.querySelectorAll("tr").forEach((tr) => {
    const row: pptxgen.TableCell[] = [];
    tr.querySelectorAll("th, td").forEach((cell) => {
      const cs = getComputedStyle(cell);
      const fill = cssHex(cs.backgroundColor);
      const bt = parseFloat(cs.borderBottomWidth) || 0;
      row.push({
        text: (cell as HTMLElement).innerText.trim(),
        options: {
          bold: (parseInt(cs.fontWeight, 10) || 400) >= 600,
          fontSize: Math.round((parseFloat(cs.fontSize) || 16) * PX_TO_PT * 10) / 10,
          fontFace: cs.fontFamily.split(",")[0].replace(/["']/g, "").trim() || undefined,
          color: cssHex(cs.color) ?? undefined,
          align: (["center", "right"].includes(cs.textAlign) ? cs.textAlign : "left") as "left",
          valign: "middle",
          fill: fill ? { color: fill } : undefined,
          border: bt > 0 ? { type: "solid", pt: bt * PX_TO_PT, color: cssHex(cs.borderBottomColor) ?? "999999" } : { type: "none" },
          // cell margin is in inches, [T, R, B, L]
          margin: [
            (parseFloat(cs.paddingTop) || 0) / 96,
            (parseFloat(cs.paddingRight) || 0) / 96,
            (parseFloat(cs.paddingBottom) || 0) / 96,
            (parseFloat(cs.paddingLeft) || 0) / 96,
          ],
        },
      });
    });
    if (row.length) rows.push(row);
  });
  if (!rows.length) return;
  // column widths from the first row's measured cells
  const first = table.querySelector("tr");
  const tw = table.getBoundingClientRect().width || 1;
  const colW = first
    ? Array.from(first.querySelectorAll("th, td")).map((c) => (c.getBoundingClientRect().width / tw) * box.w)
    : undefined;
  slide.addTable(rows, { ...box, colW, objectName } as pptxgen.TableProps);
}

export async function buildPptxBase64(
  project: PosterProject,
  rootEl: HTMLElement,
): Promise<string> {
  const { doc } = project;
  const blockPaths = buildBlockPaths(doc.blocks);
  const size = posterSizeMm(doc.project);
  const inW = size.w / MM_PER_INCH;
  const inH = size.h / MM_PER_INCH;

  const pptx = new pptxgen();
  pptx.defineLayout({ name: "POSTER", width: inW, height: inH });
  pptx.layout = "POSTER";

  const slide = pptx.addSlide();
  slide.background = { color: hex(doc.theme.colors.background, "ffffff") };

  // Poster background image: PowerPoint stretches background images, so bake
  // color + image (fit / opacity) into one poster-aspect bitmap via canvas.
  const bgCfg = doc.theme.background;
  if (bgCfg?.image) {
    const base = bgCfg.image.replace(/\\/g, "/").split("/").pop() ?? bgCfg.image;
    const bgAsset = project.figures[base] ?? project.figures[bgCfg.image];
    if (bgAsset) {
      const data = await bakeBackground(
        bgAsset.dataUri,
        doc.theme.colors.background ?? "#ffffff",
        bgCfg,
        size.w / size.h,
      );
      if (data) slide.background = { data };
    }
  }

  const rootRect = rootEl.getBoundingClientRect();
  const toBox = (b: Box): Box => ({
    x: b.x * inW,
    y: b.y * inH,
    w: b.w * inW,
    h: b.h * inH,
  });

  // Everything below is measured from the live preview DOM: positions from
  // bounding boxes (normalized to the poster root, so the preview zoom does not
  // matter) and look from computed styles (CSS px are real-size px, 1px = 0.75pt).
  const place = (el: Element) => toBox(normRect(el, rootRect));
  const rectShape = (el: Element, objectName: string) => {
    const cs = getComputedStyle(el);
    const fill = cssHex(cs.backgroundColor);
    const bw = parseFloat(cs.borderTopWidth) || 0;
    const bl = parseFloat(cs.borderLeftWidth) || 0;
    if (fill || bw > 0) {
      slide.addShape("rect", {
        ...place(el),
        fill: fill ? { color: fill } : { type: "none" },
        line: bw > 0 ? { color: cssHex(cs.borderTopColor) ?? "666666", width: bw * PX_TO_PT } : { type: "none" },
        objectName,
      });
    }
    if (bl > 0 && bw === 0) {
      // left accent bar only (e.g. section titles, callouts)
      const b = place(el);
      slide.addShape("rect", {
        x: b.x, y: b.y, w: (bl / 96), h: b.h,
        fill: { color: cssHex(cs.borderLeftColor) ?? "1f5f99" }, line: { type: "none" }, objectName,
      });
    }
  };
  const textBox = (el: Element, objectName: string) => {
    const runs = textRuns(el);
    if (!runs.length) return;
    const cs = getComputedStyle(el);
    const px = (v: string) => (parseFloat(v) || 0) * PX_TO_PT;
    slide.addText(runs, {
      ...place(el),
      valign: "top",
      align: (["center", "right", "justify"].includes(cs.textAlign) ? cs.textAlign : "left") as "left",
      margin: [px(cs.paddingTop), px(cs.paddingRight), px(cs.paddingBottom), px(cs.paddingLeft) + px(cs.borderLeftWidth)], // pt, [T, R, B, L]
      fit: "none",
      objectName,
    });
  };

  // Header: band background, then each text line at its own measured box.
  const header = rootEl.querySelector(".rps-header");
  if (header) {
    rectShape(header, grpName("__header__"));
    header
      .querySelectorAll(".rps-conf, .rps-title, .rps-subtitle, .rps-authors, .rps-affil, .rps-header-badge")
      .forEach((el) => textBox(el, grpName("__header__")));
  }
  rootEl.querySelectorAll(".rps-footer-text").forEach((el) => textBox(el, grpName("__header__")));

  // Blocks: box (background / border), title, body text, tables. Only the
  // block's *own* title/body are used; child blocks are visited separately.
  rootEl.querySelectorAll("[data-block-id]").forEach((el) => {
    const id = el.getAttribute("data-block-id")!;
    if (id === "__header__") return; // header handled separately above
    const obj = grpName(blockPaths.get(id) ?? id);
    rectShape(el, obj);
    const titleEl = el.querySelector(":scope > .rps-block-title");
    if (titleEl) {
      rectShape(titleEl, obj);
      textBox(titleEl, obj);
    }
    const bodyEl = el.querySelector(":scope > .rps-block-body");
    if (bodyEl) {
      if (!bodyEl.children.length) {
        textBox(bodyEl, obj);
        return;
      }
      // Split the body at tables / figures so text never flows under them:
      // each run of consecutive text elements becomes one box at its own place.
      const bodyCs = getComputedStyle(bodyEl);
      let seg: Element[] = [];
      const flush = () => {
        if (!seg.length) return;
        const runs: Run[] = [];
        for (const e of seg) {
          const r = textRuns(e);
          if (!r.length) continue;
          // paragraph break between consecutive elements of the segment
          if (runs.length) runs[runs.length - 1].options = { ...runs[runs.length - 1].options, breakLine: true };
          runs.push(...r);
        }
        if (runs.length) {
          const first = place(seg[0]);
          const last = place(seg[seg.length - 1]);
          const body = place(bodyEl);
          slide.addText(runs, {
            x: body.x, y: first.y, w: body.w, h: Math.max(last.y + last.h - first.y, 0.05),
            valign: "top",
            margin: [0, (parseFloat(bodyCs.paddingRight) || 0) * PX_TO_PT, 0, (parseFloat(bodyCs.paddingLeft) || 0) * PX_TO_PT], // pt, [T, R, B, L]
            fit: "none",
            objectName: obj,
          });
        }
        seg = [];
      };
      for (const c of Array.from(bodyEl.children)) {
        if (c.matches("table") || c.querySelector(":scope table")) {
          flush();
          const t = c.matches("table") ? c : c.querySelector("table")!;
          addTable(slide, t, place(t), obj);
        } else if (c.matches(SKIP_SEL)) {
          flush();
        } else {
          seg.push(c);
        }
      }
      flush();
    }
  });

  // Institution logos (header / footer). The <img> src is already a data URI;
  // place each at its measured box.
  rootEl.querySelectorAll("img[data-logo-idx]").forEach((el) => {
    const src = (el as HTMLImageElement).src;
    if (!src.startsWith("data:")) return;
    const b = toBox(normRect(el, rootRect));
    slide.addImage({ data: src, ...b, objectName: grpName("__header__") });
  });

  // Figures. Crop is baked into a fresh data URI via canvas so PowerPoint shows
  // the trimmed image (not the enlarged full image). We place the image at the
  // *visible* box: the .rps-crop container when cropped, else the <img>.
  const figEls = Array.from(rootEl.querySelectorAll("[data-fig-id]"));
  for (const figEl of figEls) {
    const id = figEl.getAttribute("data-fig-id")!;
    const asset = project.figures[id];
    if (!asset) continue;
    const fig = doc.figures.find((f) => f.id === id);
    const figObj = grpName(
      fig?.block ? (blockPaths.get(fig.block) ?? fig.block) : "__figures__",
    );
    // gallery: place each rendered image at its measured box (src = data URI)
    if (fig?.images?.length) {
      figEl.querySelectorAll("img[data-asset-key]").forEach((img) => {
        const src = (img as HTMLImageElement).src;
        if (!src.startsWith("data:")) return;
        slide.addImage({ data: src, ...toBox(normRect(img, rootRect)), objectName: figObj });
      });
      continue;
    }
    const cropEl = figEl.querySelector(".rps-crop");
    const visibleEl = cropEl ?? figEl.querySelector("img");
    if (!visibleEl) continue;
    const b = toBox(normRect(visibleEl, rootRect));
    const c = fig?.crop;
    const cropped =
      c?.enabled && ((c.left ?? 0) || (c.right ?? 0) || (c.top ?? 0) || (c.bottom ?? 0));
    const data = cropped ? await cropDataUri(asset.dataUri, c) : asset.dataUri;
    slide.addImage({ data, ...b, objectName: figObj });
  }

  const out = (await pptx.write({ outputType: "base64" })) as string;
  // Wrap each block's shapes (text + figures + child-blocks) into PowerPoint
  // groups so a block moves/edits as one unit. Best-effort: returns `out` on error.
  return groupPptxBase64(out);
}

/** Bake background color + image (fit / opacity) into one poster-aspect JPEG. */
function bakeBackground(
  dataUri: string,
  color: string,
  cfg: { fit?: "cover" | "contain" | "tile"; opacity?: number },
  aspect: number,
): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      if (!iw || !ih) {
        resolve(null);
        return;
      }
      const W = 1600;
      const H = Math.max(1, Math.round(W / aspect));
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = cfg.opacity ?? 1;
      const fit = cfg.fit ?? "cover";
      if (fit === "tile") {
        for (let y = 0; y < H; y += ih)
          for (let x = 0; x < W; x += iw) ctx.drawImage(img, x, y);
      } else {
        const s = fit === "contain" ? Math.min(W / iw, H / ih) : Math.max(W / iw, H / ih);
        const dw = iw * s;
        const dh = ih * s;
        ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      }
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => resolve(null);
    img.src = dataUri;
  });
}

/** Return a new PNG data URI cropped to the fractional region (canvas-baked). */
function cropDataUri(
  dataUri: string,
  c: { left?: number; right?: number; top?: number; bottom?: number },
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const nW = img.naturalWidth;
      const nH = img.naturalHeight;
      const l = c.left ?? 0, r = c.right ?? 0, t = c.top ?? 0, b = c.bottom ?? 0;
      const sw = Math.max(1, (1 - l - r) * nW);
      const sh = Math.max(1, (1 - t - b) * nH);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(sw);
      canvas.height = Math.round(sh);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUri);
        return;
      }
      ctx.drawImage(img, l * nW, t * nH, sw, sh, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(dataUri);
    img.src = dataUri;
  });
}
