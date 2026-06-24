// Color input that accepts either a role name (accent/warning/...) or a hex
// code, with a native color picker plus a clickable swatch palette and role
// buttons (PowerPoint-style quick pick).
//
// When `themeColors` is given, the swatch row adapts to the current theme
// (role colors + light tints + neutrals) so picks stay consistent with the
// poster's palette. `allowTransparent` adds a 透明 (none) choice.

import type { ThemeColors } from "@rps/core";
import { useLang } from "../i18n";

interface Props {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  placeholder?: string;
  /** current theme role colors; when set, swatches adapt to the theme */
  themeColors?: ThemeColors;
  /** offer a 透明 (transparent) choice */
  allowTransparent?: boolean;
}

const GENERIC_SWATCHES = [
  "#1f5f99", "#10243a", "#2e75b6", "#3a6b35", "#548235", "#7030a0",
  "#c00000", "#e0a030", "#bf9000", "#666666", "#111111", "#ffffff",
];

const ROLE_NAMES = ["accent", "warning", "muted", "heading", "text"];

/** mix a #rrggbb color with white; ratio 0 = original, 1 = white */
function tint(hex: string, ratio: number): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * ratio);
  const to2 = (c: number) => c.toString(16).padStart(2, "0");
  return `#${to2(mix(r))}${to2(mix(g))}${to2(mix(b))}`;
}

/** Theme-adapted palette: role colors, light tints, and neutrals. */
function themeSwatches(t: ThemeColors): string[] {
  const out = [
    t.background,
    tint(t.accent, 0.86),
    tint(t.heading, 0.86),
    tint(t.accent, 0.66),
    tint(t.muted, 0.7),
    t.accent,
    t.heading,
    t.muted,
    t.text,
    "#ffffff",
  ];
  // de-duplicate while keeping order
  return out.filter((c, i) => out.indexOf(c) === i);
}

export default function ColorField({
  label,
  value,
  onChange,
  placeholder,
  themeColors,
  allowTransparent,
}: Props) {
  const { t } = useLang();
  const isHex = value?.startsWith("#");
  const swatches = themeColors ? themeSwatches(themeColors) : GENERIC_SWATCHES;
  return (
    <div className="field">
      <label>{label}</label>
      <div className="row">
        <input
          type="text"
          placeholder={placeholder ?? t("color.placeholder")}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
        <input
          type="color"
          value={isHex ? value! : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          title={t("color.pick")}
        />
      </div>
      <div className="swatches">
        {allowTransparent ? (
          <button
            type="button"
            className={`swatch transparent${value === "transparent" ? " sel" : ""}`}
            title={t("color.transparent")}
            onClick={() => onChange("transparent")}
          />
        ) : null}
        {swatches.map((c) => (
          <button
            key={c}
            type="button"
            className={`swatch${value === c ? " sel" : ""}`}
            style={{ background: c }}
            title={c}
            onClick={() => onChange(c)}
          />
        ))}
        <button
          type="button"
          className="swatch clear"
          title={t("color.reset")}
          onClick={() => onChange(undefined)}
        >
          ×
        </button>
      </div>
      <div className="role-btns">
        {ROLE_NAMES.map((name) => (
          <button
            key={name}
            type="button"
            className={value === name ? "primary" : ""}
            onClick={() => onChange(name)}
          >
            {t(`color.role.${name}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
