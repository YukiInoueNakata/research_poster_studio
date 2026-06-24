// SVG export.
//
// The poster is wrapped in an <svg><foreignObject> containing the same XHTML
// markup and CSS as the HTML export, sized in millimetres. Vector figures
// (SVG) and text stay crisp; the file is self-contained (data-URI figures).

import type { PosterProject } from "@rps/core";
import { mmToPx, posterSizeMm } from "@rps/core";
import { posterCss } from "./posterCss";
import { renderPosterMarkup, type RenderMarkupOptions } from "./html";

export function buildSvg(project: PosterProject, opts?: RenderMarkupOptions): string {
  const { doc } = project;
  const size = posterSizeMm(doc.project);
  const wpx = mmToPx(size.w);
  const hpx = mmToPx(size.h);
  const markup = renderPosterMarkup(project, opts);
  const css = posterCss(doc);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${size.w}mm" height="${size.h}mm" viewBox="0 0 ${wpx.toFixed(2)} ${hpx.toFixed(2)}">
  <foreignObject x="0" y="0" width="${wpx.toFixed(2)}" height="${hpx.toFixed(2)}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${size.w}mm;height:${size.h}mm;">
      <style>${css}</style>
      ${markup}
    </div>
  </foreignObject>
</svg>`;
}
