// Fill defaults on a parsed (possibly partial) poster document so that
// Agent-generated or hand-written YAML always produces a renderable model.

import type {
  Block,
  Figure,
  Layout,
  PaperSize,
  PosterDoc,
  ProjectMeta,
  Theme,
} from "./types";
import { PAPER_MM, parseLengthMm } from "./units";
import { MAX_COLUMNS } from "./layout";

export const DEFAULT_THEME: Theme = {
  name: "default",
  font_family: {
    body: "Noto Sans JP",
    heading: "Noto Sans JP",
    title: "Noto Sans JP",
  },
  font_size: {
    title: "54pt",
    subtitle: "32pt",
    heading1: "34pt",
    heading2: "28pt",
    body: "22pt",
    caption: "16pt",
    references: "13pt",
  },
  colors: {
    text: "#222222",
    heading: "#111111",
    accent: "#1f5f99",
    warning: "#c00000",
    muted: "#666666",
    background: "#ffffff",
  },
};

const DEFAULT_LAYOUT: Layout = {
  template: "two-column-research",
  columns: {
    count: 2,
    width_mode: "ratio",
    ratio: [0.5, 0.5],
    height_balance: "auto",
    sync_mode: "independent",
  },
  margin_mm: 25,
  gap_mm: 12,
};

const DEFAULT_PROJECT: ProjectMeta = {
  title: "Untitled Poster",
  authors: [],
  poster_size: "A0",
  orientation: "portrait",
};

function deepMerge<T>(base: T, override: any): T {
  if (override == null) return base;
  if (Array.isArray(base) || Array.isArray(override)) return override ?? base;
  if (typeof base === "object" && typeof override === "object") {
    const out: any = { ...base };
    for (const k of Object.keys(override)) {
      out[k] = deepMerge((base as any)[k], override[k]);
    }
    return out;
  }
  return override ?? base;
}

const childDefaults = (id: string, column: string, order: number, extra: Partial<Block>): Block => ({
  id,
  type: "text",
  title: "",
  column: column as Block["column"],
  order,
  visible: true,
  height: { mode: "auto", weight: 1 },
  style: {},
  figures: [],
  overflow: { action: "warn" },
  ...extra,
});

/**
 * Standalone figure placement: a figure with placement full-width / column
 * that no block owns is rendered as its own top-level figure block
 * (`__fig_<figId>`), placed in the wide band (full-width) or the named
 * column. Idempotent — safe to call again after GUI edits so placement
 * changes add / move / remove the synthesized block immediately:
 * - qualifies and missing  -> push the synthesized block
 * - qualifies and existing -> update its column (placement change)
 * - no longer qualifies    -> remove the synthesized block
 * "Owned" means a block references the figure (figure_id / figures) or the
 * figure's `block` points at an existing non-synthesized block.
 */
export function syncStandaloneFigureBlocks(blocks: Block[], figures: Figure[]): void {
  const referenced = new Set<string>();
  const ids = new Set<string>();
  const collectRefs = (bs: Block[]) => {
    for (const b of bs) {
      ids.add(b.id);
      if (!b.id.startsWith("__fig_")) {
        if (b.figure_id) referenced.add(b.figure_id);
        (b.figures ?? []).forEach((id) => referenced.add(id));
      }
      if (b.children?.length) collectRefs(b.children);
    }
  };
  collectRefs(blocks);
  let maxOrder = blocks.reduce((m, b) => Math.max(m, b.order), 0);
  for (const f of figures) {
    const id = `__fig_${f.id}`;
    const idx = blocks.findIndex((b) => b.id === id);
    const ownedElsewhere =
      referenced.has(f.id) || (!!f.block && f.block !== id && ids.has(f.block));
    const qualifies =
      !ownedElsewhere && (f.placement === "full-width" || f.placement === "column");
    if (qualifies) {
      const column = (f.placement === "full-width" ? "wide" : f.column ?? "left") as Block["column"];
      f.block = id;
      if (idx >= 0) {
        blocks[idx] = { ...blocks[idx], type: "figure", figure_id: f.id, column };
      } else {
        blocks.push(
          childDefaults(id, column, f.order ?? ++maxOrder, { type: "figure", figure_id: f.id }),
        );
      }
    } else if (idx >= 0) {
      blocks.splice(idx, 1);
      if (f.block === id) f.block = undefined;
    }
  }
}

/**
 * Owned-figure migration: a (non-figure) block that owns figures
 * (figure.block points at it, or its `figures` list names them) becomes a
 * container — its body moves to a `<id>__text` child and each owned figure
 * gets a `<id>__fig_<figId>` figure child. Also prunes figure blocks whose
 * figure has been re-assigned elsewhere. Idempotent — called at normalize
 * AND on every GUI figure edit so 所属ブロック changes reflect immediately.
 * Returns a new tree (does not mutate the input blocks); figure.block IS
 * rewritten in place on the figures array.
 */
export function syncOwnedFigureChildBlocks(blocks: Block[], figures: Figure[]): Block[] {
  const figById = new Map(figures.map((f) => [f.id, f]));

  // 1) drop figure blocks whose figure now belongs to a different block
  const prune = (bs: Block[]): Block[] =>
    bs
      .filter((b) => {
        if (b.type !== "figure" || !b.figure_id) return true;
        const f = figById.get(b.figure_id);
        return !f || f.block === b.id;
      })
      .map((b) => (b.children?.length ? { ...b, children: prune(b.children) } : b));

  // 2) migrate blocks that own figures into containers
  const migrate = (b: Block): Block => {
    const nb: Block = b.children?.length ? { ...b, children: b.children.map(migrate) } : b;
    if (nb.type === "figure") return nb;
    const owned = figures
      // floated figures stay inside the owning block's body flow (text wraps
      // around them); don't migrate them into a separate figure child (N4)
      .filter((f) => !f.float && (f.block === nb.id || (nb.figures ?? []).includes(f.id)))
      .sort((a, c) => (a.order ?? 0) - (c.order ?? 0));
    if (owned.length === 0) return nb;

    const children: Block[] = [];
    if (nb.source) {
      children.push(childDefaults(`${nb.id}__text`, "wide", -100, { source: nb.source }));
    }
    owned.forEach((f, k) => {
      const cid = `${nb.id}__fig_${f.id}`;
      f.block = cid; // figure now belongs to its figure child block
      children.push(
        childDefaults(cid, (f.column as string) ?? "wide", -99 + k, {
          type: "figure",
          figure_id: f.id,
        }),
      );
    });
    if (nb.children?.length) children.push(...nb.children);

    return { ...nb, source: undefined, figures: [], children };
  };

  return prune(blocks).map(migrate);
}

export function normalizeDoc(raw: any): PosterDoc {
  const project = deepMerge(DEFAULT_PROJECT, raw?.project ?? {}) as ProjectMeta;
  if (!Array.isArray(project.authors)) project.authors = [];

  // ---- normalize authors + affiliations into the indexed model ----
  const rawAuthors: any[] = Array.isArray(raw?.project?.authors)
    ? raw.project.authors
    : [];
  const affiliations: string[] = Array.isArray(raw?.project?.affiliations)
    ? raw.project.affiliations.slice()
    : [];
  // derive the master list from legacy per-author strings if none given
  if (affiliations.length === 0) {
    for (const a of rawAuthors) {
      const s = typeof a?.affiliation === "string" ? a.affiliation.trim() : "";
      if (s && !affiliations.includes(s)) affiliations.push(s);
    }
  }
  project.affiliations = affiliations;
  project.affiliation_line_breaks = Array.isArray(raw?.project?.affiliation_line_breaks)
    ? raw.project.affiliation_line_breaks.filter(
        (n: any) => typeof n === "number" && n >= 0 && n < affiliations.length,
      )
    : [];
  project.authors = rawAuthors.map((a) => {
    let idx: number[] = [];
    if (Array.isArray(a?.affiliations)) {
      idx = a.affiliations
        .map((n: any) => (typeof n === "number" ? n : affiliations.indexOf(String(n))))
        .filter((n: number) => n >= 0 && n < affiliations.length);
    } else if (typeof a?.affiliation === "string" && a.affiliation.trim()) {
      const i = affiliations.indexOf(a.affiliation.trim());
      if (i >= 0) idx = [i];
    }
    return { name: a?.name ?? "", affiliations: idx };
  });

  // keywords: accept a string[] or a single comma/、-separated string
  const rawKw = raw?.project?.keywords;
  project.keywords = Array.isArray(rawKw)
    ? rawKw.map((s: any) => String(s).trim()).filter(Boolean)
    : typeof rawKw === "string"
      ? rawKw.split(/[,，、;；]/).map((s) => s.trim()).filter(Boolean)
      : [];

  // ---- poster size / units ----
  if (!(project.poster_size in PAPER_MM)) project.poster_size = "A0" as PaperSize;
  project.orientation = project.orientation === "landscape" ? "landscape" : "portrait";
  project.units = project.units === "in" ? "in" : "mm";
  // custom_size: accept width_mm/height_mm numbers or width/height strings
  // with units ("36in", "914mm"); fall back to A0 portrait
  const rawCs = raw?.project?.custom_size;
  if (project.poster_size === "custom" || rawCs != null) {
    const w =
      (typeof rawCs?.width_mm === "number" ? rawCs.width_mm : undefined) ??
      parseLengthMm(rawCs?.width) ??
      PAPER_MM.A0.w;
    const h =
      (typeof rawCs?.height_mm === "number" ? rawCs.height_mm : undefined) ??
      parseLengthMm(rawCs?.height) ??
      PAPER_MM.A0.h;
    project.custom_size = {
      width_mm: w > 0 ? w : PAPER_MM.A0.w,
      height_mm: h > 0 ? h : PAPER_MM.A0.h,
    };
  }

  const layout = deepMerge(DEFAULT_LAYOUT, raw?.layout ?? {}) as Layout;
  // clamp column count to the supported range (1..MAX_COLUMNS)
  const rawCount = Number(layout.columns.count);
  layout.columns.count = Number.isFinite(rawCount)
    ? Math.min(MAX_COLUMNS, Math.max(1, Math.round(rawCount)))
    : 2;
  // keep ratio length consistent with column count
  if (!Array.isArray(layout.columns.ratio) || layout.columns.ratio.length === 0) {
    layout.columns.ratio = Array(layout.columns.count).fill(1 / layout.columns.count);
  }

  const theme = deepMerge(DEFAULT_THEME, raw?.theme ?? {}) as Theme;
  // background image: keep only when an image path is set; clamp opacity 0-1
  if (theme.background) {
    const bg = theme.background;
    if (typeof bg.image === "string" && bg.image) {
      theme.background = {
        image: bg.image,
        fit: bg.fit === "contain" || bg.fit === "tile" ? bg.fit : "cover",
        opacity:
          typeof bg.opacity === "number" ? Math.min(1, Math.max(0, bg.opacity)) : 1,
      };
    } else {
      theme.background = undefined;
    }
  }

  // Figures are normalized first so block migration can reference/own them.
  const figures: Figure[] = (raw?.figures ?? []).map((f: any, i: number) => ({
    id: f.id ?? `fig-${i + 1}`,
    path: f.path ?? "",
    images: Array.isArray(f.images) && f.images.some((p: any) => typeof p === "string" && p)
      ? f.images.filter((p: any) => typeof p === "string" && p)
      : undefined,
    gallery_columns:
      typeof f.gallery_columns === "number" && f.gallery_columns > 0
        ? Math.floor(f.gallery_columns)
        : undefined,
    caption: f.caption,
    placement: f.placement ?? "inside-block",
    block: f.block,
    column: f.column,
    order: f.order,
    scale: typeof f.scale === "number" ? f.scale : 1,
    align: f.align ?? "center",
    valign: f.valign,
    float: f.float === "left" || f.float === "right" ? f.float : undefined,
    crop: f.crop ?? { enabled: false },
    image_crops:
      f.image_crops && typeof f.image_crops === "object" ? f.image_crops : undefined,
    style: {
      border: f.style?.border ?? false,
      border_color: f.style?.border_color,
      caption_position: f.style?.caption_position ?? "bottom",
      caption_font_size: f.style?.caption_font_size,
      caption_color: f.style?.caption_color,
      title_inside_border: f.style?.title_inside_border,
      transparent_white: f.style?.transparent_white ?? false,
    },
  }));

  // Block normalization is recursive; the owned-figure migration runs after
  // (see syncOwnedFigureChildBlocks).
  const normalizeBlock = (b: any, i: number): Block => {
    const id = b.id ?? `block-${i + 1}`;
    const base: Block = {
      id,
      type: b.type ?? "text",
      title: b.title ?? "",
      source: b.source,
      column: b.column ?? "left",
      order: b.order ?? i + 1,
      visible: b.visible !== false,
      height: {
        mode: b.height?.mode ?? "auto",
        value: b.height?.value,
        min: b.height?.min,
        max: b.height?.max,
        weight: b.height?.weight ?? 1,
      },
      sync: b.sync,
      pin_bottom: b.pin_bottom ?? false,
      style: b.style ?? {},
      figures: b.figures ?? [],
      overflow: { action: b.overflow?.action ?? "warn" },
      references_list: b.references_list === true ? true : undefined,
      figure_id: b.figure_id,
      child_layout: b.child_layout,
      children: Array.isArray(b.children)
        ? b.children.map((c: any, ci: number) => normalizeBlock(c, ci))
        : undefined,
    };
    return base;
  };

  // Owned-figure migration (see syncOwnedFigureChildBlocks), then standalone
  // figure placement (see syncStandaloneFigureBlocks).
  const blocks: Block[] = syncOwnedFigureChildBlocks(
    (raw?.blocks ?? []).map((b: any, i: number) => normalizeBlock(b, i)),
    figures,
  );
  syncStandaloneFigureBlocks(blocks, figures);

  const h = raw?.header ?? {};
  const header = {
    align: h.align ?? "center",
    background: h.background,
    border: h.border ?? false,
    border_color: h.border_color,
    border_width: h.border_width,
    padding_mm: h.padding_mm,
    show_affiliation: h.show_affiliation ?? true,
    affiliation_marker: h.affiliation_marker ?? "number",
    title_color: h.title_color,
    accent_color: h.accent_color,
    text_color: h.text_color,
    conference_font_size: h.conference_font_size,
    conference_align: h.conference_align,
    title_font_size: h.title_font_size,
    title_align: h.title_align,
    subtitle_font_size: h.subtitle_font_size,
    subtitle_align: h.subtitle_align,
    // accept legacy author_font_size as the authors size
    authors_font_size: h.authors_font_size ?? h.author_font_size,
    authors_align: h.authors_align,
    author_separator: h.author_separator,
    affil_font_size: h.affil_font_size,
    affil_align: h.affil_align,
    affiliation_inline: h.affiliation_inline ?? false,
    show_keywords: h.show_keywords ?? true,
    keywords_label: h.keywords_label,
    keywords_font_size: h.keywords_font_size,
    keywords_align: h.keywords_align,
    logos: Array.isArray(h.logos)
      ? h.logos
          .filter((l: any) => l && typeof l.path === "string" && l.path)
          .map((l: any) => ({
            path: l.path,
            area: l.area === "footer" ? "footer" : "header",
            position:
              l.position === "center" || l.position === "right" ? l.position : "left",
            height_mm:
              typeof l.height_mm === "number" && l.height_mm > 0 ? l.height_mm : 20,
          }))
      : [],
    footer_left: h.footer_left,
    footer_center: h.footer_center,
    footer_right: h.footer_right,
    footer_background: h.footer_background,
    footer_text_color: h.footer_text_color,
    footer_font_size: h.footer_font_size,
  };

  // references (citation mode) config passthrough
  const rawRefs = raw?.references;
  const references =
    rawRefs && typeof rawRefs === "object"
      ? {
          bib: typeof rawRefs.bib === "string" && rawRefs.bib ? rawRefs.bib : undefined,
          style:
            typeof rawRefs.style === "string" && rawRefs.style ? rawRefs.style : undefined,
          include_doi:
            typeof rawRefs.include_doi === "boolean" ? rawRefs.include_doi : undefined,
        }
      : undefined;

  return {
    project,
    layout,
    theme,
    header,
    blocks,
    figures,
    references,
    export: raw?.export,
  };
}
