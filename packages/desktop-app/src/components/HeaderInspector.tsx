// Header (title block) inspector: conference info, title, subtitle, authors,
// and affiliations — each with its own font size + horizontal alignment.
// Authors can be added/removed; each author selects one or more affiliations,
// rendered as superscript numbers/symbols on the poster.

import type {
  Author,
  HAlign,
  HeaderConfig,
  LogoConfig,
  PosterProject,
  ProjectMeta,
  Theme,
} from "@rps/core";
import ColorField from "./ColorField";
import FontField from "./FontField";
import { NumberField, LengthField } from "./StepField";
import { useLang } from "../i18n";

interface Props {
  project: PosterProject;
  onChangeMeta: (patch: Partial<ProjectMeta>) => void;
  onChangeHeader: (patch: Partial<HeaderConfig>) => void;
  onChangeTheme: (patch: Partial<Theme>) => void;
  /** open a file dialog, copy the image into figures/, return its relative path */
  onAddLogoFile?: () => Promise<string | null>;
}

const ALIGNS: HAlign[] = ["left", "center", "right"];

/** font-size + horizontal-alignment row for one header element */
function ElementRow({
  label,
  placeholder,
  size,
  align,
  onSize,
  onAlign,
}: {
  label: string;
  placeholder: string;
  size: string | undefined;
  align: HAlign | undefined;
  onSize: (v: string | undefined) => void;
  onAlign: (v: HAlign) => void;
}) {
  const { t } = useLang();
  return (
    <div className="inline">
      <LengthField
        label={t("header.elementSize", { label })}
        placeholder={placeholder}
        value={size}
        defaultUnit="pt"
        onChange={onSize}
      />
      <div className="field">
        <label>{t("header.horizontalAlign")}</label>
        <select value={align ?? "center"} onChange={(e) => onAlign(e.target.value as HAlign)}>
          {ALIGNS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function HeaderInspector({
  project,
  onChangeMeta,
  onChangeHeader,
  onChangeTheme,
  onAddLogoFile,
}: Props) {
  const { t } = useLang();
  const { project: meta, theme, header = {} } = project.doc;
  const setFont = (key: "body" | "heading" | "title", v: string | undefined) =>
    onChangeTheme({ font_family: { ...theme.font_family, [key]: v ?? "Noto Sans JP" } });
  const authors = meta.authors ?? [];
  const affils = meta.affiliations ?? [];

  const setAuthors = (next: Author[]) => onChangeMeta({ authors: next });
  const setAffils = (next: string[]) => onChangeMeta({ affiliations: next });

  const addAuthor = () => setAuthors([...authors, { name: t("header.newAuthor"), affiliations: [] }]);
  const removeAuthor = (i: number) => setAuthors(authors.filter((_, k) => k !== i));
  const moveAuthor = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= authors.length) return;
    const next = authors.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setAuthors(next);
  };
  const setAuthorName = (i: number, name: string) =>
    setAuthors(authors.map((a, k) => (k === i ? { ...a, name } : a)));
  const toggleAuthorAffil = (i: number, aff: number) =>
    setAuthors(
      authors.map((a, k) => {
        if (k !== i) return a;
        const cur = new Set(a.affiliations ?? []);
        cur.has(aff) ? cur.delete(aff) : cur.add(aff);
        return { ...a, affiliations: Array.from(cur).sort((x, y) => x - y) };
      }),
    );

  const breaks: number[] = meta.affiliation_line_breaks ?? [];
  const toggleBreak = (i: number) =>
    onChangeMeta({
      affiliation_line_breaks: (breaks.includes(i)
        ? breaks.filter((x) => x !== i)
        : [...breaks, i]
      ).sort((a, b) => a - b),
    });

  const logos = header.logos ?? [];
  const setLogos = (next: LogoConfig[]) => onChangeHeader({ logos: next });
  const patchLogo = (i: number, patch: Partial<LogoConfig>) =>
    setLogos(logos.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const addLogo = async () => {
    if (!onAddLogoFile) return;
    const path = await onAddLogoFile();
    if (!path) return;
    setLogos([...logos, { path, area: "header", position: "left", height_mm: 20 }]);
  };

  const addAffil = () => setAffils([...affils, t("header.newAffiliation")]);
  const setAffilText = (i: number, text: string) =>
    setAffils(affils.map((s, k) => (k === i ? text : s)));
  const removeAffil = (r: number) => {
    // drop r and shift higher indices down by 1 across affiliations,
    // author references, and line-break markers — in one update.
    const shift = (i: number) => (i > r ? i - 1 : i);
    onChangeMeta({
      affiliations: affils.filter((_, k) => k !== r),
      authors: authors.map((a) => ({
        ...a,
        affiliations: (a.affiliations ?? []).filter((i) => i !== r).map(shift),
      })),
      affiliation_line_breaks: breaks.filter((i) => i !== r).map(shift),
    });
  };

  return (
    <div className="inspector">
      <div className="pane-header" style={{ margin: "-10px -12px 10px" }}>
        {t("header.paneTitle")}
      </div>

      <div className="field-group">
        <div className="legend">{t("header.fontLegend")}</div>
        <FontField
          label={t("header.bodyFont")}
          value={theme.font_family.body}
          onChange={(v) => setFont("body", v)}
        />
        <FontField
          label={t("header.headingFont")}
          value={theme.font_family.heading}
          onChange={(v) => setFont("heading", v)}
        />
        <FontField
          label={t("header.titleFont")}
          value={theme.font_family.title}
          onChange={(v) => setFont("title", v)}
        />
        <div className="hint">{t("header.fontHint")}</div>
      </div>

      {/* conference / presentation info */}
      <div className="field-group">
        <div className="legend">{t("header.conferenceLegend")}</div>
        <div className="field">
          <label>{t("header.conferenceName")}</label>
          <input
            type="text"
            value={meta.conference?.name ?? ""}
            onChange={(e) =>
              onChangeMeta({ conference: { ...meta.conference, name: e.target.value } })
            }
          />
        </div>
        <div className="field">
          <label>{t("header.date")}</label>
          <input
            type="text"
            placeholder="2026-09-12"
            value={meta.conference?.date ?? ""}
            onChange={(e) =>
              onChangeMeta({ conference: { ...meta.conference, date: e.target.value } })
            }
          />
        </div>
        <ElementRow
          label={t("header.conferenceInfo")}
          placeholder={theme.font_size.caption}
          size={header.conference_font_size}
          align={header.conference_align}
          onSize={(v) => onChangeHeader({ conference_font_size: v })}
          onAlign={(v) => onChangeHeader({ conference_align: v })}
        />
      </div>

      {/* title */}
      <div className="field-group">
        <div className="legend">{t("header.titleLegend")}</div>
        <div className="field">
          <textarea
            value={meta.title}
            onChange={(e) => onChangeMeta({ title: e.target.value })}
            style={{ width: "100%", minHeight: 48 }}
          />
        </div>
        <ElementRow
          label={t("header.titleLegend")}
          placeholder={theme.font_size.title}
          size={header.title_font_size}
          align={header.title_align}
          onSize={(v) => onChangeHeader({ title_font_size: v })}
          onAlign={(v) => onChangeHeader({ title_align: v })}
        />
        <ColorField
          label={t("header.titleColor")}
          value={header.title_color}
          onChange={(v) => onChangeHeader({ title_color: v })}
        />
      </div>

      {/* subtitle */}
      <div className="field-group">
        <div className="legend">{t("header.subtitleLegend")}</div>
        <div className="field">
          <textarea
            value={meta.subtitle ?? ""}
            onChange={(e) => onChangeMeta({ subtitle: e.target.value || undefined })}
            rows={Math.max(1, (meta.subtitle ?? "").split("\n").length)}
            style={{ width: "100%", resize: "vertical" }}
          />
        </div>
        <ElementRow
          label={t("header.subtitleLegend")}
          placeholder={theme.font_size.subtitle}
          size={header.subtitle_font_size}
          align={header.subtitle_align}
          onSize={(v) => onChangeHeader({ subtitle_font_size: v })}
          onAlign={(v) => onChangeHeader({ subtitle_align: v })}
        />
        <ColorField
          label={t("header.accentColor")}
          value={header.accent_color}
          onChange={(v) => onChangeHeader({ accent_color: v })}
        />
      </div>

      {/* authors */}
      <div className="field-group">
        <div className="legend">{t("header.authorsLegend")}</div>
        {authors.map((a, i) => (
          <div
            key={i}
            style={{ border: "1px solid var(--border)", borderRadius: 5, padding: 6, marginBottom: 6 }}
          >
            <div className="row" style={{ marginBottom: 4 }}>
              <input
                type="text"
                value={a.name}
                placeholder={t("header.authorNamePlaceholder")}
                onChange={(e) => setAuthorName(i, e.target.value)}
                style={{ flex: 1 }}
              />
              <button onClick={() => moveAuthor(i, -1)} disabled={i === 0} title={t("header.moveUp")}>▲</button>
              <button
                onClick={() => moveAuthor(i, 1)}
                disabled={i === authors.length - 1}
                title={t("header.moveDown")}
              >
                ▼
              </button>
              <button onClick={() => removeAuthor(i)} title={t("header.removeAuthor")}>{t("header.remove")}</button>
            </div>
            {affils.length > 0 && (
              <div>
                <div className="hint" style={{ marginBottom: 2 }}>{t("header.affiliationMultiSelect")}</div>
                {affils.map((s, ai) => (
                  <label
                    key={ai}
                    className="check"
                    style={{ display: "flex", marginBottom: 2 }}
                  >
                    <input
                      type="checkbox"
                      checked={(a.affiliations ?? []).includes(ai)}
                      onChange={() => toggleAuthorAffil(i, ai)}
                    />
                    <span style={{ fontSize: 11 }}>
                      {ai + 1}. {s || t("header.notEntered")}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
        <button onClick={addAuthor}>{t("header.addAuthor")}</button>
        {(() => {
          const sep = header.author_separator ?? "，";
          const isPreset = sep === "，" || sep === "・";
          return (
            <div className="field" style={{ marginTop: 6 }}>
              <label>{t("header.authorSeparator")}</label>
              <div className="row">
                <select
                  value={isPreset ? sep : "custom"}
                  onChange={(e) => {
                    const v = e.target.value;
                    onChangeHeader({
                      author_separator: v === "custom" ? (isPreset ? "／" : sep) : v,
                    });
                  }}
                >
                  <option value="，">{t("header.separatorComma")}</option>
                  <option value="・">{t("header.separatorMiddleDot")}</option>
                  <option value="custom">{t("header.separatorCustom")}</option>
                </select>
                {!isPreset && (
                  <input
                    type="text"
                    value={sep}
                    style={{ width: 60 }}
                    onChange={(e) => onChangeHeader({ author_separator: e.target.value })}
                  />
                )}
              </div>
            </div>
          );
        })()}
        <div style={{ marginTop: 8 }}>
          <ElementRow
            label={t("header.authorsLegend")}
            placeholder={theme.font_size.heading2}
            size={header.authors_font_size}
            align={header.authors_align}
            onSize={(v) => onChangeHeader({ authors_font_size: v })}
            onAlign={(v) => onChangeHeader({ authors_align: v })}
          />
        </div>
      </div>

      {/* affiliations */}
      <div className="field-group">
        <div className="legend">{t("header.affiliationsLegend")}</div>
        {affils.map((s, i) => (
          <div key={i} style={{ marginBottom: 4 }}>
            <div className="row">
              <span style={{ width: 16, color: "var(--muted)" }}>{i + 1}</span>
              <input
                type="text"
                value={s}
                onChange={(e) => setAffilText(i, e.target.value)}
                style={{ flex: 1 }}
              />
              <button onClick={() => removeAffil(i)} title={t("header.removeAffiliation")}>{t("header.remove")}</button>
            </div>
            {i < affils.length - 1 && (
              <label className="check" style={{ fontSize: 11, marginLeft: 20 }}>
                <input
                  type="checkbox"
                  checked={breaks.includes(i)}
                  onChange={() => toggleBreak(i)}
                />
                {t("header.lineBreakAfter")}
              </label>
            )}
          </div>
        ))}
        <button onClick={addAffil}>{t("header.addAffiliation")}</button>
        <div className="hint" style={{ marginTop: 4 }}>
          {t("header.affiliationsHint")}
        </div>
        <div style={{ marginTop: 6 }}>
          <label className="check" style={{ marginBottom: 6 }}>
            <input
              type="checkbox"
              checked={!!header.affiliation_inline}
              onChange={(e) => onChangeHeader({ affiliation_inline: e.target.checked })}
            />
            {t("header.affiliationInline")}
          </label>
          <div className="field">
            <label>{t("header.affiliationMarker")}</label>
            <select
              value={header.affiliation_marker ?? "number"}
              onChange={(e) =>
                onChangeHeader({ affiliation_marker: e.target.value as "number" | "symbol" })
              }
            >
              <option value="number">{t("header.markerNumber")}</option>
              <option value="symbol">{t("header.markerSymbol")}</option>
            </select>
          </div>
          <ElementRow
            label={t("header.affiliationsLegend")}
            placeholder={theme.font_size.caption}
            size={header.affil_font_size}
            align={header.affil_align}
            onSize={(v) => onChangeHeader({ affil_font_size: v })}
            onAlign={(v) => onChangeHeader({ affil_align: v })}
          />
          <label className="check">
            <input
              type="checkbox"
              checked={header.show_affiliation !== false}
              onChange={(e) => onChangeHeader({ show_affiliation: e.target.checked })}
            />
            {t("header.showAffiliation")}
          </label>
        </div>
      </div>

      {/* keywords */}
      <div className="field-group">
        <div className="legend">{t("header.keywordsLegend")}</div>
        <label className="check" style={{ marginBottom: 6 }}>
          <input
            type="checkbox"
            checked={header.show_keywords !== false}
            onChange={(e) => onChangeHeader({ show_keywords: e.target.checked })}
          />
          {t("header.showKeywords")}
        </label>
        <div className="field">
          <label>{t("header.keywordsCommaSeparated")}</label>
          <input
            type="text"
            placeholder={t("header.keywordsPlaceholder")}
            value={(meta.keywords ?? []).join("，")}
            onChange={(e) =>
              onChangeMeta({
                keywords: e.target.value
                  .split(/[,，、;；]/)
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
        <div className="field">
          <label>{t("header.keywordsLabel")}</label>
          <input
            type="text"
            placeholder="Keywords: "
            value={header.keywords_label ?? ""}
            onChange={(e) => onChangeHeader({ keywords_label: e.target.value || undefined })}
          />
        </div>
        <ElementRow
          label={t("header.keywordsLegend")}
          placeholder={theme.font_size.caption}
          size={header.keywords_font_size}
          align={header.keywords_align}
          onSize={(v) => onChangeHeader({ keywords_font_size: v })}
          onAlign={(v) => onChangeHeader({ keywords_align: v })}
        />
      </div>

      {/* institution logos */}
      <div className="field-group">
        <div className="legend">{t("header.logosLegend")}</div>
        {logos.map((l, i) => {
          const base = l.path.replace(/\\/g, "/").split("/").pop() ?? l.path;
          return (
            <div
              key={i}
              style={{ border: "1px solid var(--border)", borderRadius: 5, padding: 6, marginBottom: 6 }}
            >
              <div className="row" style={{ marginBottom: 4 }}>
                <span
                  title={l.path}
                  style={{
                    flex: 1,
                    fontSize: 11,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {base}
                </span>
                <button
                  onClick={() => setLogos(logos.filter((_, k) => k !== i))}
                  title={t("header.removeLogo")}
                >
                  {t("header.remove")}
                </button>
              </div>
              <div className="inline">
                <div className="field">
                  <label>{t("header.logoArea")}</label>
                  <select
                    value={l.area ?? "header"}
                    onChange={(e) => patchLogo(i, { area: e.target.value as "header" | "footer" })}
                  >
                    <option value="header">{t("header.areaHeader")}</option>
                    <option value="footer">{t("header.areaFooter")}</option>
                  </select>
                </div>
                <div className="field">
                  <label>{t("header.logoPosition")}</label>
                  <select
                    value={l.position ?? "left"}
                    onChange={(e) =>
                      patchLogo(i, { position: e.target.value as "left" | "center" | "right" })
                    }
                  >
                    <option value="left">{t("header.positionLeft")}</option>
                    <option value="center">{t("header.positionCenter")}</option>
                    <option value="right">{t("header.positionRight")}</option>
                  </select>
                </div>
              </div>
              <NumberField
                label={t("header.logoHeight")}
                value={l.height_mm ?? 20}
                min={1}
                step={1}
                onChange={(v) => patchLogo(i, { height_mm: v })}
              />
            </div>
          );
        })}
        <button onClick={addLogo} disabled={!onAddLogoFile}>{t("header.addLogo")}</button>
        <div className="hint" style={{ marginTop: 4 }}>
          {t("header.logosHint")}
        </div>
      </div>

      {/* footer band (N17) */}
      <div className="field-group">
        <div className="legend">{t("header.footerLegend")}</div>
        <div className="field">
          <label>{t("header.footerLeft")}</label>
          <input
            type="text"
            value={header.footer_left ?? ""}
            onChange={(e) => onChangeHeader({ footer_left: e.target.value || undefined })}
          />
        </div>
        <div className="field">
          <label>{t("header.footerCenter")}</label>
          <input
            type="text"
            value={header.footer_center ?? ""}
            onChange={(e) => onChangeHeader({ footer_center: e.target.value || undefined })}
          />
        </div>
        <div className="field">
          <label>{t("header.footerRight")}</label>
          <input
            type="text"
            value={header.footer_right ?? ""}
            onChange={(e) => onChangeHeader({ footer_right: e.target.value || undefined })}
          />
        </div>
        <div className="inline">
          <ColorField
            label={t("header.footerBackground")}
            value={header.footer_background}
            onChange={(v) => onChangeHeader({ footer_background: v })}
          />
          <ColorField
            label={t("header.footerTextColor")}
            value={header.footer_text_color}
            onChange={(v) => onChangeHeader({ footer_text_color: v })}
          />
        </div>
        <div className="field">
          <label>{t("header.footerFontSize")}</label>
          <input
            type="text"
            placeholder={theme.font_size.caption}
            value={header.footer_font_size ?? ""}
            onChange={(e) => onChangeHeader({ footer_font_size: e.target.value || undefined })}
          />
        </div>
        <div className="hint" style={{ marginTop: 4 }}>{t("header.footerHint")}</div>
      </div>

      {/* box */}
      <div className="field-group">
        <div className="legend">{t("header.boxLegend")}</div>
        <ColorField
          label={t("header.backgroundColor")}
          value={header.background}
          onChange={(v) => onChangeHeader({ background: v })}
        />
        <label className="check" style={{ marginBottom: 6 }}>
          <input
            type="checkbox"
            checked={!!header.border}
            onChange={(e) => onChangeHeader({ border: e.target.checked })}
          />
          {t("header.showBorder")}
        </label>
        {header.border && (
          <div className="inline">
            <ColorField
              label={t("header.borderColor")}
              value={header.border_color}
              onChange={(v) => onChangeHeader({ border_color: v })}
            />
            <div className="field">
              <label>{t("header.borderWidth")}</label>
              <input
                type="text"
                placeholder="1pt"
                value={header.border_width ?? ""}
                onChange={(e) => onChangeHeader({ border_width: e.target.value || undefined })}
              />
            </div>
          </div>
        )}
        <NumberField
          label={t("header.padding")}
          value={header.padding_mm ?? 0}
          min={0}
          step={1}
          onChange={(v) => onChangeHeader({ padding_mm: v })}
        />
      </div>
    </div>
  );
}
