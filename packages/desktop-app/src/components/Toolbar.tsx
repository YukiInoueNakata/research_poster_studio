import { ZOOM_LEVELS } from "@rps/core";
import type { RecentProject } from "../lib/recent";
import { useLang } from "../i18n";

export type ExportKind = "pdf" | "png" | "html" | "svg" | "pptx" | "marp";

interface Props {
  loaded: boolean;
  dirty: boolean;
  zoom: number;
  showBoundaries: boolean;
  showFontBadges: boolean;
  busy: boolean;
  uiScale: number;
  proofreadOpen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  recent: RecentProject[];
  onNew: () => void;
  onOpen: () => void;
  onOpenSample: () => void;
  onOpenRecent: (r: RecentProject) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoom: (z: number) => void;
  onToggleBoundaries: () => void;
  onToggleFontBadges: () => void;
  onUiScale: (s: number) => void;
  onOpenSettings: () => void;
  onToggleProofread: () => void;
  onExport: (kind: ExportKind) => void;
}

export default function Toolbar({
  loaded,
  dirty,
  zoom,
  showBoundaries,
  showFontBadges,
  busy,
  uiScale,
  proofreadOpen,
  canUndo,
  canRedo,
  recent,
  onNew,
  onOpen,
  onOpenSample,
  onOpenRecent,
  onSave,
  onSaveAs,
  onUndo,
  onRedo,
  onZoom,
  onToggleBoundaries,
  onToggleFontBadges,
  onUiScale,
  onOpenSettings,
  onToggleProofread,
  onExport,
}: Props) {
  const { t, lang, setLang } = useLang();
  return (
    <div className="toolbar">
      <span className="title">Research Poster Studio</span>
      <button onClick={onNew} title={t("toolbar.new.title")}>
        {t("toolbar.new")}
      </button>
      <button onClick={onOpen}>{t("toolbar.open")}</button>
      {recent.length > 0 ? (
        <select
          value=""
          title={t("toolbar.recent.title")}
          style={{ maxWidth: 150 }}
          onChange={(e) => {
            const i = Number(e.target.value);
            if (Number.isInteger(i) && recent[i]) onOpenRecent(recent[i]);
          }}
        >
          <option value="" disabled>
            {t("toolbar.recent")}
          </option>
          {recent.map((r, i) => (
            <option key={`${r.dir}/${r.posterFile}`} value={i} title={`${r.dir}\\${r.posterFile}`}>
              {r.title || r.dir.split(/[\\/]/).pop() || r.dir}
            </option>
          ))}
        </select>
      ) : null}
      <button onClick={onOpenSample}>{t("toolbar.sample")}</button>
      <button onClick={onSave} disabled={!loaded || !dirty}>
        {t("toolbar.save")}{dirty ? " *" : ""}
      </button>
      <button onClick={onSaveAs} disabled={!loaded}>{t("toolbar.saveAs")}</button>
      <button onClick={onUndo} disabled={!loaded || !canUndo} title={t("toolbar.undo.title")}>
        {t("toolbar.undo")}
      </button>
      <button onClick={onRedo} disabled={!loaded || !canRedo} title={t("toolbar.redo.title")}>
        {t("toolbar.redo")}
      </button>
      <button onClick={onOpenSettings} disabled={!loaded}>{t("toolbar.settings")}</button>
      <button
        className={proofreadOpen ? "primary" : ""}
        onClick={onToggleProofread}
        disabled={!loaded}
        title={t("toolbar.proofread.title")}
      >
        {proofreadOpen ? t("toolbar.proofread.on") : t("toolbar.proofread")}
      </button>

      <span className="spacer" />

      <button
        onClick={() => setLang(lang === "ja" ? "en" : "ja")}
        title={t("lang.switch")}
        className={lang === "en" ? "primary" : ""}
      >
        {lang === "ja" ? t("lang.en") : t("lang.ja")}
      </button>

      <label style={{ color: "var(--muted)" }}>{t("toolbar.display")}</label>
      <button onClick={() => onUiScale(uiScale - 0.1)} title={t("toolbar.uiDown")}>－</button>
      <span style={{ color: "var(--muted)", fontSize: 11, minWidth: 34, textAlign: "center" }}>
        {Math.round(uiScale * 100)}%
      </span>
      <button onClick={() => onUiScale(uiScale + 0.1)} title={t("toolbar.uiUp")}>＋</button>

      <label style={{ color: "var(--muted)", marginLeft: 8 }}>{t("toolbar.zoom")}</label>
      <select value={zoom} onChange={(e) => onZoom(Number(e.target.value))} disabled={!loaded}>
        {ZOOM_LEVELS.concat(ZOOM_LEVELS.includes(zoom) ? [] : [zoom]).map((z) => (
          <option key={z} value={z}>{Math.round(z * 100)}%</option>
        ))}
      </select>
      <label className="check" style={{ color: "var(--muted)" }}>
        <input type="checkbox" checked={showBoundaries} onChange={onToggleBoundaries} />
        {t("toolbar.boundaries")}
      </label>
      <label className="check" style={{ color: "var(--muted)" }}>
        <input type="checkbox" checked={showFontBadges} onChange={onToggleFontBadges} />
        {t("toolbar.ptBadge")}
      </label>

      <span className="spacer" />

      <button className="primary" onClick={() => onExport("pdf")} disabled={!loaded || busy}>
        PDF
      </button>
      <button onClick={() => onExport("png")} disabled={!loaded || busy}>PNG</button>
      <button onClick={() => onExport("html")} disabled={!loaded || busy}>HTML</button>
      <button onClick={() => onExport("svg")} disabled={!loaded || busy}>SVG</button>
      <button onClick={() => onExport("pptx")} disabled={!loaded || busy}>PPTX</button>
      <button onClick={() => onExport("marp")} disabled={!loaded || busy}>Marp</button>
    </div>
  );
}
