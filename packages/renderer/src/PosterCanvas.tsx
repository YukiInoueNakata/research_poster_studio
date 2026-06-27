// Renders the poster at true millimetre size. Used live in the preview (with
// selection, A0 frame, margin guide, overflow markers) and via
// renderToStaticMarkup for HTML/SVG export.
//
// Bands and blocks render recursively: a block with `children` lays its
// children out with the same band system (wide / left-right) inside itself.

import { createContext, useContext, useMemo } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Band, Block, CitationPrep, Crop, DiagramResolver, Figure, HAlign, HeightSyncMode, LogoConfig, PosterProject } from "@rps/core";
import { HEADER_ID, computeBands, layoutBlocks, numberedCaptions, prepareCitations, sectionNumbers } from "@rps/core";
import { dataUriToText, mmToPx, parseCsv, posterSizeMm, parseFontPt, parseLengthMm } from "@rps/core";
import { renderMarkdown } from "./markdown";
import { boxStyle, bodyTextStyle, headingStyle, heightStyle, resolveColor } from "./style";
import { posterCss } from "./posterCss";

export interface PosterCanvasProps {
  project: PosterProject;
  mode?: "preview" | "export";
  selectedBlockId?: string | null;
  onSelectBlock?: (id: string) => void;
  /** double-click a block in the preview to edit its body text inline */
  onEditBlock?: (id: string) => void;
  showBoundaries?: boolean;
  /** ids of blocks whose content overflows (preview only, from measurement) */
  overflowIds?: Set<string>;
  /** preview zoom; UI chrome is counter-scaled by 1/zoom to stay crisp */
  zoom?: number;
  selectedFigureId?: string | null;
  onSelectFigure?: (id: string) => void;
  showFontBadges?: boolean;
  /** all selected block ids (multi-select highlight) */
  selectedIds?: string[];
  /** rendered SVG lookup for ```mermaid / ```dot code blocks (env-specific) */
  diagram?: DiagramResolver;
}

interface RenderCtx {
  project: PosterProject;
  mode: "preview" | "export";
  k: number;
  selSet: Set<string>;
  selectedFigureId?: string | null;
  overflowIds?: Set<string>;
  showBoundaries: boolean;
  showFontBadges: boolean;
  onSelectBlock?: (id: string) => void;
  onEditBlock?: (id: string) => void;
  onSelectFigure?: (id: string) => void;
  /** horizontal gap between columns */
  colGap: string;
  /** vertical gap between stacked blocks / bands */
  rowGap: string;
  /** citation mode: [@key] expansion + generated reference list */
  cite: CitationPrep;
  /** rendered SVG lookup for diagram code blocks */
  diagram?: DiagramResolver;
  /** opt-in section numbers: blockId -> "1" / "1.1" (empty when off) */
  sectionNums: Map<string, string>;
  /** opt-in figure renumbering: figureId -> rewritten caption (empty when off) */
  captionNums: Map<string, string>;
}

const Ctx = createContext<RenderCtx | null>(null);
const useCtx = () => useContext(Ctx)!;

function figuresForBlock(project: PosterProject, block: Block): Figure[] {
  const { figures } = project.doc;
  const out: Figure[] = [];
  for (const f of figures) {
    if (f.block === block.id || (block.figures ?? []).includes(f.id)) {
      out.push(f);
    }
  }
  return out.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function FigureView({
  fig,
  interactive = true,
  noBorder = false,
}: {
  fig: Figure;
  interactive?: boolean;
  noBorder?: boolean;
}) {
  const { project, mode, k, selectedFigureId, onSelectFigure, cite, captionNums } = useCtx();
  const selected = interactive && selectedFigureId === fig.id;
  const captionText = captionNums.get(fig.id) ?? fig.caption;
  const asset = project.figures[fig.id];
  const align = fig.align ?? "center";
  const scalePct = `${Math.round((fig.scale ?? 1) * 100)}%`;
  const border = !noBorder && fig.style?.border
    ? `1pt solid ${resolveColor(fig.style.border_color, project.doc.theme) ?? "#999"}`
    : undefined;
  const capPos = fig.style?.caption_position ?? "bottom";
  // scale > 1 lets the image bleed past the block; drop the max-width clamp.
  const allowOversize = (fig.scale ?? 1) > 1;
  // transparent_white: multiply-blend so a white/light image background shows
  // the page through it (no true alpha, but right for light-bg posters).
  const blend: CSSProperties = fig.style?.transparent_white ? { mixBlendMode: "multiply" } : {};
  const imgExtra: CSSProperties = { ...(allowOversize ? { maxWidth: "none" } : null), ...blend };

  const caption = captionText ? (
    <figcaption
      className="rps-figcaption"
      style={{
        fontSize: fig.style?.caption_font_size,
        color: resolveColor(fig.style?.caption_color, project.doc.theme),
        ...(capPos === "left" || capPos === "right"
          ? { textAlign: "left", margin: 0, flex: 1 }
          : null),
      }}
    >
      {cite.active ? cite.expand(captionText) : captionText}
    </figcaption>
  ) : null;

  // gallery: main image + fig.images, one shared caption. Items in a row get
  // flex-grow = aspect ratio so they auto-align to equal heights (falls back
  // to equal widths until intrinsic sizes are known).
  const galleryPaths = fig.images ?? [];
  const galleryAssets =
    galleryPaths.length > 0
      ? [
          { key: fig.id, asset, path: fig.path },
          ...galleryPaths.map((p) => {
            const base = p.replace(/\\/g, "/").split("/").pop() ?? p;
            return { key: base, asset: project.figures[base] ?? project.figures[p], path: p };
          }),
        ]
      : null;
  // per-image crop (N13): image_crops[path] for any image, else fig.crop for main
  const cropForPath = (path: string): Crop | undefined => {
    const ic = fig.image_crops?.[path];
    if (ic?.enabled) return ic;
    if (path === fig.path && fig.crop?.enabled) return fig.crop;
    return undefined;
  };

  const c = fig.crop;
  const nW = asset?.naturalWidth;
  const nH = asset?.naturalHeight;
  // CSV figure file -> 簡易表（1 行目をヘッダー扱い，scale は文字サイズに掛ける）
  const isCsvAsset = !!asset && /\.csv$/i.test(asset.name);
  // text-source figure (pdf / mmd / dot) that was not converted to an image
  // (CLI / headless load) -> placeholder instead of a broken <img>
  // EMF/WMF cannot be drawn by the browser — show a placeholder until the
  // user converts it to PNG (N12, desktop).
  const isEmfAsset = !!asset && /\.(emf|wmf)$/i.test(asset.name);
  const isUnconverted =
    !!asset &&
    !isCsvAsset &&
    (isEmfAsset ||
      /^data:(text\/|application\/pdf|application\/octet-stream|image\/x-emf|image\/x-wmf)/.test(
        asset.dataUri,
      ));
  let imageEl: ReactNode;
  if (isCsvAsset && asset) {
    const rows = parseCsv(dataUriToText(asset.dataUri));
    imageEl = (
      <div
        className="rps-tablewrap"
        style={{
          display: "inline-block",
          border,
          fontSize: `${Math.round((fig.scale ?? 1) * 100)}%`,
          maxWidth: "100%",
        }}
      >
        <table className="rps-table">
          {rows.length > 0 ? (
            <thead>
              <tr>
                {rows[0].map((cell, i) => (
                  <th key={i}>{cell}</th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {rows.slice(1).map((r, ri) => (
              <tr key={ri}>
                {r.map((cell, ci) => (
                  <td key={ci}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } else if (isUnconverted && asset) {
    imageEl = (
      <div className="rps-figure-missing">
        [未変換の図表: {asset.name}（desktop アプリで読み込むと画像化されます）]
      </div>
    );
  } else if (galleryAssets) {
    const perRow = fig.gallery_columns ?? galleryAssets.length;
    const rows: (typeof galleryAssets)[] = [];
    for (let i = 0; i < galleryAssets.length; i += perRow) {
      rows.push(galleryAssets.slice(i, i + perRow));
    }
    imageEl = (
      <div className="rps-gallery" style={{ width: scalePct, border, ...(allowOversize ? { maxWidth: "none" } : null) }}>
        {rows.map((row, ri) => (
          <div className="rps-gallery-row" key={ri}>
            {row.map(({ key, asset: a, path }, ii) => {
              if (!a) {
                return (
                  <div key={`${key}-${ii}`} className="rps-figure-missing" style={{ flexGrow: 1 }}>
                    [missing: {key}]
                  </div>
                );
              }
              const gc = cropForPath(path);
              const gl = gc?.left ?? 0, gr = gc?.right ?? 0, gt = gc?.top ?? 0, gb = gc?.bottom ?? 0;
              const cw = gc ? Math.max(0.01, 1 - gl - gr) : 1;
              const ch = gc ? Math.max(0.01, 1 - gt - gb) : 1;
              const flexGrow =
                a.naturalWidth && a.naturalHeight
                  ? (cw * a.naturalWidth) / (ch * a.naturalHeight)
                  : 1;
              return (
                <div key={`${key}-${ii}`} className="rps-gallery-item" style={{ flexGrow }}>
                  {gc ? (
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: `${cw * (a.naturalWidth ?? 1)} / ${ch * (a.naturalHeight ?? 1)}`,
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      <img
                        src={a.dataUri}
                        alt={key}
                        data-asset-key={key}
                        style={{
                          position: "absolute",
                          width: `${100 / cw}%`,
                          height: `${100 / ch}%`,
                          left: `${(-gl / cw) * 100}%`,
                          top: `${(-gt / ch) * 100}%`,
                          ...blend,
                        }}
                      />
                    </div>
                  ) : (
                    <img src={a.dataUri} alt={key} data-asset-key={key} style={blend} />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  } else if (asset && c?.enabled && nW && nH) {
    const l = c.left ?? 0, r = c.right ?? 0, t = c.top ?? 0, b = c.bottom ?? 0;
    const vw = Math.max(0.01, 1 - l - r);
    const vh = Math.max(0.01, 1 - t - b);
    imageEl = (
      <div
        className="rps-crop"
        style={{
          display: "inline-block",
          width: scalePct,
          aspectRatio: `${vw * nW} / ${vh * nH}`,
          overflow: "hidden",
          position: "relative",
          border,
          ...(allowOversize ? { maxWidth: "none" } : null),
        }}
      >
        <img
          src={asset.dataUri}
          alt={fig.caption ?? fig.id}
          style={{
            position: "absolute",
            width: `${100 / vw}%`,
            height: `${100 / vh}%`,
            left: `${(-l / vw) * 100}%`,
            top: `${(-t / vh) * 100}%`,
            ...blend,
          }}
        />
      </div>
    );
  } else if (asset) {
    imageEl = (
      <img src={asset.dataUri} alt={fig.caption ?? fig.id} style={{ width: scalePct, border, ...imgExtra }} />
    );
  } else {
    imageEl = <div className="rps-figure-missing">[missing figure: {fig.path}]</div>;
  }

  const side = capPos === "left" || capPos === "right";
  const wrapStyle: CSSProperties = side
    ? {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: "3mm",
        justifyContent:
          align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
        position: "relative",
      }
    : { textAlign: align, position: "relative" };
  // N4 float: the figure floats left/right and the body text wraps around it.
  if (fig.float) {
    wrapStyle.float = fig.float;
    wrapStyle.width = scalePct;
    wrapStyle.margin = fig.float === "left" ? "0 4mm 2mm 0" : "0 0 2mm 4mm";
    wrapStyle.textAlign = "center";
  }
  // vertical placement within a taller block: margin-auto in the block's flex
  // column pushes the figure to top / middle / bottom.
  if (fig.valign === "top") wrapStyle.marginBottom = "auto";
  else if (fig.valign === "bottom") wrapStyle.marginTop = "auto";
  else if (fig.valign === "middle") {
    wrapStyle.marginTop = "auto";
    wrapStyle.marginBottom = "auto";
  }
  if (mode === "preview" && selected) {
    wrapStyle.outline = `${2 * k}px solid #b8860b`;
    wrapStyle.outlineOffset = `${2 * k}px`;
  }

  const captionFirst = capPos === "top" || capPos === "left";

  return (
    <figure
      className="rps-figure"
      style={wrapStyle}
      data-fig-id={fig.id}
      onClick={
        interactive && mode === "preview" && onSelectFigure
          ? (e) => {
              e.stopPropagation();
              onSelectFigure(fig.id);
            }
          : undefined
      }
    >
      {captionFirst && caption}
      {imageEl}
      {!captionFirst && caption}
    </figure>
  );
}

function BlockView({ block }: { block: Block }) {
  const ctx = useCtx();
  const { project, mode, k, selSet, overflowIds, showBoundaries, showFontBadges, onSelectBlock, onEditBlock, rowGap, cite } =
    ctx;
  const theme = project.doc.theme;
  const selected = selSet.has(block.id);
  const overflowing = overflowIds?.has(block.id);
  const hasChildren = !!block.children?.length;
  const showRefList = !!block.references_list && cite.active;

  // body + figures are kept even when children exist (children render below).
  // citation mode expands [@key] before markdown rendering.
  const html =
    !showRefList &&
    (block.source !== undefined || project.content[block.id] !== undefined)
      ? renderMarkdown(
          cite.active
            ? cite.expand(project.content[block.id] ?? "")
            : project.content[block.id] ?? "",
          { diagram: ctx.diagram, colors: theme.colors },
        )
      : "";

  const style: CSSProperties = {
    ...heightStyle(block),
    ...boxStyle(block, theme),
  };
  if (mode === "preview" && block.style?.border) {
    const realMm = parseLengthMm(block.style.border_width ?? "1pt") ?? 0.35;
    const w = Math.max(mmToPx(realMm), 1.2 * k);
    const col = resolveColor(block.style.border_color, theme) ?? theme.colors.muted;
    style.border = `${w}px solid ${col}`;
  }
  if (mode === "preview") style.position = "relative";
  if (mode === "preview" && overflowing) {
    style.outline = `${3 * k}px solid #e05252`;
    style.outlineOffset = `-${k}px`;
  } else if (mode === "preview" && showBoundaries) {
    style.outline = selected
      ? `${3 * k}px solid #1f5f99`
      : `${k}px dashed rgba(120,120,120,0.55)`;
    style.outlineOffset = `-${k}px`;
  }
  if (block.overflow?.action === "clip") style.overflow = "hidden";

  const isFigureBlock = block.type === "figure" && !!block.figure_id;
  const figBlockFig = isFigureBlock
    ? project.doc.figures.find((f) => f.id === block.figure_id) ?? null
    : null;
  // figure border that also wraps the figure title -> put the border on the
  // block section (and tell FigureView not to draw its own).
  const titleInside =
    isFigureBlock && !!figBlockFig?.style?.border && !!figBlockFig.style.title_inside_border;
  if (titleInside) {
    const c = resolveColor(figBlockFig!.style!.border_color, theme) ?? "#999";
    style.border = mode === "preview" ? `${Math.max(mmToPx(0.35), 1.2 * k)}px solid ${c}` : `1pt solid ${c}`;
    style.padding = "2mm";
  }
  const isRefs =
    !!block.references_list ||
    !!block.style?.reference_format ||
    /ref|文献/i.test(block.id) ||
    /文献|reference/i.test(block.title);
  // D: format hand-written reference blocks (small font via rps-refs + hanging
  // indent via rps-ref-list), independent of the BibTeX auto-generated list.
  const bodyClass = block.style?.reference_format
    ? "rps-block-body rps-ref-list"
    : "rps-block-body";
  const figs = figuresForBlock(project, block);
  const floatFigs = figs.filter((f) => !!f.float);
  const normalFigs = figs.filter((f) => !f.float);
  const bodyPt =
    parseFontPt(block.style?.body_font_size) ?? parseFontPt(theme.font_size.body) ?? 22;
  const tooSmall = bodyPt < 18;

  const classes = ["rps-block"];
  if (isRefs) classes.push("rps-refs");
  if (block.style?.card) classes.push("rps-card");
  if (mode === "preview" && overflowing) classes.push("rps-overflow");

  // N1 number badge: split a leading number / circled-number token off the
  // title so it can render as a badge box; auto section number wins.
  const badgeCfg = block.style?.heading_badge;
  const autoNum = ctx.sectionNums.get(block.id);
  let badgeText: string | null = null;
  let titleRest = block.title;
  if (badgeCfg) {
    if (autoNum) {
      badgeText = autoNum;
    } else {
      const m = /^\s*([0-9０-９]+|[①-⑳])[.．、)）]?\s+/.exec(block.title);
      if (m) {
        badgeText = m[1];
        titleRest = block.title.slice(m[0].length);
      }
    }
  }
  const badgeStyle: CSSProperties | undefined = badgeCfg
    ? {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "1.15em",
        height: "1.15em",
        padding: "0 0.2em",
        marginRight: "0.4em",
        background: resolveColor(badgeCfg.background, theme) ?? theme.colors.background,
        color: resolveColor(badgeCfg.color, theme) ?? theme.colors.heading,
        borderRadius:
          badgeCfg.shape === "circle" ? "50%" : badgeCfg.shape === "square" ? "0" : "0.18em",
        fontWeight: 700,
        lineHeight: 1,
      }
    : undefined;

  return (
    <section
      className={classes.join(" ")}
      data-block-id={block.id}
      style={style}
      onClick={
        mode === "preview" && onSelectBlock
          ? (e) => {
              e.stopPropagation();
              onSelectBlock(block.id);
            }
          : undefined
      }
      onDoubleClick={
        mode === "preview" && onEditBlock && !isFigureBlock && block.source !== undefined
          ? (e) => {
              e.stopPropagation();
              onEditBlock(block.id);
            }
          : undefined
      }
    >
      {mode === "preview" && showFontBadges && !isFigureBlock ? (
        <span
          className="rps-fontbadge"
          style={{
            fontSize: `${11 * k}px`,
            padding: `${2 * k}px ${5 * k}px`,
            borderRadius: `${3 * k}px`,
            background: tooSmall ? "#e05252" : "rgba(31,95,153,0.85)",
          }}
        >
          本文 {Math.round(bodyPt)}pt{tooSmall ? " ⚠小" : ""}
        </span>
      ) : null}
      {mode === "preview" && overflowing ? (
        <span
          className="rps-overflow-badge"
          style={{ fontSize: `${11 * k}px`, padding: `${2 * k}px ${5 * k}px`, borderRadius: `${3 * k}px` }}
        >
          はみ出し
        </span>
      ) : null}
      {isFigureBlock ? (
        figBlockFig ? (
          <>
            {block.title ? (
              <div className="rps-figure-title" style={{ textAlign: figBlockFig.align ?? "center" }}>
                {block.title}
              </div>
            ) : null}
            <FigureView fig={figBlockFig} interactive={false} noBorder={titleInside} />
          </>
        ) : (
          <div className="rps-figure-missing">[missing figure: {block.figure_id}]</div>
        )
      ) : (
        <>
          {block.title ? (
            <h2 className="rps-block-title" style={headingStyle(block, theme)}>
              {badgeText ? (
                <span className="rps-heading-badge" style={badgeStyle}>{badgeText}</span>
              ) : autoNum ? (
                <span className="rps-section-num">{autoNum}</span>
              ) : null}
              {badgeText ? titleRest : block.title}
            </h2>
          ) : null}
          {showRefList ? (
            <div className="rps-block-body rps-ref-list" style={bodyTextStyle(block, theme)}>
              {cite.referenceItems.length > 0 ? (
                cite.referenceItems.map((s, i) => <p key={i}>{s}</p>)
              ) : (
                <p className="rps-ref-empty">（引用された文献はありません）</p>
              )}
            </div>
          ) : html ? (
            floatFigs.length > 0 ? (
              // floats need a block formatting context (the section is flex), so
              // wrap the floated figures + body together; text wraps around them.
              <div className="rps-float-wrap" style={{ display: "flow-root" }}>
                {floatFigs.map((f) => (
                  <FigureView key={f.id} fig={f} />
                ))}
                <div
                  className={bodyClass}
                  style={bodyTextStyle(block, theme)}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            ) : (
              <div
                className={bodyClass}
                style={bodyTextStyle(block, theme)}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            )
          ) : null}
          {normalFigs.map((f) => (
            <FigureView key={f.id} fig={f} />
          ))}
          {hasChildren ? (
            <div
              className="rps-block-children"
              style={{ display: "flex", flexDirection: "column", gap: rowGap, flex: "1 1 auto", minHeight: 0 }}
            >
              <BandsView
                bands={(() => {
                  const gc = project.doc.layout.columns;
                  const cl = block.child_layout;
                  const custom = cl?.mode === "custom";
                  return layoutBlocks(
                    block.children ?? [],
                    custom ? cl!.count ?? 2 : gc.count,
                    custom ? cl!.ratio ?? [] : gc.ratio,
                    custom ? cl!.width_mode ?? "ratio" : gc.width_mode,
                  );
                })()}
              />
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function BandsView({ bands, sync }: { bands: Band[]; sync?: HeightSyncMode }) {
  const { colGap, rowGap } = useCtx();
  // sync_row / *_follows pair blocks row-by-row across columns so partners
  // share a height. A CSS grid makes each grid row as tall as its tallest cell
  // and stretches the shorter partner to match — true row pairing, not the
  // independent-column flex approximation.
  //
  // *_follows is one-way: the follower column never drives the row height.
  // Follower cells are absolutely positioned overlays inside their grid cell,
  // so only the leader column sizes the row; a taller follower visibly
  // overflows its box and is caught by the overflow measurement.
  // left_follows / right_follows generalize to "first / last column follows"
  // at any column count (4+ columns use col1..colN names).
  const rowSync = sync === "sync_row" || sync === "left_follows" || sync === "right_follows";
  const followerOf = (cols: { name: string }[]) =>
    sync === "left_follows"
      ? cols[0]?.name
      : sync === "right_follows"
        ? cols[cols.length - 1]?.name
        : null;
  return (
    <>
      {bands.map((band) => {
        if (band.kind === "wide") {
          return (
            <div className="rps-band-wide" key={band.key}>
              <BlockView block={band.block} />
            </div>
          );
        }
        if (rowSync) {
          const follower = followerOf(band.columns);
          const template = band.columns.map((c) => `${c.widthFr}fr`).join(" ");
          return (
            <div
              className="rps-band-grid"
              style={{ display: "grid", gridTemplateColumns: template, rowGap, columnGap: colGap, alignItems: "stretch" }}
              key={band.key}
            >
              {(() => {
                // rows the leader column(s) define; extra follower-only rows
                // keep their natural height so they stay visible
                const leaderRows = Math.max(
                  0,
                  ...band.columns
                    .filter((c) => c.name !== follower)
                    .map((c) => c.blocks.length),
                );
                return band.columns.flatMap((col, ci) =>
                  col.blocks.map((block, ri) => {
                    const follows =
                      follower != null && col.name === follower && ri < leaderRows;
                    return (
                      <div
                        className="rps-grid-cell"
                        key={block.id}
                        style={{
                          gridColumn: ci + 1,
                          gridRow: ri + 1,
                          ...(follows ? { position: "relative" as const } : null),
                        }}
                      >
                        {follows ? (
                          <div className="rps-follow-fill">
                            <BlockView block={block} />
                          </div>
                        ) : (
                          <BlockView block={block} />
                        )}
                      </div>
                    );
                  }),
                );
              })()}
            </div>
          );
        }
        return (
          <div className="rps-band-columns" style={{ gap: colGap }} key={band.key}>
            {band.columns.map((col) => (
              <div
                className="rps-column"
                key={col.name}
                style={{ flex: `${col.widthFr} 1 0`, gap: rowGap }}
              >
                {col.blocks.map((block) => (
                  <BlockView key={block.id} block={block} />
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

export default function PosterCanvas({
  project,
  mode = "preview",
  selectedBlockId,
  onSelectBlock,
  onEditBlock,
  showBoundaries = true,
  overflowIds,
  zoom = 1,
  selectedFigureId,
  onSelectFigure,
  showFontBadges = true,
  selectedIds,
  diagram,
}: PosterCanvasProps) {
  const { doc } = project;
  const selSet = new Set(selectedIds ?? (selectedBlockId ? [selectedBlockId] : []));
  const size = posterSizeMm(doc.project);
  const colGap = `${doc.layout.column_gap_mm ?? doc.layout.gap_mm ?? 8}mm`;
  const rowGap = `${doc.layout.row_gap_mm ?? doc.layout.gap_mm ?? 8}mm`;
  const margin = doc.layout.margin_mm ?? 20;
  const isPreview = mode === "preview";
  const k = isPreview ? 1 / (zoom || 1) : 1;
  // citation mode context (no-op pass-through when no .bib is loaded)
  const cite = useMemo(() => prepareCitations(project), [project]);
  // opt-in auto-numbering (empty maps when off)
  const sectionNums = useMemo(
    () => (doc.layout.number_sections ? sectionNumbers(doc) : new Map<string, string>()),
    [doc],
  );
  const captionNums = useMemo(
    () => (doc.layout.number_figures ? numberedCaptions(doc) : new Map<string, string>()),
    [doc],
  );

  const ctx: RenderCtx = {
    project,
    mode,
    k,
    selSet,
    selectedFigureId,
    overflowIds,
    showBoundaries,
    showFontBadges,
    onSelectBlock,
    onEditBlock,
    onSelectFigure,
    colGap,
    rowGap,
    cite,
    diagram,
    sectionNums,
    captionNums,
  };

  const rootStyle: CSSProperties = { width: `${size.w}mm`, height: `${size.h}mm` };

  const theme = doc.theme;
  const hc = doc.header ?? {};
  const headerSelected = selectedBlockId === HEADER_ID;
  const headerStyle: CSSProperties = {
    textAlign: hc.align ?? "center",
    background: hc.background ? resolveColor(hc.background, theme) : undefined,
    padding: hc.padding_mm != null ? `${hc.padding_mm}mm` : undefined,
    // inset the header by the page margin so the title/border align with blocks
    margin: `${margin}mm ${margin}mm 0`,
    border: hc.border
      ? `${hc.border_width ?? "1pt"} solid ${resolveColor(hc.border_color, theme) ?? theme.colors.muted}`
      : undefined,
    position: "relative",
    cursor: isPreview ? "pointer" : undefined,
  };
  if (isPreview && headerSelected) {
    headerStyle.outline = `${3 * k}px solid #1f5f99`;
    headerStyle.outlineOffset = `-${k}px`;
  }
  const titleColor = resolveColor(hc.title_color, theme) ?? theme.colors.heading;
  const accentColor = resolveColor(hc.accent_color, theme) ?? theme.colors.accent;
  // authors / affiliation / conference color (e.g. white on a colored header)
  const headerTextColor = hc.text_color ? resolveColor(hc.text_color, theme) : undefined;

  const meta = doc.project;
  const affils = meta.affiliations ?? [];
  const breakAfter = new Set(meta.affiliation_line_breaks ?? []);
  const usedSet = new Set<number>();
  meta.authors.forEach((a) => (a.affiliations ?? []).forEach((i) => usedSet.add(i)));
  const used = Array.from(usedSet).sort((x, y) => x - y);
  const multiPerAuthor = meta.authors.some((a) => (a.affiliations ?? []).length > 1);
  const showAffil = hc.show_affiliation !== false;
  // no superscript marks when affiliations are hidden
  const needMarks = showAffil && (used.length > 1 || multiPerAuthor);
  const authorSep = hc.author_separator ?? "，";
  const markerKind = hc.affiliation_marker ?? "number";
  const SYMS = ["†", "‡", "§", "¶", "#", "*", "**", "††", "‡‡"];
  const markFor = (pos: number) =>
    markerKind === "symbol" ? SYMS[pos] ?? `${pos + 1}` : `${pos + 1}`;
  const joinMarks = markerKind === "symbol" ? "" : ",";
  const elAlign = (a?: HAlign): HAlign => a ?? hc.align ?? "center";
  const confText = [meta.conference?.name, meta.conference?.date].filter(Boolean).join("　");

  // Institution logos (multiple; header and/or footer; left/center/right slots).
  const logos = (hc.logos ?? []).map((l, i) => ({ ...l, _idx: i }));
  const headerLogos = logos.filter((l) => l.area !== "footer");
  const footerLogos = logos.filter((l) => l.area === "footer");
  // N24: lay header logos in flow (left | center content | right) so a logo
  // never overlaps a centered title regardless of the logo's width.
  const hLeft = headerLogos.filter((l) => (l.position ?? "left") === "left");
  const hCenter = headerLogos.filter((l) => (l.position ?? "left") === "center");
  const hRight = headerLogos.filter((l) => (l.position ?? "left") === "right");
  // B1: header text badges / pills (left | center | right slots).
  const badges = hc.badges ?? [];
  const bLeft = badges.filter((b) => (b.position ?? "right") === "left");
  const bCenter = badges.filter((b) => (b.position ?? "right") === "center");
  const bRight = badges.filter((b) => (b.position ?? "right") === "right");
  const hasSideLogos =
    hLeft.length > 0 || hRight.length > 0 || bLeft.length > 0 || bRight.length > 0;
  const badgeEl = (b: (typeof badges)[number], i: number) => (
    <span
      key={`b${i}`}
      className="rps-header-badge"
      style={{
        background: b.background ? resolveColor(b.background, theme) : undefined,
        color: b.color ? resolveColor(b.color, theme) : undefined,
        fontSize: b.font_size,
      }}
    >
      {b.text}
    </span>
  );
  // N17: full-width footer band with text zones (date / venue / etc.).
  const footerText: Record<"left" | "center" | "right", string | undefined> = {
    left: hc.footer_left,
    center: hc.footer_center,
    right: hc.footer_right,
  };
  const hasFooterText = !!(hc.footer_left || hc.footer_center || hc.footer_right);
  const hasFooter = footerLogos.length > 0 || hasFooterText;
  const footerBg = hc.footer_background ? resolveColor(hc.footer_background, theme) : undefined;
  const footerColor = hc.footer_text_color ? resolveColor(hc.footer_text_color, theme) : undefined;
  // A1: full-height per-column background bands (behind the stacked blocks).
  const colBgRects: { left: number; width: number; color: string }[] = (() => {
    const lc = doc.layout.columns;
    const bg = lc.backgrounds;
    if (!bg || !bg.some(Boolean)) return [];
    const n = lc.count ?? lc.ratio?.length ?? 2;
    const ratios = lc.ratio && lc.ratio.length === n ? lc.ratio : Array(n).fill(1);
    const rsum = ratios.reduce((a, b) => a + b, 0) || 1;
    const gMm = doc.layout.column_gap_mm ?? doc.layout.gap_mm ?? 8;
    const usable = size.w - 2 * margin - (n - 1) * gMm;
    const out: { left: number; width: number; color: string }[] = [];
    let x = margin;
    for (let i = 0; i < n; i++) {
      const w = (usable * ratios[i]) / rsum;
      const c = bg[i];
      if (c) out.push({ left: x, width: w, color: resolveColor(c, theme) ?? c });
      x += w + gMm;
    }
    return out;
  })();
  const logoImg = (l: LogoConfig & { _idx: number }) => {
    const base = l.path.replace(/\\/g, "/").split("/").pop() ?? l.path;
    const asset = project.figures[base] ?? project.figures[l.path];
    const h = `${l.height_mm ?? 20}mm`;
    if (!asset) {
      // missing file: show a placeholder in the preview, omit from exports
      return isPreview ? (
        <span key={l._idx} className="rps-logo-missing" style={{ height: h }}>
          {base}
        </span>
      ) : null;
    }
    return (
      <img
        key={l._idx}
        className="rps-logo-img"
        data-logo-idx={l._idx}
        src={asset.dataUri}
        alt={base}
        style={{ height: h }}
      />
    );
  };
  // Poster-wide background image (drawn over colors.background, under content).
  const bg = theme.background;
  let bgEl: ReactNode = null;
  if (bg?.image) {
    const base = bg.image.replace(/\\/g, "/").split("/").pop() ?? bg.image;
    const asset = project.figures[base] ?? project.figures[bg.image];
    if (asset) {
      bgEl = (
        <div
          className="rps-bg"
          aria-hidden
          style={{
            backgroundImage: `url(${asset.dataUri})`,
            backgroundSize: bg.fit === "tile" ? "auto" : (bg.fit ?? "cover"),
            backgroundRepeat: bg.fit === "tile" ? "repeat" : "no-repeat",
            backgroundPosition: "center",
            opacity: bg.opacity ?? 1,
          }}
        />
      );
    }
  }

  return (
    <Ctx.Provider value={ctx}>
      <div
        className={`rps-poster${isPreview ? " rps-preview" : ""}`}
        style={rootStyle}
        data-poster-root
      >
        {isPreview ? <style dangerouslySetInnerHTML={{ __html: posterCss(doc) }} /> : null}
        {bgEl}

        <header
          className="rps-header"
          data-block-id={HEADER_ID}
          style={headerStyle}
          onClick={
            isPreview && onSelectBlock
              ? (e) => {
                  e.stopPropagation();
                  onSelectBlock(HEADER_ID);
                }
              : undefined
          }
        >
          <div className="rps-header-inner">
          {hasSideLogos ? (
            <div className="rps-header-side rps-header-side-left">
              {hLeft.map(logoImg)}
              {bLeft.map(badgeEl)}
            </div>
          ) : null}
          <div className="rps-header-center">
          {hCenter.length > 0 || bCenter.length > 0 ? (
            <div className="rps-header-logo-row">
              {hCenter.map(logoImg)}
              {bCenter.map(badgeEl)}
            </div>
          ) : null}
          {confText ? (
            <div
              className="rps-conf"
              style={{
                textAlign: elAlign(hc.conference_align),
                fontSize: hc.conference_font_size ?? theme.font_size.caption,
                color: headerTextColor ?? theme.colors.muted,
                marginBottom: "2mm",
              }}
            >
              {confText}
            </div>
          ) : null}
          <h1
            className="rps-title"
            style={{
              color: titleColor,
              fontSize: hc.title_font_size ?? theme.font_size.title,
              textAlign: elAlign(hc.title_align),
            }}
          >
            {meta.title}
          </h1>
          {meta.subtitle ? (
            <div
              className="rps-subtitle"
              style={{
                color: accentColor,
                fontSize: hc.subtitle_font_size ?? theme.font_size.subtitle,
                textAlign: elAlign(hc.subtitle_align),
              }}
            >
              {meta.subtitle}
            </div>
          ) : null}
          {meta.authors.length > 0 ? (
            <div
              className="rps-authors"
              style={{
                fontSize: hc.authors_font_size ?? theme.font_size.heading2,
                textAlign: elAlign(hc.authors_align),
                color: headerTextColor,
              }}
            >
              {meta.authors.map((a, ai) => {
                // N8: inline affiliation "Name (Affiliation)" on the authors line
                const inlineAffil = hc.affiliation_inline
                  ? (a.affiliations ?? []).map((i) => affils[i]).filter(Boolean).join(", ")
                  : "";
                const marks = needMarks && !hc.affiliation_inline
                  ? (a.affiliations ?? []).map((i) => markFor(used.indexOf(i))).join(joinMarks)
                  : "";
                return (
                  <span key={ai}>
                    {a.name}
                    {marks ? <sup>{marks}</sup> : null}
                    {inlineAffil ? `（${inlineAffil}）` : ""}
                    {ai < meta.authors.length - 1 ? authorSep : ""}
                  </span>
                );
              })}
            </div>
          ) : null}
          {hc.show_affiliation !== false && !hc.affiliation_inline && used.length > 0 ? (
            <div
              className="rps-affil"
              style={{
                fontSize: hc.affil_font_size ?? theme.font_size.caption,
                textAlign: elAlign(hc.affil_align),
                color: headerTextColor ?? theme.colors.muted,
              }}
            >
              {needMarks ? (
                used.map((i, pos) => (
                  <span key={i} style={{ whiteSpace: "nowrap", marginRight: "1.2em" }}>
                    <sup>{markFor(pos)}</sup> {affils[i]}
                    {breakAfter.has(i) && pos < used.length - 1 ? <br /> : null}
                  </span>
                ))
              ) : (
                <span>{affils[used[0]]}</span>
              )}
            </div>
          ) : null}
          {hc.show_keywords !== false && (meta.keywords ?? []).length > 0 ? (
            <div
              className="rps-keywords"
              style={{
                fontSize: hc.keywords_font_size ?? theme.font_size.caption,
                textAlign: elAlign(hc.keywords_align),
                color: theme.colors.muted,
                marginTop: "2mm",
              }}
            >
              {hc.keywords_label ?? "Keywords: "}
              {(meta.keywords ?? []).join("，")}
            </div>
          ) : null}
          </div>
          {hasSideLogos ? (
            <div className="rps-header-side rps-header-side-right">
              {hRight.map(logoImg)}
              {bRight.map(badgeEl)}
            </div>
          ) : null}
          </div>
        </header>

        <div
          className="rps-body"
          style={{
            gap: rowGap,
            // with a footer band the page margin moves to the footer itself
            padding: `${rowGap} ${margin}mm ${hasFooter ? rowGap : `${margin}mm`}`,
          }}
        >
          {colBgRects.length ? (
            <div className="rps-col-bg" aria-hidden="true">
              {colBgRects.map((r, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: `${r.left}mm`,
                    width: `${r.width}mm`,
                    background: r.color,
                  }}
                />
              ))}
            </div>
          ) : null}
          <BandsView bands={computeBands(doc)} sync={doc.layout.columns.sync_mode} />
        </div>

        {hasFooter ? (
          <div
            className="rps-poster-footer"
            style={
              footerBg
                ? { margin: 0, padding: `3mm ${margin}mm`, background: footerBg, color: footerColor }
                : { margin: `0 ${margin}mm ${margin}mm`, color: footerColor }
            }
          >
            {(["left", "center", "right"] as const).map((pos) => (
              <div
                className={`rps-footer-zone rps-pos-${pos}`}
                key={pos}
                style={{ fontSize: hc.footer_font_size ?? theme.font_size.caption }}
              >
                {footerLogos.filter((l) => (l.position ?? "left") === pos).map(logoImg)}
                {footerText[pos] ? <span className="rps-footer-text">{footerText[pos]}</span> : null}
              </div>
            ))}
          </div>
        ) : null}

        {isPreview ? (
          <>
            <div className="rps-page-frame" style={{ border: `${2 * k}px solid #3b82f6` }} aria-hidden />
            <div
              className="rps-margin-guide"
              style={{
                top: margin + "mm",
                right: margin + "mm",
                bottom: margin + "mm",
                left: margin + "mm",
                border: `${k}px dashed rgba(59,130,246,0.55)`,
              }}
              aria-hidden
            />
            <div
              className="rps-scalebar"
              style={{ bottom: `${6 * k}px`, left: `${6 * k}px`, gap: `${3 * k}px`, padding: `${4 * k}px ${6 * k}px` }}
              aria-hidden
            >
              <div className="rps-scalebar-bar" style={{ width: "100mm", height: `${4 * k}px` }} />
              <span className="rps-scalebar-label" style={{ fontSize: `${11 * k}px` }}>
                10&nbsp;cm（実寸）
              </span>
            </div>
          </>
        ) : null}
      </div>
    </Ctx.Provider>
  );
}
