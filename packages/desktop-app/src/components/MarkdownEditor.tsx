import { useRef } from "react";
import { useLang } from "../i18n";

interface Props {
  value: string;
  onChange: (md: string) => void;
}

export default function MarkdownEditor({ value, onChange }: Props) {
  const { t } = useLang();
  const ref = useRef<HTMLTextAreaElement | null>(null);

  function wrap(before: string, after: string) {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = value.slice(start, end) || t("editor.sample_text");
    const next = value.slice(0, start) + before + sel + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + sel.length;
    });
  }

  function prefixLine(prefix: string) {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(next);
  }

  function insertAtCursor(text: string) {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + text.length;
    });
  }

  return (
    <div>
      <div className="md-toolbar">
        <button onClick={() => wrap("**", "**")} title={t("editor.bold")}><b>B</b></button>
        <button onClick={() => wrap("*", "*")} title={t("editor.italic")}><i>I</i></button>
        <button onClick={() => wrap("<u>", "</u>")} title={t("editor.underline")}><u>U</u></button>
        <button onClick={() => wrap('<span class="role-accent">', "</span>")} title={t("editor.accent_title")}>{t("editor.accent")}</button>
        <button onClick={() => wrap('<span class="role-warning">', "</span>")} title={t("editor.warning_title")}>{t("editor.warning")}</button>
        <button onClick={() => prefixLine("## ")} title={t("editor.heading")}>H</button>
        <button onClick={() => prefixLine("- ")} title={t("editor.bullet")}>•</button>
        <button onClick={() => prefixLine("1. ")} title={t("editor.numbered")}>1.</button>
        <button onClick={() => prefixLine("> ")} title={t("editor.quote")}>&ldquo;</button>
        <button onClick={() => insertAtCursor("\n\n&nbsp;\n\n")} title={t("editor.blank_line_title")}>{t("editor.blank_line")}</button>
      </div>
      <textarea
        ref={ref}
        className="md-editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
          const k = e.key.toLowerCase();
          if (k === "b") { e.preventDefault(); wrap("**", "**"); }
          else if (k === "i") { e.preventDefault(); wrap("*", "*"); }
          else if (k === "u") { e.preventDefault(); wrap("<u>", "</u>"); }
          else if (k === "k") { e.preventDefault(); wrap('<span class="role-accent">', "</span>"); }
        }}
        spellCheck={false}
      />
      <div className="hint">
        {t("editor.hint_prefix")}<code>**{t("editor.bold")}**</code> / <code>*{t("editor.italic")}*</code> /
        <code>&lt;u&gt;{t("editor.underline")}&lt;/u&gt;</code> / <code>&lt;span class="role-warning"&gt;…&lt;/span&gt;</code>
      </div>
    </div>
  );
}
