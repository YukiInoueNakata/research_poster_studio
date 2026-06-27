// PPTX shape grouping (post-process).
//
// pptxgenjs places every shape flat on the slide — it has no API to emit
// PowerPoint groups (<p:grpSp>). We tag each shape with an objectName of the
// form `rps|<path>` (path = block ancestry, slash-separated; e.g. `intro` or
// `results/exp1`). This pass unzips the .pptx, wraps the shapes of each
// block — its text, its figures and its child-blocks — into nested <p:grpSp>
// groups, and rezips, so a block (and its parts / child-blocks) moves as one
// unit in PowerPoint. Shapes without an `rps|` name stay ungrouped.
//
// Coordinates: every group uses chOff = off and chExt = ext (1:1), so child
// shapes keep their absolute EMU coordinates at any nesting depth — no
// per-shape coordinate rewrite is needed.

import JSZip from "jszip";

const P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main";
const A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
const TAG = "rps|";

interface Shape {
  el: Element;
  path: string[] | null;
  off: { x: number; y: number };
  ext: { cx: number; cy: number };
}
interface GroupNode {
  name: string;
  children: Map<string, GroupNode>;
  shapes: Shape[];
}

function getDOM(): { parser: DOMParser; serializer: XMLSerializer } {
  const g = globalThis as unknown as {
    DOMParser: typeof DOMParser;
    XMLSerializer: typeof XMLSerializer;
  };
  return { parser: new g.DOMParser(), serializer: new g.XMLSerializer() };
}

function readXfrm(shape: Element): { off: Shape["off"]; ext: Shape["ext"] } {
  const off = shape.getElementsByTagName("a:off")[0];
  const ext = shape.getElementsByTagName("a:ext")[0];
  return {
    off: { x: Number(off?.getAttribute("x") ?? 0), y: Number(off?.getAttribute("y") ?? 0) },
    ext: { cx: Number(ext?.getAttribute("cx") ?? 0), cy: Number(ext?.getAttribute("cy") ?? 0) },
  };
}

function shapeName(shape: Element): string | null {
  return shape.getElementsByTagName("p:cNvPr")[0]?.getAttribute("name") ?? null;
}

function bbox(shapes: Shape[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of shapes) {
    minX = Math.min(minX, s.off.x);
    minY = Math.min(minY, s.off.y);
    maxX = Math.max(maxX, s.off.x + s.ext.cx);
    maxY = Math.max(maxY, s.off.y + s.ext.cy);
  }
  return { x: minX, y: minY, cx: Math.max(1, maxX - minX), cy: Math.max(1, maxY - minY) };
}

function collectShapes(node: GroupNode, out: Shape[]): Shape[] {
  out.push(...node.shapes);
  for (const c of node.children.values()) collectShapes(c, out);
  return out;
}

/**
 * Rewrite a slide's XML, wrapping rps-tagged shapes into nested <p:grpSp>
 * groups. Pure (no zip): exported for unit testing.
 */
export function regroupSlideXml(xml: string): string {
  const { parser, serializer } = getDOM();
  const doc = parser.parseFromString(xml, "application/xml");
  const spTree = doc.getElementsByTagName("p:spTree")[0];
  if (!spTree) return xml;

  // Next free cNvPr id.
  let nextId = 1;
  const cnv = doc.getElementsByTagName("p:cNvPr");
  for (let i = 0; i < cnv.length; i++) {
    nextId = Math.max(nextId, Number(cnv[i].getAttribute("id") ?? 0) + 1);
  }

  // Partition spTree's direct children into shapes (p:sp / p:pic) and the
  // tree's own props (p:nvGrpSpPr / p:grpSpPr), which must stay first.
  const shapes: Shape[] = [];
  const ungrouped: Element[] = [];
  for (const child of Array.from(spTree.childNodes)) {
    if (child.nodeType !== 1) continue;
    const el = child as Element;
    const tag = el.tagName;
    if (tag !== "p:sp" && tag !== "p:pic") continue; // leave props in place
    const name = shapeName(el);
    const { off, ext } = readXfrm(el);
    const path = name && name.startsWith(TAG) ? name.slice(TAG.length).split("/") : null;
    const s: Shape = { el, path, off, ext };
    if (path) shapes.push(s);
    else ungrouped.push(el);
  }
  if (!shapes.length) return xml; // nothing tagged → unchanged

  // Build the group tree by path.
  const root: GroupNode = { name: "", children: new Map(), shapes: [] };
  for (const s of shapes) {
    let node = root;
    for (const seg of s.path!) {
      let next = node.children.get(seg);
      if (!next) {
        next = { name: seg, children: new Map(), shapes: [] };
        node.children.set(seg, next);
      }
      node = next;
    }
    node.shapes.push(s);
  }

  const el = (ns: string, qn: string) => doc.createElementNS(ns, qn);
  const buildGrp = (node: GroupNode): Element => {
    const box = bbox(collectShapes(node, []));
    const grp = el(P_NS, "p:grpSp");

    const nv = el(P_NS, "p:nvGrpSpPr");
    const cNvPr = el(P_NS, "p:cNvPr");
    cNvPr.setAttribute("id", String(nextId++));
    cNvPr.setAttribute("name", `${TAG}grp:${node.name}`);
    nv.appendChild(cNvPr);
    nv.appendChild(el(P_NS, "p:cNvGrpSpPr"));
    nv.appendChild(el(P_NS, "p:nvPr"));
    grp.appendChild(nv);

    const pr = el(P_NS, "p:grpSpPr");
    const xfrm = el(A_NS, "a:xfrm");
    const off = el(A_NS, "a:off");
    off.setAttribute("x", String(box.x));
    off.setAttribute("y", String(box.y));
    const ext = el(A_NS, "a:ext");
    ext.setAttribute("cx", String(box.cx));
    ext.setAttribute("cy", String(box.cy));
    const chOff = el(A_NS, "a:chOff");
    chOff.setAttribute("x", String(box.x));
    chOff.setAttribute("y", String(box.y));
    const chExt = el(A_NS, "a:chExt");
    chExt.setAttribute("cx", String(box.cx));
    chExt.setAttribute("cy", String(box.cy));
    xfrm.appendChild(off);
    xfrm.appendChild(ext);
    xfrm.appendChild(chOff);
    xfrm.appendChild(chExt);
    pr.appendChild(xfrm);
    grp.appendChild(pr);

    for (const s of node.shapes) grp.appendChild(s.el); // moves the node
    for (const c of node.children.values()) grp.appendChild(buildGrp(c));
    return grp;
  };

  // Detach all tagged shapes, then re-attach ungrouped flat + one grpSp per
  // top-level group.
  for (const s of shapes) spTree.removeChild(s.el);
  for (const u of ungrouped) {
    if (u.parentNode === spTree) continue; // already in place
  }
  for (const c of root.children.values()) spTree.appendChild(buildGrp(c));

  return serializer.serializeToString(doc);
}

/** Find the (single) slide XML path inside a pptx zip. */
function slidePath(zip: JSZip): string | null {
  const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  names.sort();
  return names[0] ?? null;
}

/**
 * Given a base64 .pptx (from pptxgenjs), wrap rps-tagged shapes into PowerPoint
 * groups and return the new base64. On any failure returns the input unchanged.
 */
export async function groupPptxBase64(base64: string): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(base64, { base64: true });
    const path = slidePath(zip);
    if (!path) return base64;
    const xml = await zip.file(path)!.async("string");
    const grouped = regroupSlideXml(xml);
    if (grouped === xml) return base64;
    zip.file(path, grouped);
    return await zip.generateAsync({ type: "base64" });
  } catch {
    return base64; // grouping is best-effort; never break export
  }
}
