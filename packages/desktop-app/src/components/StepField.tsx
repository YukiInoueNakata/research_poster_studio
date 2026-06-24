// Numeric inputs with △/▽ stepper buttons.
// NumberField  -> plain number value.
// LengthField  -> CSS length string ("160mm", "22pt"); steppers adjust the
//                 numeric part and keep the unit.

import { useLang } from "../i18n";

interface NumberProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

function clamp(n: number, min?: number, max?: number) {
  if (min != null) n = Math.max(min, n);
  if (max != null) n = Math.min(max, n);
  return n;
}

export function NumberField({ label, value, onChange, step = 1, min, max }: NumberProps) {
  const { t } = useLang();
  const bump = (d: number) => onChange(clamp(Math.round((value + d * step) * 100) / 100, min, max));
  return (
    <div className="field">
      <label>{label}</label>
      <div className="stepper">
        <input
          type="number"
          value={value}
          step={step}
          onChange={(e) => onChange(clamp(Number(e.target.value), min, max))}
        />
        <div className="stepper-btns">
          <button onClick={() => bump(1)} tabIndex={-1} title={t("field.increase")}>△</button>
          <button onClick={() => bump(-1)} tabIndex={-1} title={t("field.decrease")}>▽</button>
        </div>
      </div>
    </div>
  );
}

interface LengthProps {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  placeholder?: string;
  step?: number;
  defaultUnit?: string;
}

function parseLen(v: string | undefined): { n: number; u: string } {
  const m = (v ?? "").trim().match(/^(-?[0-9]*\.?[0-9]+)\s*([a-z%]*)$/i);
  return m ? { n: parseFloat(m[1]), u: m[2] || "" } : { n: NaN, u: "" };
}

export function LengthField({
  label,
  value,
  onChange,
  placeholder,
  step = 1,
  defaultUnit = "mm",
}: LengthProps) {
  const { t } = useLang();
  const cur = parseLen(value);
  const ph = parseLen(placeholder);
  const unit = cur.u || ph.u || defaultUnit;
  const bump = (d: number) => {
    const base = isNaN(cur.n) ? (isNaN(ph.n) ? 0 : ph.n) : cur.n;
    const nn = Math.round((base + d * step) * 100) / 100;
    onChange(`${nn}${unit}`);
  };
  return (
    <div className="field">
      <label>{label}</label>
      <div className="stepper">
        <input
          type="text"
          placeholder={placeholder}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
        <div className="stepper-btns">
          <button onClick={() => bump(1)} tabIndex={-1} title={t("field.increase")}>△</button>
          <button onClick={() => bump(-1)} tabIndex={-1} title={t("field.decrease")}>▽</button>
        </div>
      </div>
    </div>
  );
}
