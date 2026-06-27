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
import { posterSizeMm, parseFontPt, MM_PER_INCH } from "@rps/core";
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

  // Header title
  const header = rootEl.querySelector(".rps-header");
  if (header) {
    const b = toBox(normRect(header, rootRect));
    slide.addText(
      [
        {
          text: doc.project.title,
          options: {
            bold: true,
            fontSize: parseFontPt(doc.theme.font_size.title) ?? 54,
            color: hex(doc.theme.colors.heading, "111111"),
          },
        },
        ...(doc.project.subtitle
          ? [
              {
                text: "\n" + doc.project.subtitle,
                options: {
                  fontSize: parseFontPt(doc.theme.font_size.subtitle) ?? 32,
                  color: hex(doc.theme.colors.accent, "1f5f99"),
                },
              },
            ]
          : []),
        {
          text: "\n" + doc.project.authors.map((a) => a.name).join("，"),
          options: { fontSize: parseFontPt(doc.theme.font_size.heading2) ?? 28 },
        },
      ],
      { ...b, align: "center", valign: "middle", objectName: grpName("__header__") },
    );
  }

  // Blocks
  const bodyPt = parseFontPt(doc.theme.font_size.body) ?? 22;
  const headPt = parseFontPt(doc.theme.font_size.heading1) ?? 34;
  rootEl.querySelectorAll("[data-block-id]").forEach((el) => {
    const id = el.getAttribute("data-block-id")!;
    if (id === "__header__") return; // header handled separately above
    const block = doc.blocks.find((b) => b.id === id);
    const titleEl = el.querySelector(".rps-block-title");
    const bodyEl = el.querySelector(".rps-block-body");
    const title = titleEl?.textContent?.trim() ?? block?.title ?? "";
    const body = (bodyEl as HTMLElement)?.innerText?.trim() ?? "";
    const b = toBox(normRect(el, rootRect));

    const blkBodyPt = parseFontPt(block?.style?.body_font_size) ?? bodyPt;
    const headingColor = hex(doc.theme.colors.heading, "111111");

    slide.addText(
      [
        ...(title
          ? [
              {
                text: title,
                options: { bold: true, fontSize: headPt, color: headingColor },
              },
            ]
          : []),
        ...(body
          ? [{ text: (title ? "\n" : "") + body, options: { fontSize: blkBodyPt } }]
          : []),
      ],
      {
        ...b,
        align: "left",
        valign: "top",
        color: hex(doc.theme.colors.text, "222222"),
        objectName: grpName(blockPaths.get(id) ?? id),
        fill: block?.style?.background
          ? { color: hex(block.style.background, "ffffff") }
          : undefined,
        line: block?.style?.border
          ? { color: hex(block.style.border_color, "666666"), width: 1 }
          : undefined,
      },
    );
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
