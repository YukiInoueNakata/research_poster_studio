// Scaled A0/A1 preview. Renders the live PosterCanvas inside a CSS-scaled
// wrapper and measures the result for overflow / column-balance / figure-DPI
// warnings (設計書 §9.2, §11).

import { useEffect, useRef, useState } from "react";
import type { DiagramResolver, PosterProject, Warning } from "@rps/core";
import { formatMm, mmToPx, posterSizeLabel, posterSizeMm, pxToMm, MM_PER_INCH } from "@rps/core";
import { PosterCanvas } from "@rps/renderer";
import { useLang } from "../i18n";

interface Props {
  project: PosterProject;
  zoom: number;
  selectedBlockId: string | null;
  selectedIds: string[];
  onSelectBlock: (id: string) => void;
  onEditBlock: (id: string) => void;
  editingBlockId: string | null;
  editContent: string;
  onEditContent: (md: string) => void;
  onEndEdit: () => void;
  showBoundaries: boolean;
  onMeasured: (warnings: Warning[]) => void;
  rootRef: React.MutableRefObject<HTMLElement | null>;
  overflowIds: Set<string>;
  selectedFigureId: string | null;
  onSelectFigure: (id: string) => void;
  onFigureNatSizes: (sizes: Record<string, { w: number; h: number }>) => void;
  onZoom: (z: number) => void;
  showFontBadges: boolean;
  onBlockSizes: (sizes: Record<string, { w: number; h: number }>) => void;
  diagram?: DiagramResolver;
}

const clampZoom = (z: number) => Math.min(2, Math.max(0.05, z));

export default function PreviewPane({
  project,
  zoom,
  selectedBlockId,
  selectedIds,
  onSelectBlock,
  onEditBlock,
  editingBlockId,
  editContent,
  onEditContent,
  onEndEdit,
  showBoundaries,
  onMeasured,
  rootRef,
  overflowIds,
  selectedFigureId,
  onSelectFigure,
  onFigureNatSizes,
  onZoom,
  showFontBadges,
  onBlockSizes,
  diagram,
}: Props) {
  const { t } = useLang();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  // N11 fit-to-budget: ratio of content height to the page height (>1 overflows)
  const [fill, setFill] = useState<number | null>(null);
  // inline on-canvas editor overlay rect (relative to preview-wrap content)
  const [editRect, setEditRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const { doc } = project;
  const size = posterSizeMm(doc.project);
  const wpx = mmToPx(size.w);
  const hpx = mmToPx(size.h);

  // keep latest zoom for the (once-attached) wheel handler
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // Wheel: plain = zoom, Ctrl = vertical scroll, Shift = horizontal scroll.
  // Attached natively (non-passive) so preventDefault works.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        el.scrollTop += e.deltaY;
        e.preventDefault();
      } else if (e.shiftKey) {
        el.scrollLeft += e.deltaY || e.deltaX;
        e.preventDefault();
      } else {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        onZoom(clampZoom(zoomRef.current * factor));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onZoom]);

  useEffect(() => {
    const id = requestAnimationFrame(() => measure());
    return () => cancelAnimationFrame(id);
    // re-measure whenever the document / zoom / rendered diagrams change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, zoom, diagram]);

  // position the inline editor overlay over the block being edited
  useEffect(() => {
    if (!editingBlockId) {
      setEditRect(null);
      return;
    }
    const wrap = wrapRef.current;
    const el = wrap?.querySelector(`[data-block-id="${editingBlockId}"]`) as HTMLElement | null;
    if (!wrap || !el) {
      setEditRect(null);
      return;
    }
    const wr = wrap.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setEditRect({
      top: r.top - wr.top + wrap.scrollTop,
      left: r.left - wr.left + wrap.scrollLeft,
      width: r.width,
      height: r.height,
    });
  }, [editingBlockId, zoom, project]);

  function measure() {
    const root = wrapRef.current?.querySelector(
      "[data-poster-root]",
    ) as HTMLElement | null;
    rootRef.current = root;
    if (!root) return;
    const warnings: Warning[] = [];

    // N11: page fill ratio (content height / page height)
    setFill(root.clientHeight > 0 ? root.scrollHeight / root.clientHeight : null);

    // whole-poster overflow (content taller than the A0/A1 page)
    if (root.scrollHeight > root.clientHeight + 2) {
      warnings.push({
        level: "error",
        code: "poster-overflow",
        message: t("preview.overflow_poster", { size: posterSizeLabel(doc.project) }),
      });
    }

    // measured block dimensions (real mm) for the inspector readout
    const sizes: Record<string, { w: number; h: number }> = {};

    // per-block overflow (skip the header pseudo-block)
    root.querySelectorAll<HTMLElement>("[data-block-id]").forEach((el) => {
      const id = el.getAttribute("data-block-id")!;
      const r = el.getBoundingClientRect();
      sizes[id] = {
        w: Math.round(pxToMm(r.width / zoom)),
        h: Math.round(pxToMm(r.height / zoom)),
      };
      if (id === "__header__") return;
      if (el.scrollHeight > el.clientHeight + 2) {
        const block = doc.blocks.find((b) => b.id === id);
        warnings.push({
          level: "error",
          code: "overflow",
          blockId: id,
          message: t("preview.overflow_block", { title: block?.title || id }),
        });
      }
    });

    // capture intrinsic figure sizes (needed for crop geometry + export)
    const natSizes: Record<string, { w: number; h: number }> = {};
    root.querySelectorAll<HTMLElement>("[data-fig-id]").forEach((figEl) => {
      const id = figEl.getAttribute("data-fig-id")!;
      const img = figEl.querySelector("img");
      if (img && img.naturalWidth && img.naturalHeight) {
        const asset = project.figures[id];
        if (asset && (asset.naturalWidth == null || asset.naturalHeight == null)) {
          natSizes[id] = { w: img.naturalWidth, h: img.naturalHeight };
        }
      }
    });
    // gallery images are keyed by filename (data-asset-key); capture their
    // intrinsic sizes too so the equal-height alignment can kick in
    root.querySelectorAll<HTMLImageElement>("img[data-asset-key]").forEach((img) => {
      const key = img.getAttribute("data-asset-key")!;
      const asset = project.figures[key];
      if (
        asset &&
        img.naturalWidth &&
        img.naturalHeight &&
        (asset.naturalWidth == null || asset.naturalHeight == null)
      ) {
        natSizes[key] = { w: img.naturalWidth, h: img.naturalHeight };
      }
    });
    if (Object.keys(natSizes).length > 0) onFigureNatSizes(natSizes);
    onBlockSizes(sizes);

    // column balance per band
    root.querySelectorAll<HTMLElement>(".rps-band-columns").forEach((band) => {
      const cols = Array.from(
        band.querySelectorAll<HTMLElement>(".rps-column"),
      ).map((c) => c.getBoundingClientRect().height);
      if (cols.length >= 2) {
        const max = Math.max(...cols);
        const min = Math.min(...cols);
        if (max > 0 && (max - min) / max > 0.25) {
          warnings.push({
            level: "info",
            code: "column-imbalance",
            message: t("preview.column_imbalance"),
          });
        }
      }
    });

    // figure DPI (displayed real size vs intrinsic pixels)
    root.querySelectorAll<HTMLImageElement>("[data-fig-id] img").forEach((img) => {
      const figEl = img.closest("[data-fig-id]");
      const id = figEl?.getAttribute("data-fig-id") ?? "";
      // skip vector (SVG) figures — DPI is meaningless for them
      if (!img.naturalWidth || img.src.startsWith("data:image/svg")) return;
      const dispRealPx = img.getBoundingClientRect().width / zoom;
      const dispMm = pxToMm(dispRealPx);
      const dispInch = dispMm / MM_PER_INCH;
      if (dispInch <= 0) return;
      const dpi = img.naturalWidth / dispInch;
      if (dpi < 150) {
        warnings.push({
          level: "warn",
          code: "figure-dpi",
          figureId: id,
          message: t("preview.figure_dpi", { id, dpi: Math.round(dpi) }),
        });
      }
    });

    onMeasured(warnings);
  }

  return (
    <div className="preview-wrap" ref={wrapRef} style={{ position: "relative" }}>
      <div className="preview-dim">
        {posterSizeLabel(doc.project)}
        {doc.project.poster_size !== "custom" &&
          `・${doc.project.orientation === "portrait" ? t("preview.portrait") : t("preview.landscape")}`}
        ・{formatMm(size.w, doc.project.units ?? "mm")} ×{" "}
        {formatMm(size.h, doc.project.units ?? "mm")} {doc.project.units ?? "mm"} ・{" "}
        {Math.round(zoom * 100)}%
        {fill != null && (
          <span
            className="preview-fill"
            title={t("preview.fillTitle")}
            style={{
              marginLeft: "0.6em",
              padding: "0 0.5em",
              borderRadius: 4,
              fontWeight: 600,
              background: fill > 1.001 ? "#e05252" : fill > 0.92 ? "#caa53a" : "#3a8a4a",
              color: "#fff",
            }}
          >
            {t("preview.fill")} {Math.round(fill * 100)}%
          </span>
        )}
        <span className="preview-legend">
          <span className="lg-solid" /> {t("preview.legend_edge")}
          <span className="lg-dash" /> {t("preview.legend_margin")}
        </span>
      </div>
      <div
        className="preview-scaler"
        style={{
          width: wpx * zoom,
          height: hpx * zoom,
          transform: `scale(${zoom})`,
        }}
        onClick={() => onSelectBlock("")}
      >
        <PosterCanvas
          project={project}
          mode="preview"
          selectedBlockId={selectedBlockId}
          selectedIds={selectedIds}
          onSelectBlock={onSelectBlock}
          onEditBlock={onEditBlock}
          showBoundaries={showBoundaries}
          overflowIds={overflowIds}
          zoom={zoom}
          selectedFigureId={selectedFigureId}
          onSelectFigure={onSelectFigure}
          showFontBadges={showFontBadges}
          diagram={diagram}
        />
      </div>
      {editingBlockId && editRect ? (
        <div
          className="inline-edit-overlay"
          style={{
            position: "absolute",
            top: editRect.top,
            left: editRect.left,
            width: Math.max(editRect.width, 160),
            minHeight: Math.max(editRect.height, 80),
            zIndex: 30,
            boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
            border: "2px solid var(--accent, #1f6f99)",
            borderRadius: 4,
            background: "#fff",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ fontSize: 11, padding: "2px 6px", background: "var(--accent,#1f6f99)", color: "#fff", display: "flex", justifyContent: "space-between" }}>
            <span>{t("preview.inlineEdit")}</span>
            <span style={{ opacity: 0.85 }}>{t("preview.inlineEditHint")}</span>
          </div>
          <textarea
            autoFocus
            value={editContent}
            onChange={(e) => onEditContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); onEndEdit(); }
            }}
            onBlur={onEndEdit}
            spellCheck={false}
            style={{ flex: 1, minHeight: 80, resize: "vertical", border: "none", outline: "none", padding: 6, fontFamily: "monospace", fontSize: 12 }}
          />
        </div>
      ) : null}
    </div>
  );
}
