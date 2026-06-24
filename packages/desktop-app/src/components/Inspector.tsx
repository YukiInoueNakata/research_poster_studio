// Right-pane block inspector (設計書 §9.3). Edits flow up via onChangeBlock /
// onChangeContent; App persists to poster.yaml and content/*.md.
//
// The pane is split into tabs (本文 / レイアウト / 書式) so it is not one long
// scroll; the first tab is the body editor.

import { useState } from "react";
import type {
  Block,
  ColumnName,
  HeightMode,
  HeightSyncMode,
  PosterProject,
} from "@rps/core";
import { parseFontPt, readingDistanceM } from "@rps/core";
import { columnLabel, columnOptions } from "../lib/columns";
import { useLang } from "../i18n";
import MarkdownEditor from "./MarkdownEditor";
import ColorField from "./ColorField";
import FontField from "./FontField";
import { NumberField, LengthField } from "./StepField";

interface BlockPatch {
  block?: Partial<Block>;
  style?: Partial<NonNullable<Block["style"]>>;
  height?: Partial<Block["height"]>;
}

type Tab = "content" | "layout" | "format";

interface Props {
  project: PosterProject;
  block: Block | null;
  /** number of blocks currently selected (for bulk-edit banner) */
  selectedCount: number;
  content: string;
  /** apply layout/style/height to ALL selected blocks */
  onPatch: (p: BlockPatch) => void;
  /** apply to the primary block only (title / order) */
  onPatchPrimary: (p: BlockPatch) => void;
  onChangeContent: (md: string) => void;
  onMoveBlock: (dir: -1 | 1) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onApplyBorderToAll: (border: {
    border: boolean;
    border_color?: string;
    border_width?: string;
  }) => void;
  onAddChild: (parentId: string, kind: "wide" | "pair" | "left" | "right") => void;
  onRemoveBlock: (id: string) => void;
  onAddFigure: (parentId: string | null, src: "file" | "clipboard") => void;
  /** fit the block's body font size to its box height (user-triggered; §8.5) */
  onAutoFit?: (id: string) => void;
  size?: { w: number; h: number };
}

const TABS: { id: Tab; key: string }[] = [
  { id: "content", key: "inspector.tabContent" },
  { id: "layout", key: "inspector.tabLayout" },
  { id: "format", key: "inspector.tabFormat" },
];

export default function Inspector({
  project,
  block,
  selectedCount,
  content,
  onPatch,
  onPatchPrimary,
  onChangeContent,
  onMoveBlock,
  canMoveUp = true,
  canMoveDown = true,
  onApplyBorderToAll,
  onAddChild,
  onRemoveBlock,
  onAddFigure,
  onAutoFit,
  size,
}: Props) {
  const { t } = useLang();
  const [tab, setTab] = useState<Tab>("content");

  if (!block) {
    return (
      <div>
        <div className="pane-header">{t("inspector.blockSettings")}</div>
        <div className="empty">{t("inspector.selectPrompt")}</div>
      </div>
    );
  }

  // layout/style/height apply to all selected; title/order to primary only
  const setLayout = (patch: Partial<Block>) => onPatch({ block: patch });
  const setHeight = (patch: Partial<Block["height"]>) => onPatch({ height: patch });
  const setStyle = (patch: Partial<NonNullable<Block["style"]>>) => onPatch({ style: patch });
  const setTitle = (patch: Partial<Block>) => onPatchPrimary({ block: patch });

  const themeColors = project.doc.theme.colors;
  const cols: ColumnName[] = columnOptions(project.doc.layout.columns.count);
  const heightModes: HeightMode[] = ["auto", "fixed", "flex", "locked"];
  const syncModes: HeightSyncMode[] = [
    "independent",
    "sync_row",
    "left_follows",
    "right_follows",
    "balance_columns",
  ];

  return (
    <div className="inspector">
      <div className="pane-header" style={{ margin: "-10px -12px 8px" }}>
        {t("inspector.blockSettings")} — {block.id}
      </div>

      {selectedCount > 1 ? (
        <div
          className="hint"
          style={{ background: "#2f3a2f", border: "1px solid var(--ok)", borderRadius: 5, padding: "5px 8px", marginBottom: 8 }}
        >
          {t("inspector.bulkBanner", { count: selectedCount, id: block.id })}
        </div>
      ) : null}

      <div className="inspector-tabs">
        {TABS.map((tab2) => (
          <button
            key={tab2.id}
            className={`inspector-tab${tab === tab2.id ? " active" : ""}`}
            onClick={() => setTab(tab2.id)}
          >
            {t(tab2.key)}
          </button>
        ))}
      </div>

      {tab === "content" ? (
        <>
          <div className="field">
            <label>{selectedCount > 1 ? t("inspector.titleLabelPrimary") : t("inspector.titleLabel")}</label>
            <textarea
              value={block.title}
              onChange={(e) => setTitle({ title: e.target.value })}
              rows={Math.max(1, block.title.split("\n").length)}
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>

          {/* citation mode: generated reference list */}
          {block.type !== "figure" && (
            <div className="field-group">
              <div className="legend">{t("inspector.referencesLegend")}</div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={!!block.references_list}
                  onChange={(e) =>
                    onPatchPrimary({ block: { references_list: e.target.checked || undefined } })
                  }
                />
                {t("inspector.referencesAutoGen")}
              </label>
              <div className="hint">
                {t("inspector.referencesHint")}
                {project.bib == null
                  ? t("inspector.bibNotLoaded")
                  : t("inspector.bibLoaded", { count: project.bib.length })}
              </div>
            </div>
          )}

          {/* content */}
          {block.source ? (
            <div className="field-group">
              <div className="legend">{t("inspector.bodyLegend", { source: block.source })}</div>
              <MarkdownEditor value={content} onChange={onChangeContent} />
            </div>
          ) : (block.children?.length ?? 0) > 0 ? (
            <div className="hint">
              {t("inspector.bodyHasChildren", { count: block.children!.length })}
            </div>
          ) : (
            <div className="hint">{t("inspector.bodyNoSource")}</div>
          )}
        </>
      ) : null}

      {tab === "layout" ? (
        <>
          <div className="inline">
            <div className="field">
              <label>{t("inspector.typeLabel")}</label>
              <select value={block.type} onChange={(e) => setLayout({ type: e.target.value as Block["type"] })}>
                <option value="text">text</option>
                <option value="figure">figure</option>
                <option value="mixed">mixed</option>
              </select>
            </div>
            <div className="field">
              <label>{t("inspector.columnLabel")}</label>
              <select value={block.column} onChange={(e) => setLayout({ column: e.target.value as ColumnName })}>
                {cols.includes(block.column) ? null : (
                  <option value={block.column}>{columnLabel(block.column)}</option>
                )}
                {cols.map((c) => (
                  <option key={c} value={c}>{columnLabel(c)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label>{t("inspector.orderLabel")}</label>
            <div className="row">
              <button onClick={() => onMoveBlock(-1)} disabled={!canMoveUp} title={t("inspector.moveUp")}>
                ▲ {t("inspector.moveUp")}
              </button>
              <button onClick={() => onMoveBlock(1)} disabled={!canMoveDown} title={t("inspector.moveDown")}>
                ▼ {t("inspector.moveDown")}
              </button>
              <input
                type="number"
                value={block.order}
                onChange={(e) => setTitle({ order: Number(e.target.value) })}
                style={{ width: 70 }}
              />
              <label className="check" style={{ marginLeft: "auto" }}>
                <input
                  type="checkbox"
                  checked={block.visible !== false}
                  onChange={(e) => setLayout({ visible: e.target.checked })}
                />
                {t("inspector.visible")}
              </label>
            </div>
            {!canMoveUp && !canMoveDown ? (
              <div className="hint">
                {t("inspector.singleBlockHint")}
              </div>
            ) : null}
          </div>

          {/* child blocks / actions */}
          <div className="field-group">
            <div className="legend">{t("inspector.childLegend")}</div>
            {(block.children?.length ?? 0) > 0 ? (
              <div className="hint" style={{ marginBottom: 6 }}>
                {t("inspector.childCountHint", { count: block.children!.length })}
              </div>
            ) : null}
            <div className="row" style={{ flexWrap: "wrap", gap: 4 }}>
              <button onClick={() => onAddChild(block.id, "wide")}>＋ {t("inspector.addChildWide")}</button>
              <button onClick={() => onAddChild(block.id, "left")}>＋ {t("inspector.addChildLeft")}</button>
              <button onClick={() => onAddChild(block.id, "right")}>＋ {t("inspector.addChildRight")}</button>
              <button onClick={() => onAddChild(block.id, "pair")}>＋ {t("inspector.addChildPair")}</button>
              <button
                onClick={() => onRemoveBlock(block.id)}
                title={t("inspector.removeBlockTitle")}
                style={{ marginLeft: "auto", color: "var(--err)" }}
              >
                {t("inspector.remove")}
              </button>
            </div>
            <div className="row" style={{ flexWrap: "wrap", gap: 4, marginTop: 4 }}>
              <button onClick={() => onAddFigure(block.id, "file")}>＋ {t("inspector.addFigureFile")}</button>
              <button onClick={() => onAddFigure(block.id, "clipboard")}>＋ {t("inspector.addFigureClipboard")}</button>
            </div>
            <div className="hint">
              {t("inspector.childActionsHint")}
            </div>
            {(block.children?.length ?? 0) > 0 && (
              <>
                <div className="field">
                  <label>{t("inspector.childRatioLabel")}</label>
                  <select
                    value={block.child_layout?.mode === "custom" ? "custom" : "inherit"}
                    onChange={(e) =>
                      setLayout({
                        child_layout:
                          e.target.value === "custom"
                            ? {
                                mode: "custom",
                                count: 2,
                                width_mode: "ratio",
                                ratio: block.child_layout?.ratio ?? [0.5, 0.5],
                              }
                            : { mode: "inherit" },
                      })
                    }
                  >
                    <option value="inherit">{t("inspector.childRatioInherit")}</option>
                    <option value="custom">{t("inspector.childRatioCustom")}</option>
                  </select>
                </div>
                {block.child_layout?.mode === "custom" && (
                  <div className="inline">
                    <NumberField
                      label={t("inspector.leftPct")}
                      value={Math.round((block.child_layout.ratio?.[0] ?? 0.5) * 100)}
                      min={10}
                      max={90}
                      step={1}
                      onChange={(v) =>
                        setLayout({
                          child_layout: { mode: "custom", count: 2, width_mode: "ratio", ratio: [v / 100, 1 - v / 100] },
                        })
                      }
                    />
                    <NumberField
                      label={t("inspector.rightPct")}
                      value={Math.round((block.child_layout.ratio?.[1] ?? 0.5) * 100)}
                      min={10}
                      max={90}
                      step={1}
                      onChange={(v) =>
                        setLayout({
                          child_layout: { mode: "custom", count: 2, width_mode: "ratio", ratio: [1 - v / 100, v / 100] },
                        })
                      }
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* height */}
          <div className="field-group">
            <div className="legend">
              {t("inspector.sizeHeightLegend")}
              {size ? (
                <span style={{ float: "right", fontWeight: 400, color: "var(--muted)" }}>
                  {t("inspector.realSize", { w: size.w, h: size.h })}
                </span>
              ) : null}
            </div>
            <div className="field">
              <label>{t("inspector.heightModeLabel")}</label>
              <select
                value={block.height.mode}
                onChange={(e) => setHeight({ mode: e.target.value as HeightMode })}
              >
                {heightModes.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {block.height.mode === "auto" && (
                <div className="hint">{t("inspector.heightAutoHint")}</div>
              )}
            </div>
            {(block.height.mode === "fixed" || block.height.mode === "locked") && (
              <LengthField
                label={t("inspector.fixedHeight")}
                placeholder="160mm"
                value={block.height.value}
                step={5}
                onChange={(v) => setHeight({ value: v })}
              />
            )}
            {block.height.mode === "flex" && (
              <NumberField
                label="Flex weight"
                value={block.height.weight ?? 1}
                min={0}
                step={1}
                onChange={(v) => setHeight({ weight: v })}
              />
            )}
            <div className="inline">
              <LengthField
                label={t("inspector.minHeight")}
                placeholder={t("inspector.minHeightPlaceholder")}
                value={block.height.min}
                step={5}
                onChange={(v) => setHeight({ min: v })}
              />
              <LengthField
                label={t("inspector.maxHeight")}
                placeholder={t("inspector.maxHeightPlaceholder")}
                value={block.height.max}
                step={5}
                onChange={(v) => setHeight({ max: v })}
              />
            </div>
            <div className="field">
              <label>{t("inspector.heightSyncLabel")}</label>
              <select
                value={block.sync ?? "independent"}
                onChange={(e) => setLayout({ sync: e.target.value as HeightSyncMode })}
              >
                {syncModes.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={!!block.pin_bottom}
                onChange={(e) => setLayout({ pin_bottom: e.target.checked })}
              />
              {t("inspector.pinBottom")}
            </label>
          </div>

          <div className="field">
            <label>{t("inspector.overflowLabel")}</label>
            <select
              value={block.overflow?.action ?? "warn"}
              onChange={(e) => setLayout({ overflow: { action: e.target.value as any } })}
            >
              <option value="warn">{t("inspector.overflowWarn")}</option>
              <option value="clip">{t("inspector.overflowClip")}</option>
              <option value="scroll">scroll</option>
            </select>
          </div>
        </>
      ) : null}

      {tab === "format" ? (
        <>
          {/* block title */}
          <div className="field-group">
            <div className="legend">{t("inspector.blockTitleLegend")}</div>
            <div className="inline">
              <LengthField
                label={t("inspector.sizeLabel")}
                placeholder={project.doc.theme.font_size.heading1}
                value={block.style?.heading_font_size}
                defaultUnit="pt"
                onChange={(v) => setStyle({ heading_font_size: v })}
              />
              <div className="field">
                <label>{t("inspector.decorPositionLabel")}</label>
                <div className="row">
                  <button
                    className={block.style?.heading_bold ? "primary" : ""}
                    onClick={() => setStyle({ heading_bold: !block.style?.heading_bold })}
                    title={t("inspector.bold")}
                  >
                    <b>B</b>
                  </button>
                  <button
                    className={block.style?.heading_italic ? "primary" : ""}
                    onClick={() => setStyle({ heading_italic: !block.style?.heading_italic })}
                    title={t("inspector.italic")}
                  >
                    <i>I</i>
                  </button>
                  <button
                    className={block.style?.heading_underline ? "primary" : ""}
                    onClick={() => setStyle({ heading_underline: !block.style?.heading_underline })}
                    title={t("inspector.underline")}
                  >
                    <u>U</u>
                  </button>
                  <select
                    value={block.style?.heading_align ?? ""}
                    onChange={(e) => setStyle({ heading_align: (e.target.value || undefined) as any })}
                    title={t("inspector.horizontalAlign")}
                  >
                    <option value="">{t("inspector.alignDefault")}</option>
                    <option value="left">{t("inspector.alignLeft")}</option>
                    <option value="center">{t("inspector.alignCenter")}</option>
                    <option value="right">{t("inspector.alignRight")}</option>
                  </select>
                </div>
              </div>
            </div>
            <ColorField
              label={t("inspector.headingColor")}
              value={block.style?.heading_color}
              onChange={(v) => setStyle({ heading_color: v })}
              themeColors={themeColors}
            />
            <ColorField
              label={t("inspector.headingBackground")}
              value={block.style?.heading_background}
              onChange={(v) => setStyle({ heading_background: v })}
              themeColors={themeColors}
              allowTransparent
            />
            <div className="inline">
              <div className="field">
                <label>{t("inspector.headingWidthLabel")}</label>
                <select
                  value={block.style?.heading_width_mode ?? "full"}
                  onChange={(e) => setStyle({ heading_width_mode: e.target.value as any })}
                >
                  <option value="full">{t("inspector.headingWidthFull")}</option>
                  <option value="fit">{t("inspector.headingWidthFit")}</option>
                  <option value="custom">{t("inspector.headingWidthCustom")}</option>
                </select>
              </div>
              {block.style?.heading_width_mode === "custom" && (
                <LengthField
                  label={t("inspector.widthValue")}
                  placeholder={t("inspector.widthValuePlaceholder")}
                  value={block.style?.heading_width}
                  step={5}
                  onChange={(v) => setStyle({ heading_width: v })}
                />
              )}
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={block.style?.heading_accent_bar !== false}
                onChange={(e) => setStyle({ heading_accent_bar: e.target.checked })}
              />
              {t("inspector.accentBar")}
            </label>
            {block.style?.heading_accent_bar !== false && (
              <ColorField
                label={t("inspector.accentBarColor")}
                value={block.style?.heading_bar_color}
                onChange={(v) => setStyle({ heading_bar_color: v })}
                themeColors={themeColors}
              />
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={!!block.style?.heading_badge}
                onChange={(e) =>
                  setStyle({ heading_badge: e.target.checked ? { shape: "rounded" } : undefined })
                }
              />
              {t("inspector.headingBadge")}
            </label>
            {block.style?.heading_badge && (
              <>
                <div className="field">
                  <label>{t("inspector.badgeShape")}</label>
                  <select
                    value={block.style.heading_badge.shape ?? "rounded"}
                    onChange={(e) =>
                      setStyle({ heading_badge: { ...block.style!.heading_badge, shape: e.target.value as any } })
                    }
                  >
                    <option value="square">{t("inspector.badgeSquare")}</option>
                    <option value="rounded">{t("inspector.badgeRounded")}</option>
                    <option value="circle">{t("inspector.badgeCircle")}</option>
                  </select>
                </div>
                <ColorField
                  label={t("inspector.badgeBg")}
                  value={block.style.heading_badge.background}
                  onChange={(v) => setStyle({ heading_badge: { ...block.style!.heading_badge, background: v } })}
                  themeColors={themeColors}
                />
                <ColorField
                  label={t("inspector.badgeColor")}
                  value={block.style.heading_badge.color}
                  onChange={(v) => setStyle({ heading_badge: { ...block.style!.heading_badge, color: v } })}
                  themeColors={themeColors}
                />
              </>
            )}
          </div>

          {/* body text */}
          <div className="field-group">
            <div className="legend">{t("inspector.bodyTextLegend")}</div>
            <FontField
              label={t("inspector.fontLabel")}
              placeholder={project.doc.theme.font_family.body}
              value={block.style?.font_family}
              onChange={(v) => setStyle({ font_family: v })}
            />
            <LengthField
              label={t("inspector.bodySizeLabel")}
              placeholder={project.doc.theme.font_size.body}
              value={block.style?.body_font_size}
              defaultUnit="pt"
              onChange={(v) => setStyle({ body_font_size: v })}
            />
            {(() => {
              const pt =
                parseFontPt(block.style?.body_font_size) ??
                parseFontPt(project.doc.theme.font_size.body);
              if (pt == null) return null;
              const d = readingDistanceM(pt);
              return (
                <div className="hint">
                  {t("inspector.readingDistance", {
                    comfortable: d.comfortable.toFixed(1),
                    legible: d.legible.toFixed(1),
                  })}
                </div>
              );
            })()}
            <ColorField
              label={t("inspector.textColor")}
              value={block.style?.text_color}
              onChange={(v) => setStyle({ text_color: v })}
              themeColors={themeColors}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={!!block.style?.italic}
                onChange={(e) => setStyle({ italic: e.target.checked })}
              />
              {t("inspector.bodyItalic")}
            </label>
            <div className="inline">
              <NumberField
                label={t("inspector.lineHeight")}
                value={block.style?.line_height ?? project.doc.theme.line_height ?? 1.45}
                min={1}
                max={3}
                step={0.05}
                onChange={(v) => setStyle({ line_height: Math.round(v * 100) / 100 })}
              />
              <NumberField
                label={t("inspector.paragraphSpacing")}
                value={
                  block.style?.paragraph_spacing_mm ??
                  project.doc.theme.paragraph_spacing_mm ??
                  2
                }
                min={0}
                max={10}
                step={0.5}
                onChange={(v) => setStyle({ paragraph_spacing_mm: v })}
              />
            </div>
            {(block.style?.line_height != null || block.style?.paragraph_spacing_mm != null) && (
              <button
                onClick={() => setStyle({ line_height: undefined, paragraph_spacing_mm: undefined })}
                style={{ marginBottom: 6 }}
              >
                {t("inspector.resetSpacing")}
              </button>
            )}
            {onAutoFit && (
              <div className="field">
                <button
                  onClick={() => onAutoFit(block.id)}
                  title={t("inspector.autoFitTitle")}
                >
                  {t("inspector.autoFit")}
                </button>
                <div className="hint">
                  {t("inspector.autoFitHint")}
                </div>
              </div>
            )}
          </div>

          {/* box: background + border */}
          <div className="field-group">
            <div className="legend">{t("inspector.backgroundBorderLegend")}</div>
            <ColorField
              label={t("inspector.backgroundColor")}
              value={block.style?.background}
              onChange={(v) => setStyle({ background: v })}
              themeColors={themeColors}
              allowTransparent
            />
            <label className="check">
              <input
                type="checkbox"
                checked={!!block.style?.card}
                onChange={(e) => setStyle({ card: e.target.checked })}
              />
              {t("inspector.cardStyle")}
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={!!block.style?.accent_bar}
                onChange={(e) => setStyle({ accent_bar: e.target.checked ? {} : undefined })}
              />
              {t("inspector.accentBarLeft")}
            </label>
            {block.style?.accent_bar && (
              <ColorField
                label={t("inspector.accentBarColor")}
                value={block.style.accent_bar.color}
                onChange={(v) => setStyle({ accent_bar: { ...block.style!.accent_bar, color: v } })}
                themeColors={themeColors}
              />
            )}
            <label className="check" style={{ marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={!!block.style?.border}
                onChange={(e) => setStyle({ border: e.target.checked })}
              />
              {t("inspector.showBorder")}
            </label>
            {block.style?.border && (
              <div className="inline">
                <ColorField
                  label={t("inspector.borderColor")}
                  value={block.style?.border_color}
                  onChange={(v) => setStyle({ border_color: v })}
                  themeColors={themeColors}
                />
                <LengthField
                  label={t("inspector.borderWidth")}
                  placeholder="1pt"
                  value={block.style?.border_width}
                  defaultUnit="pt"
                  step={0.5}
                  onChange={(v) => setStyle({ border_width: v })}
                />
              </div>
            )}
            <div className="inline">
              <div className="field">
                <label>{t("inspector.cornerLabel")}</label>
                <select
                  value={block.style?.corner ?? "square"}
                  onChange={(e) => setStyle({ corner: e.target.value as "square" | "rounded" })}
                >
                  <option value="square">{t("inspector.cornerSquare")}</option>
                  <option value="rounded">{t("inspector.cornerRounded")}</option>
                </select>
              </div>
              <NumberField
                label={t("inspector.paddingLabel")}
                value={block.style?.padding_mm ?? 4}
                min={0}
                step={1}
                onChange={(v) => setStyle({ padding_mm: v })}
              />
            </div>
            <button
              onClick={() =>
                onApplyBorderToAll({
                  border: !!block.style?.border,
                  border_color: block.style?.border_color,
                  border_width: block.style?.border_width,
                })
              }
              title={t("inspector.applyBorderAllTitle")}
              style={{ marginTop: 4 }}
            >
              {t("inspector.applyBorderAll")}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
