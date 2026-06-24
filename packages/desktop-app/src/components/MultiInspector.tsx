// Inspector shown when multiple blocks are selected. Shows the common value of
// each field (blank when the selected blocks differ) and applies any change to
// ALL selected blocks.

import type { Block, ColumnName, HeightMode, PosterProject } from "@rps/core";
import ColorField from "./ColorField";
import FontField from "./FontField";
import { LengthField } from "./StepField";
import { columnOptions, columnShortLabel } from "../lib/columns";
import { useLang } from "../i18n";

interface BlockPatch {
  block?: Partial<Block>;
  style?: Partial<NonNullable<Block["style"]>>;
  height?: Partial<Block["height"]>;
}

interface Props {
  project: PosterProject;
  blocks: Block[];
  onPatch: (p: BlockPatch) => void;
}

export default function MultiInspector({ project, blocks, onPatch }: Props) {
  const { t } = useLang();
  // common value across all selected blocks, or undefined if they differ
  function com<T>(get: (b: Block) => T): T | undefined {
    if (blocks.length === 0) return undefined;
    const v0 = get(blocks[0]);
    return blocks.every((b) => get(b) === v0) ? v0 : undefined;
  }

  const setLayout = (patch: Partial<Block>) => onPatch({ block: patch });
  const setHeight = (patch: Partial<Block["height"]>) => onPatch({ height: patch });
  const setStyle = (patch: Partial<NonNullable<Block["style"]>>) => onPatch({ style: patch });

  const cols: ColumnName[] = columnOptions(project.doc.layout.columns.count);
  const heightModes: HeightMode[] = ["auto", "fixed", "flex", "locked"];

  const type = com((b) => b.type);
  const column = com((b) => b.column);
  const visible = com((b) => b.visible !== false);
  const hmode = com((b) => b.height.mode);

  return (
    <div className="inspector">
      <div className="pane-header" style={{ margin: "-10px -12px 10px" }}>
        {t("multi.header", { count: blocks.length })}
      </div>

      <div
        className="hint"
        style={{ background: "#2f3a2f", border: "1px solid var(--ok)", borderRadius: 5, padding: "5px 8px", marginBottom: 8 }}
      >
        {t("multi.notice")}
      </div>

      <div className="field">
        <label>{t("multi.selected")}</label>
        <div style={{ maxHeight: 96, overflow: "auto", border: "1px solid var(--border)", borderRadius: 4, padding: 4 }}>
          {blocks.map((b) => (
            <div key={b.id} style={{ fontSize: 11, padding: "1px 2px" }}>
              ・{b.title || b.id} <span className="tag">{columnShortLabel(b.column)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="inline">
        <div className="field">
          <label>{t("multi.type")}</label>
          <select value={type ?? ""} onChange={(e) => setLayout({ type: e.target.value as Block["type"] })}>
            {type === undefined && <option value="">{t("multi.mixed")}</option>}
            <option value="text">text</option>
            <option value="figure">figure</option>
            <option value="mixed">mixed</option>
          </select>
        </div>
        <div className="field">
          <label>{t("multi.column")}</label>
          <select value={column ?? ""} onChange={(e) => setLayout({ column: e.target.value as ColumnName })}>
            {column === undefined && <option value="">{t("multi.mixed")}</option>}
            {column !== undefined && !cols.includes(column) && (
              <option value={column}>{columnShortLabel(column)}</option>
            )}
            {cols.map((c) => (
              <option key={c} value={c}>{columnShortLabel(c)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label>{t("multi.visibility")}</label>
        <select
          value={visible === undefined ? "" : visible ? "true" : "false"}
          onChange={(e) => setLayout({ visible: e.target.value === "true" })}
        >
          {visible === undefined && <option value="">{t("multi.mixed")}</option>}
          <option value="true">{t("multi.visible")}</option>
          <option value="false">{t("multi.hidden")}</option>
        </select>
      </div>

      {/* height */}
      <div className="field-group">
        <div className="legend">{t("multi.heightLegend")}</div>
        <div className="field">
          <label>{t("multi.heightMode")}</label>
          <select value={hmode ?? ""} onChange={(e) => setHeight({ mode: e.target.value as HeightMode })}>
            {hmode === undefined && <option value="">{t("multi.mixed")}</option>}
            {heightModes.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <LengthField
          label={t("multi.fixedHeight")}
          placeholder={com((b) => b.height.value) === undefined ? t("multi.mixed") : "160mm"}
          value={com((b) => b.height.value)}
          step={5}
          onChange={(v) => setHeight({ value: v })}
        />
        <div className="inline">
          <LengthField
            label={t("multi.minHeight")}
            placeholder={com((b) => b.height.min) === undefined ? t("multi.mixed") : t("multi.exampleMin")}
            value={com((b) => b.height.min)}
            step={5}
            onChange={(v) => setHeight({ min: v })}
          />
          <LengthField
            label={t("multi.maxHeight")}
            placeholder={com((b) => b.height.max) === undefined ? t("multi.mixed") : t("multi.exampleMax")}
            value={com((b) => b.height.max)}
            step={5}
            onChange={(v) => setHeight({ max: v })}
          />
        </div>
      </div>

      {/* fonts */}
      <div className="field-group">
        <div className="legend">{t("multi.fontLegend")}</div>
        <FontField
          label={t("multi.font")}
          placeholder={
            com((b) => b.style?.font_family) === undefined ? t("multi.mixed") : project.doc.theme.font_family.body
          }
          value={com((b) => b.style?.font_family)}
          onChange={(v) => setStyle({ font_family: v })}
        />
        <LengthField
          label={t("multi.bodySize")}
          placeholder={
            com((b) => b.style?.body_font_size) === undefined ? t("multi.mixed") : project.doc.theme.font_size.body
          }
          value={com((b) => b.style?.body_font_size)}
          defaultUnit="pt"
          onChange={(v) => setStyle({ body_font_size: v })}
        />
        <LengthField
          label={t("multi.headingSize")}
          placeholder={
            com((b) => b.style?.heading_font_size) === undefined ? t("multi.mixed") : project.doc.theme.font_size.heading1
          }
          value={com((b) => b.style?.heading_font_size)}
          defaultUnit="pt"
          onChange={(v) => setStyle({ heading_font_size: v })}
        />
        <ColorField
          label={t("multi.textColor")}
          value={com((b) => b.style?.text_color)}
          onChange={(v) => setStyle({ text_color: v })}
        />
        <ColorField
          label={t("multi.headingColor")}
          value={com((b) => b.style?.heading_color)}
          onChange={(v) => setStyle({ heading_color: v })}
        />
      </div>

      {/* box */}
      <div className="field-group">
        <div className="legend">{t("multi.boxLegend")}</div>
        <ColorField
          label={t("multi.background")}
          value={com((b) => b.style?.background)}
          onChange={(v) => setStyle({ background: v })}
        />
        <div className="field">
          <label>{t("multi.border")}</label>
          <select
            value={(() => {
              const v = com((b) => !!b.style?.border);
              return v === undefined ? "" : v ? "true" : "false";
            })()}
            onChange={(e) => setStyle({ border: e.target.value === "true" })}
          >
            <option value="">{t("multi.mixed")}</option>
            <option value="true">{t("multi.visible")}</option>
            <option value="false">{t("multi.hidden")}</option>
          </select>
        </div>
        <ColorField
          label={t("multi.borderColor")}
          value={com((b) => b.style?.border_color)}
          onChange={(v) => setStyle({ border_color: v })}
        />
        <LengthField
          label={t("multi.borderWidth")}
          placeholder={com((b) => b.style?.border_width) === undefined ? t("multi.mixed") : "1pt"}
          value={com((b) => b.style?.border_width)}
          defaultUnit="pt"
          step={0.5}
          onChange={(v) => setStyle({ border_width: v })}
        />
      </div>
    </div>
  );
}
