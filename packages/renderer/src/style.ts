// Resolve block-level style and height modes into React CSS properties.

import type { CSSProperties } from "react";
import type { Block, Theme } from "@rps/core";

const ROLE_KEYS = ["text", "heading", "accent", "warning", "muted", "background"] as const;

export function resolveColor(value: string | undefined, theme: Theme): string | undefined {
  if (!value) return undefined;
  if ((ROLE_KEYS as readonly string[]).includes(value)) {
    return (theme.colors as any)[value];
  }
  return value;
}

/** CSS controlling how the block occupies vertical space within its column. */
export function heightStyle(block: Block): CSSProperties {
  const { mode, value, min, max, weight } = block.height;
  const css: CSSProperties = {};
  if (min) css.minHeight = min;
  if (max) css.maxHeight = max;
  switch (mode) {
    case "fixed":
    case "locked":
      if (value) {
        css.height = value;
        css.flex = "0 0 auto";
      }
      break;
    case "flex":
      css.flex = `${weight ?? 1} 1 0`;
      break;
    case "auto":
    default:
      css.flex = "0 0 auto";
      break;
  }
  // pin to bottom of the column/body: consume slack above this block
  if (block.pin_bottom) css.marginTop = "auto";
  return css;
}

/** Box appearance: background, border, padding. */
export function boxStyle(block: Block, theme: Theme): CSSProperties {
  const s = block.style ?? {};
  const css: CSSProperties = {};
  if (s.background) css.background = resolveColor(s.background, theme);
  // N2 card: border + soft shadow, padding 0 so the title bar bleeds flush to
  // the top/side edges; the body/children get their inset from CSS (.rps-card).
  if (s.card) {
    const w = s.border_width ?? "0.6pt";
    const c = resolveColor(s.border_color, theme) ?? theme.colors.muted;
    css.border = `${w} solid ${c}`;
    css.boxShadow = "0 0.6mm 2.4mm rgba(0,0,0,0.14)";
    css.borderRadius = s.corner === "square" ? "0" : "1.6mm";
    css.overflow = "hidden";
    css.padding = 0;
    return css;
  }
  const hasBox = !!s.background || !!s.border || !!s.accent_bar;
  if (s.border) {
    const w = s.border_width ?? "1pt";
    const c = resolveColor(s.border_color, theme) ?? theme.colors.muted;
    css.border = `${w} solid ${c}`;
  }
  // N7 left accent bar: a callout look without a full border.
  if (s.accent_bar) {
    const w = s.accent_bar.width ?? "3pt";
    const c = resolveColor(s.accent_bar.color, theme) ?? theme.colors.accent;
    css.borderLeft = `${w} solid ${c}`;
  }
  // Padding insets content from a visible box edge. A block with no background
  // and no border has no visible edge, so default padding there is just dead
  // space that accumulates through nested containers (parent → band child →
  // synthesized __text). Default to 0 in that case; an explicit padding_mm
  // still wins. Boxed blocks (background/border) keep the 4mm card inset.
  const pad = s.padding_mm ?? (hasBox ? 4 : 0);
  if (pad) css.padding = `${pad}mm`;
  // corner shape: square (default) or rounded
  css.borderRadius = s.corner === "rounded" ? "2mm" : "0";
  return css;
}

export function bodyTextStyle(block: Block, theme: Theme): CSSProperties {
  const s = block.style ?? {};
  const css: CSSProperties = {
    fontFamily: s.font_family ?? undefined,
    fontSize: s.body_font_size ?? theme.font_size.body,
    color: resolveColor(s.text_color, theme) ?? theme.colors.text,
    fontStyle: s.italic ? "italic" : undefined,
  };
  // per-block typography overrides (theme defaults live in posterCss)
  if (s.line_height != null) css.lineHeight = s.line_height;
  if (s.paragraph_spacing_mm != null) {
    (css as Record<string, unknown>)["--rps-para"] = `${s.paragraph_spacing_mm}mm`;
  }
  return css;
}

export function headingStyle(block: Block, theme: Theme): CSSProperties {
  const s = block.style ?? {};
  const deco: string[] = [];
  if (s.heading_underline) deco.push("underline");
  const css: CSSProperties = {
    fontFamily: s.font_family ?? undefined,
    fontSize: s.heading_font_size ?? theme.font_size.heading1,
    color: resolveColor(s.heading_color, theme) ?? theme.colors.heading,
    fontWeight: s.heading_bold === false ? 400 : s.heading_bold ? 700 : undefined,
    fontStyle: s.heading_italic ? "italic" : undefined,
    textDecoration: deco.length ? deco.join(" ") : undefined,
    textAlign: s.heading_align,
  };

  const bg = resolveColor(s.heading_background, theme);
  if (bg) {
    css.background = bg;
    css.paddingTop = "1.5mm";
    css.paddingBottom = "1.5mm";
    css.paddingRight = "3mm";
  }
  // the vertical accent bar (left border) is on by default
  if (s.heading_accent_bar === false) {
    css.borderLeft = "none";
    css.paddingLeft = bg ? "3mm" : "0";
  } else {
    const barColor = resolveColor(s.heading_bar_color, theme) ?? theme.colors.accent;
    css.borderLeft = `6pt solid ${barColor}`;
    css.paddingLeft = "4mm";
  }

  // title box width: full block width / fit content / custom
  const selfMap: Record<string, CSSProperties["alignSelf"]> = {
    left: "flex-start",
    center: "center",
    right: "flex-end",
  };
  const wm = s.heading_width_mode ?? "full";
  if (wm === "fit") {
    css.width = "fit-content";
    css.alignSelf = selfMap[s.heading_align ?? "left"];
  } else if (wm === "custom" && s.heading_width) {
    css.width = s.heading_width;
    css.maxWidth = "100%";
    css.alignSelf = selfMap[s.heading_align ?? "left"];
  }
  return css;
}
