// Right-pane inspector for a selected figure: size, alignment, placement,
// caption, border, and cropping (設計書 §10.2).

import { useState } from "react";
import type {
  Block,
  ColumnName,
  Crop,
  Figure,
  FigurePlacement,
  PosterProject,
} from "@rps/core";
import ColorField from "./ColorField";
import { NumberField, LengthField } from "./StepField";
import { columnLabel, columnOptions } from "../lib/columns";
import { autoTrimCrop } from "../lib/figureConvert";
import { useLang } from "../i18n";

interface Props {
  project: PosterProject;
  figure: Figure;
  onChangeFigure: (next: Figure) => void;
  /** when the figure is a figure-block, its block + layout callbacks */
  figureBlock?: Block;
  onPatchBlock?: (patch: Partial<Block>) => void;
  onMoveBlock?: (dir: -1 | 1) => void;
  onRemoveBlock?: (id: string) => void;
  /** open a file dialog, copy the image into figures/, return the basename */
  onAddImageFile?: () => Promise<string | null>;
  /** bake the white background to true alpha (writes a new transparent PNG) */
  onKnockoutWhite?: (figure: Figure) => void | Promise<void>;
  /** convert an EMF/WMF figure to PNG (Windows only) */
  onConvertEmf?: (figure: Figure) => void | Promise<void>;
}

const pct = (frac: number | undefined) => Math.round((frac ?? 0) * 100);

export default function FigureInspector({
  project,
  figure,
  onChangeFigure,
  figureBlock,
  onPatchBlock,
  onMoveBlock,
  onRemoveBlock,
  onAddImageFile,
  onKnockoutWhite,
  onConvertEmf,
}: Props) {
  const isEmf = /\.(emf|wmf)$/i.test(figure.path);
  const { t } = useLang();
  // N13 gallery crop: which image paths are selected, and the pending crop %
  const [cropSel, setCropSel] = useState<Set<string>>(new Set());
  const [pendCrop, setPendCrop] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
  const set = (patch: Partial<Figure>) => onChangeFigure({ ...figure, ...patch });
  const setStyle = (patch: Partial<NonNullable<Figure["style"]>>) =>
    onChangeFigure({ ...figure, style: { ...(figure.style ?? {}), ...patch } });
  const setCrop = (patch: Partial<NonNullable<Figure["crop"]>>) =>
    onChangeFigure({
      ...figure,
      crop: { enabled: figure.crop?.enabled ?? false, ...figure.crop, ...patch },
    });

  const asset = project.figures[figure.id];
  const placements: FigurePlacement[] = ["inside-block", "column", "full-width"];

  // 所属ブロック: after the owned-figure migration, figure.block points at a
  // figure *child* block (e.g. "X__fig_img1") — show the owning top-level
  // block instead. Standalone (__fig_*) and unowned figures show（なし）.
  const contains = (b: Block, id: string): boolean =>
    b.id === id || (b.children ?? []).some((c) => contains(c, id));
  const ownerCandidates = project.doc.blocks.filter(
    (b) => b.type !== "figure" && !b.id.startsWith("__fig_"),
  );
  const ownerId = figure.block
    ? (ownerCandidates.find((b) => contains(b, figure.block!))?.id ?? "")
    : "";
  const aligns: NonNullable<Figure["align"]>[] = ["left", "center", "right"];
  const crop = figure.crop ?? { enabled: false };

  // gallery (additional images sharing this figure's caption)
  const galleryPaths = figure.images ?? [];
  const moveGalleryImage = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= galleryPaths.length) return;
    const next = [...galleryPaths];
    [next[i], next[j]] = [next[j], next[i]];
    set({ images: next });
  };

  // crop side editor (percent of the original image)
  const CropSide = ({ side, label }: { side: "top" | "right" | "bottom" | "left"; label: string }) => (
    <NumberField
      label={label}
      value={pct((crop as any)[side])}
      min={0}
      max={90}
      step={5}
      onChange={(v) => setCrop({ [side]: Math.min(90, Math.max(0, v)) / 100 } as any)}
    />
  );

  const cols: ColumnName[] = columnOptions(project.doc.layout.columns.count);

  return (
    <div className="inspector">
      <div className="pane-header" style={{ margin: "-10px -12px 10px" }}>
        {t("figure.header", { id: figure.id })}
      </div>

      {figureBlock && onPatchBlock ? (
        <div className="field-group">
          <div className="legend">{t("figure.placementBlockLegend")}</div>
          <div className="inline">
            <div className="field">
              <label>{t("figure.column")}</label>
              <select
                value={figureBlock.column}
                onChange={(e) => onPatchBlock({ column: e.target.value as ColumnName })}
              >
                {cols.includes(figureBlock.column) ? null : (
                  <option value={figureBlock.column}>{columnLabel(figureBlock.column)}</option>
                )}
                {cols.map((c) => (
                  <option key={c} value={c}>{columnLabel(c)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t("figure.order")}</label>
              <div className="row">
                <button onClick={() => onMoveBlock?.(-1)} title={t("figure.moveUp")}>▲</button>
                <button onClick={() => onMoveBlock?.(1)} title={t("figure.moveDown")}>▼</button>
              </div>
            </div>
          </div>
          <label className="check" style={{ marginBottom: 4 }}>
            <input
              type="checkbox"
              checked={!!figureBlock.title}
              onChange={(e) => onPatchBlock({ title: e.target.checked ? figureBlock.title || t("figure.defaultTitle") : "" })}
            />
            {t("figure.giveTitle")}
          </label>
          {figureBlock.title ? (
            <div className="field">
              <label>{t("figure.title")}</label>
              <input
                type="text"
                value={figureBlock.title}
                onChange={(e) => onPatchBlock({ title: e.target.value })}
              />
            </div>
          ) : null}
          <button
            onClick={() => onRemoveBlock?.(figureBlock.id)}
            style={{ color: "var(--err)" }}
          >
            {t("figure.deleteBlock")}
          </button>
        </div>
      ) : null}

      {asset ? (
        <div className="field" style={{ textAlign: "center" }}>
          <img
            src={asset.dataUri}
            alt={figure.id}
            style={{ maxWidth: "100%", maxHeight: 120, border: "1px solid var(--border)" }}
          />
          {asset.naturalWidth ? (
            <div className="hint">
              {t("figure.naturalSize", { w: asset.naturalWidth, h: asset.naturalHeight ?? 0 })}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="empty">{t("figure.notFound", { path: figure.path })}</div>
      )}

      {isEmf && onConvertEmf ? (
        <div className="field-group">
          <div className="hint" style={{ marginBottom: 4 }}>{t("figure.emfHint")}</div>
          <button onClick={() => onConvertEmf(figure)}>{t("figure.convertEmf")}</button>
        </div>
      ) : null}

      <div className="field">
        <label>{t("figure.caption")}</label>
        <input
          type="text"
          value={figure.caption ?? ""}
          onChange={(e) => set({ caption: e.target.value })}
        />
      </div>

      {/* gallery: additional images sharing this figure's caption */}
      <div className="field-group">
        <div className="legend">{t("figure.galleryLegend")}</div>
        {galleryPaths.length > 0 ? (
          <>
            <div className="hint" style={{ marginBottom: 4 }}>
              {t("figure.galleryHint", { count: galleryPaths.length })}
            </div>
            {galleryPaths.map((p, i) => {
              const base = p.replace(/\\/g, "/").split("/").pop() ?? p;
              return (
                <div className="row" key={`${p}-${i}`} style={{ marginBottom: 4 }}>
                  <span
                    style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={p}
                  >
                    {base}
                  </span>
                  <button
                    onClick={() => moveGalleryImage(i, -1)}
                    disabled={i === 0}
                    title={t("figure.galleryPrev")}
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveGalleryImage(i, 1)}
                    disabled={i === galleryPaths.length - 1}
                    title={t("figure.galleryNext")}
                  >
                    ▼
                  </button>
                  <button
                    onClick={() => {
                      const next = galleryPaths.filter((_, j) => j !== i);
                      set({
                        images: next.length > 0 ? next : undefined,
                        gallery_columns: next.length > 0 ? figure.gallery_columns : undefined,
                      });
                    }}
                    style={{ color: "var(--err)" }}
                    title={t("figure.galleryRemove")}
                  >
                    {t("figure.delete")}
                  </button>
                </div>
              );
            })}
            <NumberField
              label={t("figure.galleryColumns")}
              value={figure.gallery_columns ?? 0}
              min={0}
              max={galleryPaths.length + 1}
              step={1}
              onChange={(v) =>
                set({ gallery_columns: v > 0 ? Math.floor(v) : undefined })
              }
            />
          </>
        ) : (
          <div className="hint" style={{ marginBottom: 4 }}>
            {t("figure.galleryEmptyHint")}
          </div>
        )}
        {onAddImageFile ? (
          <button
            onClick={async () => {
              const name = await onAddImageFile();
              if (name) set({ images: [...galleryPaths, name] });
            }}
          >
            {t("figure.addImage")}
          </button>
        ) : null}
        {galleryPaths.length > 0 ? (
          <div className="field-group" style={{ marginTop: 6 }}>
            <div className="legend">{t("figure.galleryCropLegend")}</div>
            <div className="hint" style={{ marginBottom: 4 }}>{t("figure.galleryCropHint")}</div>
            {[figure.path, ...galleryPaths].map((p, i) => {
              const b = p.replace(/\\/g, "/").split("/").pop() ?? p;
              const cropped = !!figure.image_crops?.[p]?.enabled;
              return (
                <label className="check" key={`${p}-${i}`} style={{ marginBottom: 2 }}>
                  <input
                    type="checkbox"
                    checked={cropSel.has(p)}
                    onChange={(e) => {
                      const next = new Set(cropSel);
                      if (e.target.checked) next.add(p); else next.delete(p);
                      setCropSel(next);
                    }}
                  />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p}>
                    {i === 0 ? `${b} (main)` : b}{cropped ? " ✂" : ""}
                  </span>
                </label>
              );
            })}
            <div className="row" style={{ gap: 4, marginTop: 4 }}>
              <button onClick={() => setCropSel(new Set([figure.path, ...galleryPaths]))}>{t("figure.cropSelectAll")}</button>
              <button onClick={() => setCropSel(new Set())}>{t("figure.cropSelectNone")}</button>
            </div>
            <div className="inline" style={{ marginTop: 4 }}>
              <NumberField label={t("figure.cropTop")} value={pendCrop.top} min={0} max={90} step={5}
                onChange={(v) => setPendCrop({ ...pendCrop, top: v })} />
              <NumberField label={t("figure.cropBottom")} value={pendCrop.bottom} min={0} max={90} step={5}
                onChange={(v) => setPendCrop({ ...pendCrop, bottom: v })} />
            </div>
            <div className="inline">
              <NumberField label={t("figure.cropLeft")} value={pendCrop.left} min={0} max={90} step={5}
                onChange={(v) => setPendCrop({ ...pendCrop, left: v })} />
              <NumberField label={t("figure.cropRight")} value={pendCrop.right} min={0} max={90} step={5}
                onChange={(v) => setPendCrop({ ...pendCrop, right: v })} />
            </div>
            <button
              disabled={cropSel.size === 0}
              onClick={() => {
                const next = { ...(figure.image_crops ?? {}) };
                const c: Crop = {
                  enabled: true,
                  top: pendCrop.top / 100, right: pendCrop.right / 100,
                  bottom: pendCrop.bottom / 100, left: pendCrop.left / 100,
                };
                for (const p of cropSel) next[p] = c;
                set({ image_crops: next });
              }}
            >
              {t("figure.cropApplySel")}
            </button>
            <button
              disabled={cropSel.size === 0}
              onClick={async () => {
                const next = { ...(figure.image_crops ?? {}) };
                for (const p of cropSel) {
                  const b = p.replace(/\\/g, "/").split("/").pop() ?? p;
                  const asset = project.figures[b] ?? (p === figure.path ? project.figures[figure.id] : undefined);
                  if (!asset) continue;
                  try { next[p] = await autoTrimCrop(asset.dataUri); } catch { /* skip */ }
                }
                set({ image_crops: next });
              }}
            >
              {t("figure.cropAutoTrimSel")}
            </button>
            <button
              disabled={cropSel.size === 0}
              style={{ color: "var(--err)" }}
              onClick={() => {
                const next = { ...(figure.image_crops ?? {}) };
                for (const p of cropSel) delete next[p];
                set({ image_crops: Object.keys(next).length ? next : undefined });
              }}
            >
              {t("figure.cropClearSel")}
            </button>
          </div>
        ) : null}
      </div>

      {/* size */}
      <div className="field">
        <label>{t("figure.scale", { pct: Math.round((figure.scale ?? 1) * 100) })}</label>
        <div className="row">
          <input
            type="range"
            min={10}
            max={200}
            value={Math.round((figure.scale ?? 1) * 100)}
            onChange={(e) => set({ scale: Number(e.target.value) / 100 })}
            style={{ flex: 1 }}
          />
          <input
            type="number"
            min={5}
            max={400}
            value={Math.round((figure.scale ?? 1) * 100)}
            onChange={(e) => set({ scale: Number(e.target.value) / 100 })}
            style={{ width: 64 }}
          />
        </div>
        {(figure.scale ?? 1) > 1 ? <div className="hint">{t("figure.scaleOver")}</div> : null}
      </div>

      <label className="check" style={{ marginBottom: 4 }}>
        <input
          type="checkbox"
          checked={!!figure.style?.transparent_white}
          onChange={(e) => setStyle({ transparent_white: e.target.checked })}
        />
        {t("figure.transparentWhite")}
      </label>
      {onKnockoutWhite && asset ? (
        <button style={{ marginBottom: 6 }} onClick={() => onKnockoutWhite(figure)}>
          {t("figure.knockoutWhite")}
        </button>
      ) : null}

      <div className="inline">
        <div className="field">
          <label>{t("figure.align")}</label>
          <select value={figure.align ?? "center"} onChange={(e) => set({ align: e.target.value as any })}>
            {aligns.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t("figure.valign")}</label>
          <select
            value={figure.valign ?? ""}
            onChange={(e) => set({ valign: (e.target.value || undefined) as any })}
          >
            <option value="">{t("figure.valignNone")}</option>
            <option value="top">{t("figure.valignTop")}</option>
            <option value="middle">{t("figure.valignMiddle")}</option>
            <option value="bottom">{t("figure.valignBottom")}</option>
          </select>
        </div>
        <div className="field">
          <label>{t("figure.float")}</label>
          <select
            value={figure.float ?? ""}
            onChange={(e) => set({ float: (e.target.value || undefined) as any })}
          >
            <option value="">{t("figure.floatNone")}</option>
            <option value="left">{t("figure.floatLeft")}</option>
            <option value="right">{t("figure.floatRight")}</option>
          </select>
        </div>
        <div className="field">
          <label>{t("figure.captionPosition")}</label>
          <select
            value={figure.style?.caption_position ?? "bottom"}
            onChange={(e) => setStyle({ caption_position: e.target.value as any })}
          >
            <option value="bottom">{t("figure.posBottom")}</option>
            <option value="top">{t("figure.posTop")}</option>
            <option value="left">{t("figure.posLeft")}</option>
            <option value="right">{t("figure.posRight")}</option>
          </select>
        </div>
      </div>

      <LengthField
        label={t("figure.captionFontSize")}
        placeholder={project.doc.theme.font_size.caption}
        value={figure.style?.caption_font_size}
        defaultUnit="pt"
        onChange={(v) => setStyle({ caption_font_size: v })}
      />
      <ColorField
        label={t("figure.captionColor")}
        value={figure.style?.caption_color}
        onChange={(v) => setStyle({ caption_color: v })}
        themeColors={project.doc.theme.colors}
      />

      {/* placement */}
      <div className="field-group">
        <div className="legend">{t("figure.placementLegend")}</div>
        <div className="field">
          <label>{t("figure.placementMode")}</label>
          <select value={figure.placement} onChange={(e) => set({ placement: e.target.value as FigurePlacement })}>
            {placements.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          {figure.placement !== "inside-block" && (
            <div className="hint">
              {t("figure.placementHint")}
            </div>
          )}
        </div>
        <div className="field">
          <label>{t("figure.ownerBlock")}</label>
          <select value={ownerId} onChange={(e) => set({ block: e.target.value || undefined })}>
            <option value="">{t("figure.none")}</option>
            {ownerCandidates.map((b) => (
              <option key={b.id} value={b.id}>{b.title || b.id}</option>
            ))}
          </select>
          <div className="hint">
            {t("figure.ownerHint")}
          </div>
        </div>
        {figure.placement === "column" && (
          <div className="field">
            <label>{t("figure.column")}</label>
            <select value={figure.column ?? "left"} onChange={(e) => set({ column: e.target.value as ColumnName })}>
              {cols.includes(figure.column ?? "left") ? null : (
                <option value={figure.column ?? "left"}>{columnLabel(figure.column ?? "left")}</option>
              )}
              {cols.map((c) => (
                <option key={c} value={c}>{columnLabel(c)}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* border */}
      <div className="field-group">
        <div className="legend">{t("figure.borderLegend")}</div>
        <label className="check" style={{ marginBottom: 6 }}>
          <input
            type="checkbox"
            checked={!!figure.style?.border}
            onChange={(e) => setStyle({ border: e.target.checked })}
          />
          {t("figure.showBorder")}
        </label>
        {figure.style?.border && (
          <>
            <ColorField
              label={t("figure.borderColor")}
              value={figure.style?.border_color}
              onChange={(v) => setStyle({ border_color: v })}
            />
            {figureBlock ? (
              <label className="check">
                <input
                  type="checkbox"
                  checked={!!figure.style?.title_inside_border}
                  onChange={(e) => setStyle({ title_inside_border: e.target.checked })}
                />
                {t("figure.titleInsideBorder")}
              </label>
            ) : null}
          </>
        )}
      </div>

      {/* crop (not applicable while a gallery is active) */}
      <div className="field-group">
        <div className="legend">{t("figure.cropLegend")}</div>
        {galleryPaths.length > 0 ? (
          <div className="hint">
            {t("figure.cropGalleryDisabled")}
          </div>
        ) : null}
        <label className="check" style={{ marginBottom: 6 }}>
          <input
            type="checkbox"
            checked={!!crop.enabled}
            disabled={galleryPaths.length > 0}
            onChange={(e) => setCrop({ enabled: e.target.checked })}
          />
          {t("figure.cropEnable")}
        </label>
        {crop.enabled && galleryPaths.length === 0 && (
          <>
            {!asset?.naturalWidth && (
              <div className="hint">
                {t("figure.cropNeedSize")}
              </div>
            )}
            <div className="inline">
              <CropSide side="top" label={t("figure.cropTop")} />
              <CropSide side="bottom" label={t("figure.cropBottom")} />
            </div>
            <div className="inline">
              <CropSide side="left" label={t("figure.cropLeft")} />
              <CropSide side="right" label={t("figure.cropRight")} />
            </div>
            <div className="hint">{t("figure.cropHint")}</div>
          </>
        )}
      </div>
    </div>
  );
}
