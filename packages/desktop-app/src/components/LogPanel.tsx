import { useState } from "react";
import type { Warning } from "@rps/core";
import { useLang } from "../i18n";

export interface LogEntry {
  level: "ok" | "info" | "warn" | "error";
  message: string;
}

interface Props {
  warnings: Warning[];
  logs: LogEntry[];
  onSelectBlock: (id: string) => void;
  onToggle: () => void;
}

export default function LogPanel({ warnings, logs, onSelectBlock, onToggle }: Props) {
  const { t } = useLang();
  const [tab, setTab] = useState<"warn" | "log">("warn");
  const errN = warnings.filter((w) => w.level === "error").length;
  const warnN = warnings.filter((w) => w.level === "warn").length;

  // Core warnings carry a stable code + params; translate by code and fall back
  // to the (Japanese) message when no translation exists (e.g. measured
  // warnings already localized their message in PreviewPane).
  const warnText = (w: Warning): string => {
    if (!w.code) return w.message;
    const key = `warn.${w.code}`;
    const s = t(key, w.params);
    return s === key ? w.message : s;
  };

  return (
    <div className="logpanel">
      <div className="log-tabs">
        <button className={tab === "warn" ? "active" : ""} onClick={() => setTab("warn")}>
          {t("logpanel.tab_warn")} <span className="badge">{errN + warnN}</span>
        </button>
        <button className={tab === "log" ? "active" : ""} onClick={() => setTab("log")}>
          {t("logpanel.tab_log")} <span className="badge">{logs.length}</span>
        </button>
        <span className="spacer" style={{ flex: 1 }} />
        {tab === "warn" && (
          <span style={{ color: "var(--muted)", fontSize: 11, marginRight: 8 }}>
            error {errN}・warn {warnN}
          </span>
        )}
        <button onClick={onToggle} title={t("logpanel.close_title")}>▼ {t("logpanel.close")}</button>
      </div>
      <div className="log-list">
        {tab === "warn" ? (
          warnings.length === 0 ? (
            <div className="empty">{t("logpanel.no_warnings")}</div>
          ) : (
            warnings.map((w, i) => (
              <div
                key={i}
                className="log-row"
                onClick={() => w.blockId && onSelectBlock(w.blockId)}
              >
                <span className={`lvl ${w.level}`}>{w.level}</span>
                <span>{warnText(w)}</span>
              </div>
            ))
          )
        ) : logs.length === 0 ? (
          <div className="empty">{t("logpanel.no_logs")}</div>
        ) : (
          logs
            .slice()
            .reverse()
            .map((l, i) => (
              <div key={i} className="log-row">
                <span className={`lvl ${l.level}`}>{l.level}</span>
                <span>{l.message}</span>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
