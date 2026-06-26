// 全体設定 (project-wide settings): paper, columns, margins, theme colors, and
// template loading. Shown in the right pane via the toolbar "全体設定" button.

import { useMemo, useState } from "react";
import type {
  FormatPackage,
  FormatSections,
  Layout,
  Orientation,
  PaperSize,
  PosterProject,
  ProjectMeta,
  ReferencesConfig,
  Theme,
  UnitSystem,
} from "@rps/core";
import {
  columnOrder,
  posterSizeMm,
  prepareCitations,
  resolveCitationStyle,
  THEME_PRESETS,
  MAX_COLUMNS,
  MM_PER_INCH,
  readingDistanceIndex,
  requiredPtForDistance,
} from "@rps/core";
import ColorField from "./ColorField";
import { NumberField } from "./StepField";
import { columnShortLabel } from "../lib/columns";
import { useLang } from "../i18n";

interface Props {
  project: PosterProject;
  onChangeMeta: (patch: Partial<ProjectMeta>) => void;
  onChangeLayout: (patch: Partial<Layout>) => void;
  onChangeTheme: (patch: Partial<Theme>) => void;
  onChangeReferences: (patch: Partial<ReferencesConfig>) => void;
  /** フォーマット（テーマ/レイアウト/ヘッダー体裁/構造）を YAML へ書き出す */
  onExportFormat: () => void;
  /** フォーマット YAML（または poster.yaml）を選択して読み込む */
  onPickFormatFile: () => Promise<FormatPackage | null>;
  /** 読み込んだフォーマットの選択セクションを適用する */
  onApplyFormat: (pkg: FormatPackage, sections: FormatSections) => void;
  onClose: () => void;
  /** open a file dialog, copy the image into figures/, return the basename */
  onAddImageFile?: () => Promise<string | null>;
  /** switch body storage between single content.md and per-block files */
  onConvertContent: (mode: "combined" | "per-block") => void;
  /** open the whole-content (content.md) editor */
  onEditContentFile: () => void;
}

const COLOR_KEYS: { key: keyof Theme["colors"]; labelKey: string }[] = [
  { key: "text", labelKey: "settings.color.text" },
  { key: "heading", labelKey: "settings.color.heading" },
  { key: "accent", labelKey: "settings.color.accent" },
  { key: "warning", labelKey: "settings.color.warning" },
  { key: "muted", labelKey: "settings.color.muted" },
  { key: "background", labelKey: "settings.color.background" },
];

export default function ProjectSettings({
  project,
  onChangeMeta,
  onChangeLayout,
  onChangeTheme,
  onChangeReferences,
  onExportFormat,
  onPickFormatFile,
  onApplyFormat,
  onClose,
  onAddImageFile,
  onConvertContent,
  onEditContentFile,
}: Props) {
  const { t } = useLang();
  const { project: meta, layout, theme } = project.doc;
  const refs = project.doc.references ?? {};
  const citeStyle = resolveCitationStyle(project.doc, project.citationStyles);
  const citePrep = useMemo(() => prepareCitations(project), [project]);
  const [applyFonts, setApplyFonts] = useState(true);
  const [targetDistM, setTargetDistM] = useState(1.5);
  // format package import: picked package + section checkboxes (構造は既定 OFF)
  const [pendingFormat, setPendingFormat] = useState<FormatPackage | null>(null);
  const [fmtSections, setFmtSections] = useState<FormatSections>({
    theme: true,
    layout: true,
    header: true,
    structure: false,
  });
  const setColumns = (patch: Partial<Layout["columns"]>) =>
    onChangeLayout({ columns: { ...layout.columns, ...patch } });
  const ratio = layout.columns.ratio ?? [];

  const bg = theme.background;
  const setBg = (patch: Partial<NonNullable<Theme["background"]>>) =>
    onChangeTheme({ background: { ...(bg ?? {}), ...patch } });

  const units: UnitSystem = meta.units ?? "mm";
  const cs = meta.custom_size ?? { width_mm: 841, height_mm: 1189 };
  // NumberField shows whole-ish values in the display unit; store always in mm
  const toUnit = (mm: number) =>
    units === "in" ? Math.round((mm / MM_PER_INCH) * 10) / 10 : Math.round(mm);
  const fromUnit = (v: number) => (units === "in" ? v * MM_PER_INCH : v);

  return (
    <div className="inspector">
      <div className="pane-header" style={{ margin: "-10px -12px 10px", display: "flex", justifyContent: "space-between" }}>
        <span>{t("settings.title")}</span>
        <button onClick={onClose}>{t("settings.close")}</button>
      </div>

      {/* paper */}
      <div className="field-group">
        <div className="legend">{t("settings.paper.legend")}</div>
        <div className="inline">
          <div className="field">
            <label>{t("settings.paper.size")}</label>
            <select
              value={meta.poster_size}
              onChange={(e) => {
                const v = e.target.value as PaperSize;
                if (v === "custom") {
                  // start the custom size from the current effective size
                  const cur = posterSizeMm(meta);
                  onChangeMeta({
                    poster_size: v,
                    custom_size: { width_mm: cur.w, height_mm: cur.h },
                  });
                } else {
                  onChangeMeta({ poster_size: v });
                }
              }}
            >
              <option value="A0">{t("settings.paper.size.a0")}</option>
              <option value="A1">{t("settings.paper.size.a1")}</option>
              <option value="A2">{t("settings.paper.size.a2")}</option>
              <option value="36x48in">{t("settings.paper.size.36x48in")}</option>
              <option value="42x56in">{t("settings.paper.size.42x56in")}</option>
              <option value="48x96in">{t("settings.paper.size.48x96in")}</option>
              <option value="custom">{t("settings.paper.size.custom")}</option>
            </select>
          </div>
          <div className="field">
            <label>{t("settings.paper.orientation")}</label>
            <select
              value={meta.orientation}
              disabled={meta.poster_size === "custom"}
              onChange={(e) => onChangeMeta({ orientation: e.target.value as Orientation })}
            >
              <option value="portrait">{t("settings.paper.portrait")}</option>
              <option value="landscape">{t("settings.paper.landscape")}</option>
            </select>
          </div>
          <div className="field">
            <label>{t("settings.paper.units")}</label>
            <select
              value={units}
              onChange={(e) => onChangeMeta({ units: e.target.value as UnitSystem })}
            >
              <option value="mm">mm</option>
              <option value="in">inch</option>
            </select>
          </div>
        </div>
        {meta.poster_size === "custom" && (
          <>
            <div className="inline">
              <NumberField
                label={t("settings.paper.width", { units })}
                value={toUnit(cs.width_mm)}
                min={units === "in" ? 4 : 100}
                step={units === "in" ? 1 : 10}
                onChange={(v) =>
                  onChangeMeta({ custom_size: { ...cs, width_mm: fromUnit(v) } })
                }
              />
              <NumberField
                label={t("settings.paper.height", { units })}
                value={toUnit(cs.height_mm)}
                min={units === "in" ? 4 : 100}
                step={units === "in" ? 1 : 10}
                onChange={(v) =>
                  onChangeMeta({ custom_size: { ...cs, height_mm: fromUnit(v) } })
                }
              />
            </div>
            <div className="hint">
              {t("settings.paper.customHint")}
            </div>
          </>
        )}
      </div>

      {/* columns */}
      <div className="field-group">
        <div className="legend">{t("settings.columns.legend")}</div>
        <div className="inline">
          <div className="field">
            <label>{t("settings.columns.count")}</label>
            <select
              value={layout.columns.count}
              onChange={(e) => setColumns({ count: Number(e.target.value) })}
            >
              {Array.from({ length: MAX_COLUMNS }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{t("settings.columns.widthMode")}</label>
            <select
              value={layout.columns.width_mode}
              onChange={(e) => setColumns({ width_mode: e.target.value as any })}
            >
              <option value="equal">equal</option>
              <option value="ratio">ratio</option>
            </select>
          </div>
        </div>
        {layout.columns.count === 2 && layout.columns.width_mode === "ratio" && (
          <div className="inline">
            <NumberField
              label={t("settings.columns.left")}
              value={Math.round((ratio[0] ?? 0.5) * 100)}
              min={10}
              max={90}
              step={1}
              onChange={(v) => setColumns({ ratio: [v / 100, 1 - v / 100] })}
            />
            <NumberField
              label={t("settings.columns.right")}
              value={Math.round((ratio[1] ?? 0.5) * 100)}
              min={10}
              max={90}
              step={1}
              onChange={(v) => setColumns({ ratio: [1 - v / 100, v / 100] })}
            />
          </div>
        )}
        {layout.columns.count >= 3 && layout.columns.width_mode === "ratio" && (
          <>
            <div className="inline" style={{ flexWrap: "wrap" }}>
              {columnOrder(layout.columns.count).map((name, i) => (
                <NumberField
                  key={name}
                  label={`${columnShortLabel(name)} %`}
                  value={Math.round((ratio[i] ?? 1 / layout.columns.count) * 100)}
                  min={5}
                  max={90}
                  step={1}
                  onChange={(v) => {
                    const next = columnOrder(layout.columns.count).map(
                      (_, j) => ratio[j] ?? 1 / layout.columns.count,
                    );
                    next[i] = v / 100;
                    setColumns({ ratio: next });
                  }}
                />
              ))}
            </div>
            <div className="hint">{t("settings.columns.normalizeHint")}</div>
          </>
        )}
        <div className="field">
          <label>{t("settings.columns.sync")}</label>
          <select
            value={layout.columns.sync_mode}
            onChange={(e) => setColumns({ sync_mode: e.target.value as any })}
          >
            <option value="independent">{t("settings.columns.sync.independent")}</option>
            <option value="sync_row">{t("settings.columns.sync.syncRow")}</option>
            <option value="left_follows">{t("settings.columns.sync.leftFollows")}</option>
            <option value="right_follows">{t("settings.columns.sync.rightFollows")}</option>
            <option value="balance_columns">balance_columns</option>
          </select>
          <div className="hint">
            {t("settings.columns.syncHint")}
          </div>
        </div>
        <div className="inline">
          <NumberField
            label={t("settings.columns.margin")}
            value={layout.margin_mm ?? 20}
            min={0}
            step={1}
            onChange={(v) => onChangeLayout({ margin_mm: v })}
          />
          <NumberField
            label={t("settings.columns.colGap")}
            value={layout.column_gap_mm ?? layout.gap_mm ?? 8}
            min={0}
            step={1}
            onChange={(v) => onChangeLayout({ column_gap_mm: v })}
          />
          <NumberField
            label={t("settings.columns.rowGap")}
            value={layout.row_gap_mm ?? layout.gap_mm ?? 8}
            min={0}
            step={1}
            onChange={(v) => onChangeLayout({ row_gap_mm: v })}
          />
          <label className="check" style={{ marginTop: 4 }}>
            <input
              type="checkbox"
              checked={!!layout.number_sections}
              onChange={(e) => onChangeLayout({ number_sections: e.target.checked || undefined })}
            />
            {t("settings.number.sections")}
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={!!layout.number_figures}
              onChange={(e) => onChangeLayout({ number_figures: e.target.checked || undefined })}
            />
            {t("settings.number.figures")}
          </label>
          <div className="hint">{t("settings.number.hint")}</div>
        </div>
        <div className="hint">
          {t("settings.columns.gapHint")}
        </div>
      </div>

      {/* content file mode */}
      <div className="field-group">
        <div className="legend">{t("settings.content.legend")}</div>
        <div className="hint" style={{ marginBottom: 6 }}>
          {meta.content_file
            ? t("settings.content.modeCombined", { file: meta.content_file })
            : t("settings.content.modePerBlock")}
        </div>
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          {meta.content_file ? (
            <>
              <button onClick={onEditContentFile}>{t("settings.content.editAll")}</button>
              <button onClick={() => onConvertContent("per-block")}>
                {t("settings.content.toPerBlock")}
              </button>
            </>
          ) : (
            <button onClick={() => onConvertContent("combined")}>
              {t("settings.content.toCombined")}
            </button>
          )}
        </div>
        <div className="hint">{t("settings.content.hint")}</div>
      </div>

      {/* theme colors */}
      <div className="field-group">
        <div className="legend">{t("settings.colors.legend")}</div>
        {COLOR_KEYS.map(({ key, labelKey }) => (
          <ColorField
            key={key}
            label={t(labelKey)}
            value={theme.colors[key]}
            onChange={(v) => onChangeTheme({ colors: { ...theme.colors, [key]: v ?? theme.colors[key] } })}
          />
        ))}
      </div>

      {/* typography (line height / paragraph spacing) */}
      <div className="field-group">
        <div className="legend">{t("settings.typography.legend")}</div>
        <div className="inline">
          <NumberField
            label={t("settings.typography.lineHeight")}
            value={theme.line_height ?? 1.45}
            min={1}
            max={3}
            step={0.05}
            onChange={(v) => onChangeTheme({ line_height: Math.round(v * 100) / 100 })}
          />
          <NumberField
            label={t("settings.typography.paragraphSpacing")}
            value={theme.paragraph_spacing_mm ?? 2}
            min={0}
            max={10}
            step={0.5}
            onChange={(v) => onChangeTheme({ paragraph_spacing_mm: v })}
          />
        </div>
        <div className="hint">
          {t("settings.typography.hint")}
        </div>
      </div>

      {/* theme presets (着せ替え) */}
      <div className="field-group">
        <div className="legend">{t("settings.presets.legend")}</div>
        <div className="hint" style={{ marginBottom: 6 }}>
          {t("settings.presets.hint")}
        </div>
        {THEME_PRESETS.map((p) => (
          <div className="row" key={p.id} style={{ marginBottom: 4, alignItems: "center" }}>
            <span style={{ display: "inline-flex", gap: 2 }}>
              {(["accent", "heading", "warning", "background"] as const).map((k) => (
                <span
                  key={k}
                  title={k}
                  style={{
                    width: 14,
                    height: 14,
                    background: p.colors[k],
                    border: "1px solid var(--border)",
                    borderRadius: 2,
                  }}
                />
              ))}
            </span>
            <span style={{ flex: 1 }}>
              {t(`preset.${p.id}`)}
              {theme.name === p.id ? t("settings.presets.active") : ""}
            </span>
            <button
              onClick={() =>
                onChangeTheme({
                  name: p.id,
                  colors: { ...p.colors },
                  ...(applyFonts && p.font_family
                    ? { font_family: { ...p.font_family } }
                    : {}),
                })
              }
            >
              {t("settings.presets.apply")}
            </button>
          </div>
        ))}
        <label className="check">
          <input
            type="checkbox"
            checked={applyFonts}
            onChange={(e) => setApplyFonts(e.target.checked)}
          />
          {t("settings.presets.applyFonts")}
        </label>
      </div>

      {/* background image */}
      <div className="field-group">
        <div className="legend">{t("settings.bg.legend")}</div>
        {bg?.image ? (
          <>
            <div className="row" style={{ marginBottom: 4 }}>
              <span
                style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={bg.image}
              >
                {bg.image.replace(/\\/g, "/").split("/").pop()}
              </span>
              <button
                onClick={() => onChangeTheme({ background: undefined })}
                style={{ color: "var(--err)" }}
              >
                {t("settings.bg.delete")}
              </button>
            </div>
            <div className="inline">
              <div className="field">
                <label>{t("settings.bg.fit")}</label>
                <select
                  value={bg.fit ?? "cover"}
                  onChange={(e) => setBg({ fit: e.target.value as any })}
                >
                  <option value="cover">{t("settings.bg.fit.cover")}</option>
                  <option value="contain">{t("settings.bg.fit.contain")}</option>
                  <option value="tile">{t("settings.bg.fit.tile")}</option>
                </select>
              </div>
              <NumberField
                label={t("settings.bg.opacity")}
                value={Math.round((bg.opacity ?? 1) * 100)}
                min={0}
                max={100}
                step={5}
                onChange={(v) => setBg({ opacity: Math.min(100, Math.max(0, v)) / 100 })}
              />
            </div>
            <div className="hint">
              {t("settings.bg.opacityHint")}
            </div>
          </>
        ) : (
          <div className="hint" style={{ marginBottom: 4 }}>
            {t("settings.bg.emptyHint")}
          </div>
        )}
        {onAddImageFile ? (
          <button
            onClick={async () => {
              const name = await onAddImageFile();
              if (name) setBg({ image: name, fit: bg?.fit ?? "cover", opacity: bg?.opacity ?? 0.2 });
            }}
          >
            {t("settings.bg.add")}
          </button>
        ) : null}
      </div>

      {/* optimal reading distance index */}
      <div className="field-group">
        <div className="legend">{t("settings.dist.legend")}</div>
        <div className="hint" style={{ marginBottom: 6 }}>
          {t("settings.dist.hint")}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ color: "var(--muted)", textAlign: "left" }}>
              <th style={{ fontWeight: 400, padding: "2px 4px" }}>{t("settings.dist.element")}</th>
              <th style={{ fontWeight: 400, padding: "2px 4px", textAlign: "right" }}>pt</th>
              <th style={{ fontWeight: 400, padding: "2px 4px", textAlign: "right" }}>{t("settings.dist.comfortable")}</th>
              <th style={{ fontWeight: 400, padding: "2px 4px", textAlign: "right" }}>{t("settings.dist.legible")}</th>
            </tr>
          </thead>
          <tbody>
            {readingDistanceIndex(project.doc).map((e) => {
              const short = e.key === "body" && e.comfortableM < targetDistM;
              return (
                <tr key={e.key} style={short ? { color: "var(--err)" } : undefined}>
                  <td style={{ padding: "2px 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }} title={e.label}>
                    {e.label}
                  </td>
                  <td style={{ padding: "2px 4px", textAlign: "right" }}>{Math.round(e.pt * 10) / 10}</td>
                  <td style={{ padding: "2px 4px", textAlign: "right" }}>{e.comfortableM.toFixed(1)} m</td>
                  <td style={{ padding: "2px 4px", textAlign: "right" }}>{e.legibleM.toFixed(1)} m</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="inline" style={{ marginTop: 6 }}>
          <NumberField
            label={t("settings.dist.target")}
            value={targetDistM}
            min={0.5}
            max={10}
            step={0.5}
            onChange={(v) => setTargetDistM(Math.max(0.1, v))}
          />
          <div className="field">
            <label>{t("settings.dist.required")}</label>
            <div style={{ padding: "4px 2px" }}>
              {t("settings.dist.requiredValue", { pt: Math.ceil(requiredPtForDistance(targetDistM)) })}
            </div>
          </div>
        </div>
        <div className="hint">
          {t("settings.dist.targetHint")}
        </div>
      </div>

      {/* citations (BibTeX) */}
      <div className="field-group">
        <div className="legend">{t("settings.cite.legend")}</div>
        {project.bib == null ? (
          <div className="hint" style={{ marginBottom: 6 }}>
            {t("settings.cite.missing", { file: refs.bib ?? "references.bib" })}
          </div>
        ) : (
          <div className="hint" style={{ marginBottom: 6 }}>
            {t("settings.cite.loaded", { file: refs.bib ?? "references.bib", n: project.bib.length })}
          </div>
        )}
        <div className="inline">
          <div className="field">
            <label>{t("settings.cite.style")}</label>
            <select
              value={refs.style ?? "apa7"}
              onChange={(e) => onChangeReferences({ style: e.target.value })}
            >
              <option value="apa7">{t("settings.cite.style.apa7")}</option>
              <option value="jpa">{t("settings.cite.style.jpa")}</option>
              <option value="ieee">{t("settings.cite.style.ieee")}</option>
              {Object.keys(project.citationStyles ?? {}).map((name) => (
                <option key={name} value={name}>
                  {t("settings.cite.style.custom", { name })}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={refs.include_doi ?? citeStyle.include_doi ?? true}
            onChange={(e) => onChangeReferences({ include_doi: e.target.checked })}
          />
          {t("settings.cite.includeDoi")}
        </label>
        <div className="hint">
          {t("settings.cite.stylesHint")}
        </div>
        {citePrep.active && citePrep.warnings.length > 0 && (
          <div
            className="hint"
            style={{ color: "var(--err)", marginTop: 6, whiteSpace: "pre-line" }}
          >
            {citePrep.warnings
              .slice(0, 8)
              .map((w) => `WARN: ${w.message}`)
              .join("\n")}
            {citePrep.warnings.length > 8
              ? t("settings.cite.moreWarnings", { n: citePrep.warnings.length - 8 })
              : ""}
          </div>
        )}
        {citePrep.active && (
          <div className="hint" style={{ marginTop: 4 }}>
            {t("settings.cite.citedCount", { n: citePrep.referenceItems.length })}
          </div>
        )}
      </div>

      {/* format package (export / import / distribute) */}
      <div className="field-group">
        <div className="legend">{t("settings.fmt.legend")}</div>
        <div className="hint" style={{ marginBottom: 6 }}>
          {t("settings.fmt.hint")}
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button onClick={onExportFormat}>{t("settings.fmt.export")}</button>
          <button
            onClick={async () => {
              const pkg = await onPickFormatFile();
              if (pkg) {
                setPendingFormat(pkg);
                setFmtSections({
                  theme: !!pkg.theme,
                  layout: !!pkg.layout,
                  header: !!pkg.header,
                  structure: false,
                });
              }
            }}
          >
            {t("settings.fmt.import")}
          </button>
        </div>
        {pendingFormat && (
          <div
            style={{
              marginTop: 8,
              padding: 8,
              border: "1px solid var(--border)",
              borderRadius: 4,
            }}
          >
            <div style={{ marginBottom: 6 }}>
              {t("settings.fmt.loadedLabel")} <b>{pendingFormat.name ?? t("settings.fmt.unnamed")}</b>
              {pendingFormat.assets?.length
                ? t("settings.fmt.assetCount", { n: pendingFormat.assets.length })
                : ""}
              {t("settings.fmt.selectScope")}
            </div>
            {(
              [
                ["theme", t("settings.fmt.section.theme")],
                ["layout", t("settings.fmt.section.layout")],
                ["header", t("settings.fmt.section.header")],
                ["structure", t("settings.fmt.section.structure")],
              ] as const
            ).map(([key, label]) => (
              <label className="check" key={key}>
                <input
                  type="checkbox"
                  disabled={!pendingFormat[key]}
                  checked={fmtSections[key] && !!pendingFormat[key]}
                  onChange={(e) =>
                    setFmtSections({ ...fmtSections, [key]: e.target.checked })
                  }
                />
                {label}
                {!pendingFormat[key] ? t("settings.fmt.notIncluded") : ""}
              </label>
            ))}
            {fmtSections.structure && !!pendingFormat.structure && (
              <div className="hint" style={{ color: "var(--err)" }}>
                {t("settings.fmt.structureWarning")}
              </div>
            )}
            <div className="row" style={{ gap: 6, marginTop: 6 }}>
              <button
                disabled={
                  !(["theme", "layout", "header", "structure"] as const).some(
                    (k) => fmtSections[k] && !!pendingFormat[k],
                  )
                }
                onClick={() => {
                  onApplyFormat(pendingFormat, fmtSections);
                  setPendingFormat(null);
                }}
              >
                {t("settings.fmt.apply")}
              </button>
              <button onClick={() => setPendingFormat(null)}>{t("settings.fmt.cancel")}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
