// Font-family picker backed by the machine's installed fonts (a shared
// <datalist id="rps-fonts"> rendered once in App). The input previews the
// chosen font.

import { useLang } from "../i18n";

interface Props {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  placeholder?: string;
}

export default function FontField({ label, value, onChange, placeholder }: Props) {
  const { t } = useLang();
  return (
    <div className="field">
      <label>{label}</label>
      <div className="row">
        <input
          type="text"
          list="rps-fonts"
          placeholder={placeholder ?? t("field.default")}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          style={{ fontFamily: value || undefined }}
        />
        <button type="button" onClick={() => onChange(undefined)} title={t("field.reset")}>
          ×
        </button>
      </div>
    </div>
  );
}
