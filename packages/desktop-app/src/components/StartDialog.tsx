// Startup dialog: shown right after launch (while no project is loaded) so the
// first action — create / open / sample / recent — is obvious.

import type { RecentProject } from "../lib/recent";
import { useLang } from "../i18n";

interface Props {
  recent: RecentProject[];
  onNew: () => void;
  onOpen: () => void;
  onOpenSample: () => void;
  onOpenRecent: (r: RecentProject) => void;
  onClose: () => void;
}

export default function StartDialog({
  recent,
  onNew,
  onOpen,
  onOpenSample,
  onOpenRecent,
  onClose,
}: Props) {
  const { t, lang, setLang } = useLang();
  return (
    <div className="modal-overlay">
      <div className="modal start-dialog">
        <div className="modal-titlebar">
          <span>Research Poster Studio</span>
          <span style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setLang(lang === "ja" ? "en" : "ja")}
              title={t("lang.switch")}
            >
              {lang === "ja" ? t("lang.en") : t("lang.ja")}
            </button>
            <button onClick={onClose}>{t("start.close")}</button>
          </span>
        </div>
        <div className="modal-body">
          <div className="start-actions">
            <button className="primary start-action" onClick={onNew}>
              <strong>{t("start.new")}</strong>
              <span>{t("start.new.desc")}</span>
            </button>
            <button className="start-action" onClick={onOpen}>
              <strong>{t("start.open")}</strong>
              <span>{t("start.open.desc")}</span>
            </button>
            <button className="start-action" onClick={onOpenSample}>
              <strong>{t("start.sample")}</strong>
              <span>{t("start.sample.desc")}</span>
            </button>
          </div>
          {recent.length > 0 ? (
            <div className="start-recent">
              <div className="start-recent-title">{t("start.recent")}</div>
              {recent.map((r) => (
                <a
                  key={`${r.dir}/${r.posterFile}`}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenRecent(r);
                  }}
                  title={`${r.dir}\\${r.posterFile}`}
                >
                  {r.title || r.dir.split(/[\\/]/).pop() || r.dir}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
