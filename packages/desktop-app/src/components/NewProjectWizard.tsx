// New-project setup wizard (5 steps): destination -> basic info ->
// paper & columns -> structure -> theme preset.

import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { Orientation, PaperSize } from "@rps/core";
import { MAX_COLUMNS, THEME_PRESETS } from "@rps/core";
import {
  DIR_EXISTS,
  WIZARD_STRUCTURES,
  isValidFolderName,
  type NewProjectInput,
  type StructureId,
  type WizardAuthor,
  type WizardLang,
} from "../lib/newProject";
import { useLang } from "../i18n";

const PAPER_CHOICES: { value: PaperSize; labelKey: string }[] = [
  { value: "A0", labelKey: "wizard.paperA0" },
  { value: "A1", labelKey: "wizard.paperA1" },
  { value: "A2", labelKey: "wizard.paperA2" },
  { value: "36x48in", labelKey: "wizard.paper36x48" },
  { value: "42x56in", labelKey: "wizard.paper42x56" },
  { value: "48x96in", labelKey: "wizard.paper48x96" },
  { value: "custom", labelKey: "wizard.paperCustom" },
];

const STEP_TITLE_KEYS = [
  "wizard.stepDestination",
  "wizard.stepBasic",
  "wizard.stepPaper",
  "wizard.stepStructure",
  "wizard.stepTheme",
];

interface Props {
  onCancel: () => void;
  /** creates the project; rejects with a message shown inside the wizard */
  onCreate: (input: NewProjectInput) => Promise<void>;
}

export default function NewProjectWizard({ onCancel, onCreate }: Props) {
  const { t } = useLang();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // target folder already exists -> ask the user before writing into it
  const [existDir, setExistDir] = useState<string | null>(null);

  // step 1: destination
  const [parentDir, setParentDir] = useState("");
  const [folderName, setFolderName] = useState("");
  // step 2: basic info
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [authors, setAuthors] = useState<WizardAuthor[]>([{ name: "", affiliation: "" }]);
  const [conferenceName, setConferenceName] = useState("");
  const [conferenceDate, setConferenceDate] = useState("");
  // step 3: paper & columns
  const [posterSize, setPosterSize] = useState<PaperSize>("A0");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [customW, setCustomW] = useState(841);
  const [customH, setCustomH] = useState(1189);
  const [columns, setColumns] = useState(0); // 0 = 構成の既定
  // step 4: structure + language
  const [structureId, setStructureId] = useState<StructureId>("single");
  const [language, setLanguage] = useState<WizardLang>("ja");
  // step 5: theme
  const [themePresetId, setThemePresetId] = useState<string>(""); // "" = 既定

  async function pickParentDir() {
    const sel = await open({
      title: t("wizard.pickParentTitle"),
      directory: true,
      multiple: false,
    });
    if (typeof sel === "string") setParentDir(sel);
  }

  function stepValid(): boolean {
    if (step === 0) return !!parentDir && isValidFolderName(folderName);
    if (step === 1) return title.trim().length > 0;
    if (step === 2) {
      return posterSize !== "custom" || (customW > 0 && customH > 0);
    }
    return true;
  }

  function buildInput(allowExisting: boolean): NewProjectInput {
    return {
      parentDir,
      folderName: folderName.trim(),
      title,
      subtitle,
      authors,
      conferenceName,
      conferenceDate,
      posterSize,
      orientation,
      customSize:
        posterSize === "custom" ? { width_mm: customW, height_mm: customH } : undefined,
      columns,
      structureId,
      language,
      themePresetId: themePresetId || undefined,
      allowExisting,
    };
  }

  async function runCreate(allowExisting: boolean) {
    setBusy(true);
    setError(null);
    setExistDir(null);
    try {
      await onCreate(buildInput(allowExisting));
    } catch (e: any) {
      if (e?.code === DIR_EXISTS && !allowExisting) {
        setExistDir(String(e?.dir ?? ""));
      } else {
        setError(String(e?.message ?? e));
      }
      setBusy(false);
    }
  }

  function setAuthor(i: number, patch: Partial<WizardAuthor>) {
    setAuthors((list) => list.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  }

  return (
    <div className="modal-overlay">
      <div className="modal wizard">
        <div className="modal-titlebar">
          <span>
            {t("wizard.stepHeader", {
              step: step + 1,
              total: STEP_TITLE_KEYS.length,
              title: t(STEP_TITLE_KEYS[step]),
            })}
          </span>
          <button onClick={onCancel} disabled={busy}>{t("wizard.cancel")}</button>
        </div>

        <div className="modal-body">
          {step === 0 ? (
            <>
              <div className="wizard-row">
                <label>{t("wizard.parentFolder")}</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    value={parentDir}
                    onChange={(e) => setParentDir(e.target.value)}
                    placeholder={t("wizard.parentPlaceholder")}
                    style={{ flex: 1 }}
                  />
                  <button onClick={pickParentDir}>{t("wizard.choose")}</button>
                </div>
              </div>
              <div className="wizard-row">
                <label>{t("wizard.projectName")}</label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder={t("wizard.projectNamePlaceholder")}
                />
                {folderName && !isValidFolderName(folderName) ? (
                  <div className="wizard-error">
                    {t("wizard.invalidFolderName")}
                  </div>
                ) : null}
              </div>
              {parentDir && isValidFolderName(folderName) ? (
                <div className="wizard-hint">
                  {t("wizard.createdAt")}: {parentDir}
                  {"\\"}
                  {folderName.trim()}
                </div>
              ) : null}
            </>
          ) : null}

          {step === 1 ? (
            <>
              <div className="wizard-row">
                <label>{t("wizard.title")}</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="wizard-row">
                <label>{t("wizard.subtitle")}</label>
                <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
              </div>
              <div className="wizard-row">
                <label>{t("wizard.authors")}</label>
                {authors.map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                    <input
                      type="text"
                      value={a.name}
                      placeholder={t("wizard.authorName")}
                      onChange={(e) => setAuthor(i, { name: e.target.value })}
                      style={{ flex: 1 }}
                    />
                    <input
                      type="text"
                      value={a.affiliation}
                      placeholder={t("wizard.authorAffiliation")}
                      onChange={(e) => setAuthor(i, { affiliation: e.target.value })}
                      style={{ flex: 1.4 }}
                    />
                    <button
                      onClick={() => setAuthors((l) => l.filter((_, j) => j !== i))}
                      disabled={authors.length <= 1}
                      title={t("wizard.removeAuthor")}
                    >
                      {t("wizard.remove")}
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setAuthors((l) => [...l, { name: "", affiliation: "" }])}
                  style={{ alignSelf: "flex-start" }}
                >
                  {t("wizard.addAuthor")}
                </button>
              </div>
              <div className="wizard-row">
                <label>{t("wizard.conference")}</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    value={conferenceName}
                    placeholder={t("wizard.conferenceNamePlaceholder")}
                    onChange={(e) => setConferenceName(e.target.value)}
                    style={{ flex: 1.6 }}
                  />
                  <input
                    type="text"
                    value={conferenceDate}
                    placeholder={t("wizard.conferenceDatePlaceholder")}
                    onChange={(e) => setConferenceDate(e.target.value)}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className="wizard-row">
                <label>{t("wizard.paperSize")}</label>
                <select
                  value={posterSize}
                  onChange={(e) => setPosterSize(e.target.value as PaperSize)}
                >
                  {PAPER_CHOICES.map((p) => (
                    <option key={p.value} value={p.value}>{t(p.labelKey)}</option>
                  ))}
                </select>
              </div>
              {posterSize === "custom" ? (
                <div className="wizard-row">
                  <label>{t("wizard.customSize")}</label>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="number"
                      value={customW}
                      min={100}
                      onChange={(e) => setCustomW(Number(e.target.value))}
                      style={{ width: 90 }}
                    />
                    <span>×</span>
                    <input
                      type="number"
                      value={customH}
                      min={100}
                      onChange={(e) => setCustomH(Number(e.target.value))}
                      style={{ width: 90 }}
                    />
                    <span style={{ color: "var(--muted)" }}>{t("wizard.widthHeight")}</span>
                  </div>
                </div>
              ) : null}
              <div className="wizard-row">
                <label>{t("wizard.orientation")}</label>
                <div style={{ display: "flex", gap: 12 }}>
                  <label className="check">
                    <input
                      type="radio"
                      checked={orientation === "portrait"}
                      onChange={() => setOrientation("portrait")}
                    />
                    {t("wizard.portrait")}
                  </label>
                  <label className="check">
                    <input
                      type="radio"
                      checked={orientation === "landscape"}
                      onChange={() => setOrientation("landscape")}
                    />
                    {t("wizard.landscape")}
                  </label>
                </div>
              </div>
              <div className="wizard-row">
                <label>{t("wizard.columns")}</label>
                <select value={columns} onChange={(e) => setColumns(Number(e.target.value))}>
                  <option value={0}>{t("wizard.columnsDefault")}</option>
                  {Array.from({ length: MAX_COLUMNS }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{t("wizard.columnsN", { n })}</option>
                  ))}
                </select>
                <div className="wizard-hint">
                  {t("wizard.columnsHint")}
                </div>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div className="wizard-row">
                <label>{t("wizard.structure")}</label>
                {WIZARD_STRUCTURES.map((s) => (
                  <label
                    key={s.id}
                    className={`wizard-card${structureId === s.id ? " selected" : ""}`}
                  >
                    <input
                      type="radio"
                      checked={structureId === s.id}
                      onChange={() => setStructureId(s.id)}
                    />
                    <span>
                      <strong>{s.label}</strong>
                      <span className="wizard-card-desc">{s.description}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="wizard-row">
                <label>{t("wizard.headingLanguage")}</label>
                <div style={{ display: "flex", gap: 12 }}>
                  <label className="check">
                    <input
                      type="radio"
                      checked={language === "ja"}
                      onChange={() => setLanguage("ja")}
                    />
                    {t("wizard.langJa")}
                  </label>
                  <label className="check">
                    <input
                      type="radio"
                      checked={language === "en"}
                      onChange={() => setLanguage("en")}
                    />
                    {t("wizard.langEn")}
                  </label>
                </div>
              </div>
            </>
          ) : null}

          {step === 4 ? (
            <div className="wizard-row">
              <label
                className={`wizard-card${themePresetId === "" ? " selected" : ""}`}
              >
                <input
                  type="radio"
                  checked={themePresetId === ""}
                  onChange={() => setThemePresetId("")}
                />
                <span>
                  <strong>{t("wizard.themeDefault")}</strong>
                  <span className="wizard-card-desc">{t("wizard.themeDefaultDesc")}</span>
                </span>
              </label>
              {THEME_PRESETS.map((p) => (
                <label
                  key={p.id}
                  className={`wizard-card${themePresetId === p.id ? " selected" : ""}`}
                >
                  <input
                    type="radio"
                    checked={themePresetId === p.id}
                    onChange={() => setThemePresetId(p.id)}
                  />
                  <span style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                    <strong style={{ minWidth: 130 }}>{t(`preset.${p.id}`)}</strong>
                    <span className="wizard-swatches">
                      {[
                        p.colors.accent,
                        p.colors.heading,
                        p.colors.text,
                        p.colors.muted,
                        p.colors.background,
                      ].map((c, i) => (
                        <span
                          key={i}
                          className="wizard-swatch"
                          style={{ background: c }}
                          title={c}
                        />
                      ))}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          ) : null}

          {existDir ? (
            <div className="wizard-confirm">
              <div>
                {t("wizard.dirExistsConfirm", { dir: existDir })}
                <div className="wizard-hint">
                  {t("wizard.dirExistsWarn")}
                </div>
              </div>
            </div>
          ) : null}
          {error ? <div className="wizard-error">{error}</div> : null}
        </div>

        <div className="modal-actions">
          {existDir ? (
            <>
              <button onClick={() => setExistDir(null)} disabled={busy}>
                {t("wizard.no")}
              </button>
              <button className="primary" onClick={() => runCreate(true)} disabled={busy}>
                {busy ? t("wizard.creating") : t("wizard.yesCreateHere")}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep((s) => s - 1)} disabled={step === 0 || busy}>
                {t("wizard.back")}
              </button>
              {step < STEP_TITLE_KEYS.length - 1 ? (
                <button
                  className="primary"
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!stepValid() || busy}
                >
                  {t("wizard.next")}
                </button>
              ) : (
                <button
                  className="primary"
                  onClick={() => runCreate(false)}
                  disabled={!stepValid() || busy}
                >
                  {busy ? t("wizard.creating") : t("wizard.create")}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
