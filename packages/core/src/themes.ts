// Built-in theme presets for one-click "着せ替え" (theme re-application).
// A preset swaps the role colors (and optionally font families) while blocks,
// content, layout, and per-block styles are kept untouched — consistent with
// the role-color-first design (設計書: 役割色をカスタム色より優先).

import type { ThemeColors } from "./types";

export interface ThemePreset {
  id: string;
  /** display name (Japanese label shown in the GUI) */
  name: string;
  colors: ThemeColors;
  /** optional font families; applied only when the user opts in */
  font_family?: { body: string; heading: string; title: string };
}

// Each preset is a coherent palette (accent + a darker heading of the same
// hue family + a very light background tint of that hue), so the swatch row in
// the GUI actually reads as the named theme rather than "three blacks + white".
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "standard-blue",
    name: "標準（青）",
    colors: {
      text: "#1f2937",
      heading: "#1e3a5f",
      accent: "#2563eb",
      warning: "#c0392b",
      muted: "#6b7280",
      background: "#f5f8fc",
    },
  },
  {
    id: "crimson",
    name: "えんじ",
    colors: {
      text: "#2a1d1f",
      heading: "#5c1020",
      accent: "#9b1c31",
      warning: "#b45309",
      muted: "#7a6a6c",
      background: "#fdf6f5",
    },
  },
  {
    id: "forest",
    name: "深緑",
    colors: {
      text: "#1f2722",
      heading: "#14432c",
      accent: "#1f7a4d",
      warning: "#b45309",
      muted: "#5f7268",
      background: "#f4faf6",
    },
  },
  {
    id: "ocean",
    name: "青緑",
    colors: {
      text: "#1d2a2e",
      heading: "#0c3d4a",
      accent: "#0e7490",
      warning: "#c0392b",
      muted: "#5c7077",
      background: "#f1f9fb",
    },
  },
  {
    id: "violet",
    name: "紫",
    colors: {
      text: "#241f2b",
      heading: "#3b1d6e",
      accent: "#6d28d9",
      warning: "#c0392b",
      muted: "#6b6276",
      background: "#f8f5fd",
    },
  },
  {
    id: "sunset",
    name: "オレンジ",
    colors: {
      text: "#2b2118",
      heading: "#7a3a12",
      accent: "#d2691e",
      warning: "#a93226",
      muted: "#75685c",
      background: "#fdf7f0",
    },
  },
  {
    id: "mono",
    name: "モノクロ",
    colors: {
      text: "#1a1a1a",
      heading: "#111111",
      accent: "#374151",
      warning: "#7a0000",
      muted: "#6b7280",
      background: "#f7f7f7",
    },
  },
  {
    id: "classic-serif",
    name: "クラシック（金茶・明朝見出し）",
    colors: {
      text: "#2a2620",
      heading: "#4a3a14",
      accent: "#8a6d28",
      warning: "#a93226",
      muted: "#6e6a5e",
      background: "#fbf8f0",
    },
    font_family: {
      body: "Noto Sans JP",
      heading: "Noto Serif JP",
      title: "Noto Serif JP",
    },
  },
];
