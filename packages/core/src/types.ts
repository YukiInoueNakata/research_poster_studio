// Type model for a Research Poster Studio project.
//
// These mirror the `poster.yaml` schema in the design document (設計書.md §7).
// All layout-affecting fields are optional with sensible defaults applied in
// `lib/normalize.ts`, so partial / Agent-generated YAML still loads.

export type PaperSize =
  | "A0"
  | "A1"
  | "A2"
  | "36x48in"
  | "42x56in"
  | "48x96in"
  | "custom";
export type Orientation = "portrait" | "landscape";
/** display unit system for the GUI (internal computation is always mm) */
export type UnitSystem = "mm" | "in";

export interface CustomSize {
  /** poster width in mm (used as-is; orientation does not swap custom sizes) */
  width_mm: number;
  /** poster height in mm */
  height_mm: number;
}

/** Column slot name. 1-3 columns use the named slots (left / center / right);
 *  4+ columns use generic names col1..colN. "left" / "center" / "right" are
 *  also accepted as aliases for first / middle / last at any column count.
 *  "wide" spans all columns. */
export type ColumnName = "left" | "center" | "right" | "wide" | `col${number}`;
export type HeightMode = "auto" | "fixed" | "flex" | "locked";
export type BlockType = "text" | "figure" | "mixed";
export type OverflowAction = "warn" | "clip" | "scroll";

export type ColumnWidthMode =
  | "equal"
  | "ratio"
  | "left_master"
  | "right_master"
  | "independent";

export type HeightSyncMode =
  | "sync_row"
  | "independent"
  | "left_follows"
  | "right_follows"
  | "balance_columns";

export type HAlign = "left" | "center" | "right";

export interface Author {
  name: string;
  /** indices (0-based) into ProjectMeta.affiliations */
  affiliations?: number[];
  /** legacy single-affiliation string, still accepted on input */
  affiliation?: string;
}

export interface ProjectMeta {
  title: string;
  subtitle?: string;
  authors: Author[];
  /** master list of affiliations; authors reference them by index */
  affiliations?: string[];
  /** affiliation indices after which to insert a line break in the header */
  affiliation_line_breaks?: number[];
  /** keywords shown in the title block (when header.show_keywords !== false) */
  keywords?: string[];
  conference?: { name?: string; date?: string };
  poster_size: PaperSize;
  orientation: Orientation;
  /** custom poster dimensions; used when poster_size === "custom" */
  custom_size?: CustomSize;
  /** GUI display units (default "mm") */
  units?: UnitSystem;
  /**
   * Single-file body content: when set (e.g. "content.md"), block bodies live
   * in this one Markdown file, split by `# Title {#id}` sections, and blocks
   * reference them via `source: "content.md#id"`. When unset, the legacy
   * one-file-per-block model (`content/<id>.md`) is used.
   */
  content_file?: string;
}

export interface LayoutColumns {
  count: number;
  width_mode: ColumnWidthMode;
  ratio: number[];
  height_balance?: "auto" | "manual";
  sync_mode: HeightSyncMode;
}

export interface Layout {
  template: string;
  columns: LayoutColumns;
  margin_mm?: number;
  gap_mm?: number;
  /** horizontal gap between columns (mm). Falls back to gap_mm. */
  column_gap_mm?: number;
  /** vertical gap between stacked blocks / bands (mm). Falls back to gap_mm. */
  row_gap_mm?: number;
  /** prefix block headings with section numbers (1, 2, … / nested 1.1) */
  number_sections?: boolean;
  /** auto-renumber figure/table caption numbers (図1/表1/Figure 1) by order */
  number_figures?: boolean;
}

export interface ThemeFontSizes {
  title: string;
  subtitle: string;
  heading1: string;
  heading2: string;
  body: string;
  caption: string;
  references: string;
}

export interface ThemeColors {
  text: string;
  heading: string;
  accent: string;
  warning: string;
  muted: string;
  background: string;
}

export interface BackgroundConfig {
  /** project-relative image path (e.g. "figures/bg.png"); resolved by basename */
  image?: string;
  /** how the image fills the poster (default "cover") */
  fit?: "cover" | "contain" | "tile";
  /** image opacity 0-1 over colors.background (default 1) */
  opacity?: number;
}

export interface Theme {
  name: string;
  font_family: { body: string; heading: string; title: string };
  font_size: ThemeFontSizes;
  colors: ThemeColors;
  /** poster-wide background image drawn over colors.background */
  background?: BackgroundConfig;
  /** body line height (unitless multiplier, default 1.45) */
  line_height?: number;
  /** space after paragraphs / lists in mm (default 2) */
  paragraph_spacing_mm?: number;
}

export interface LogoConfig {
  /** project-relative path of the image (e.g. "figures/logo.png") */
  path: string;
  /** where the logo is placed (default "header") */
  area?: "header" | "footer";
  /** horizontal slot inside the area (default "left") */
  position?: "left" | "center" | "right";
  /** rendered height in mm (default 20); width keeps aspect ratio */
  height_mm?: number;
}

/** B1: a coloured text badge / pill shown in the header row. */
export interface HeaderBadge {
  text: string;
  /** header slot (default "right") */
  position?: "left" | "center" | "right";
  /** pill background (role color name or hex; default accent) */
  background?: string;
  /** text color (default white) */
  color?: string;
  font_size?: string;
}

export interface HeaderConfig {
  /** default horizontal alignment for elements that don't set their own */
  align?: HAlign;
  background?: string;
  border?: boolean;
  border_color?: string;
  border_width?: string;
  padding_mm?: number;
  show_affiliation?: boolean;
  /** how multiple affiliations are marked on author names */
  affiliation_marker?: "number" | "symbol";
  /** separator between author names (default "，") */
  author_separator?: string;
  title_color?: string;
  accent_color?: string;
  /** color for authors / affiliation / conference (e.g. white on a colored
   *  header background); falls back to theme text / muted */
  text_color?: string;

  /** per-element font size (fall back to theme.font_size) and alignment */
  conference_font_size?: string;
  conference_align?: HAlign;
  title_font_size?: string;
  title_align?: HAlign;
  subtitle_font_size?: string;
  subtitle_align?: HAlign;
  authors_font_size?: string;
  authors_align?: HAlign;
  affil_font_size?: string;
  affil_align?: HAlign;
  /** combine each author with their affiliation inline as "Name (Affiliation)"
   *  on the authors line, instead of a separate affiliation line (N8) */
  affiliation_inline?: boolean;
  /** show the keywords line in the title block (default true if any keyword) */
  show_keywords?: boolean;
  /** label prefix for the keywords line (default "Keywords: ") */
  keywords_label?: string;
  keywords_font_size?: string;
  keywords_align?: HAlign;
  /** institution logos (header / footer; multiple allowed) */
  logos?: LogoConfig[];
  /** B1: text badges / pills in the header row (e.g. "Spotlight Paper",
   *  "Best Poster"). Flow in the left / center / right header slots. */
  badges?: HeaderBadge[];
  /** N17: full-width footer band text (date / venue / etc.), per zone, plus an
   *  optional band background and text color (e.g. white on a colored bar) */
  footer_left?: string;
  footer_center?: string;
  footer_right?: string;
  footer_background?: string;
  footer_text_color?: string;
  footer_font_size?: string;
}

export interface BlockHeight {
  mode: HeightMode;
  value?: string; // for fixed / locked, e.g. "160mm"
  min?: string;
  max?: string;
  weight?: number; // for flex
}

export interface BlockStyle {
  /** font family for this block (title + body); falls back to theme */
  font_family?: string;
  body_font_size?: string;
  heading_font_size?: string;
  /** role name ("accent"/"warning"/...) or hex */
  heading_color?: string;
  /** title (heading) decorations */
  heading_bold?: boolean;
  heading_italic?: boolean;
  heading_underline?: boolean;
  heading_align?: HAlign;
  heading_background?: string;
  /** title box width: full block width / fit content / custom length */
  heading_width_mode?: "full" | "fit" | "custom";
  heading_width?: string;
  /** show the vertical accent bar at the left of the title (default true) */
  heading_accent_bar?: boolean;
  /** color of the title accent bar (role name or hex; default theme accent) */
  heading_bar_color?: string;
  /** render the leading section number as a badge box on the title bar (N1).
   *  The number comes from auto section numbering, or the leading number /
   *  circled-number token of the title. */
  heading_badge?: {
    background?: string; // role name or hex (default theme background)
    color?: string; // role name or hex (default theme heading)
    shape?: "square" | "rounded" | "circle";
  };
  /** block corner shape (default "square") */
  corner?: "square" | "rounded";
  /** render the block as a card: border + soft shadow, the title bar bleeding
   *  flush to the top/side edges, body padded inside (N2) */
  card?: boolean;
  /** left accent bar on the whole block (callout look without a full border) (N7) */
  accent_bar?: { color?: string; width?: string };
  /** format this block's own hand-written body as a reference list (small
   *  reference font + hanging indent), for in-context citations placed in a
   *  block / child block — independent of the BibTeX `references_list` (D) */
  reference_format?: boolean;
  text_color?: string;
  background?: string;
  border?: boolean;
  border_color?: string;
  border_width?: string; // e.g. "1pt"
  italic?: boolean;
  padding_mm?: number;
  /** body line height for this block (unitless; falls back to theme) */
  line_height?: number;
  /** space after paragraphs / lists in mm (falls back to theme) */
  paragraph_spacing_mm?: number;
}

export interface BlockOverflow {
  action: OverflowAction;
}

export interface Block {
  id: string;
  type: BlockType;
  title: string;
  source?: string; // path to content md, relative to project root
  column: ColumnName;
  order: number;
  visible?: boolean;
  height: BlockHeight;
  sync?: HeightSyncMode;
  /** pin this block to the bottom of its column / the body (margin-top:auto) */
  pin_bottom?: boolean;
  style?: BlockStyle;
  figures?: string[]; // figure ids placed inside this block
  overflow?: BlockOverflow;
  /** for type "figure" blocks: the figure id they render */
  figure_id?: string;
  /** render the generated reference list (cited-only) instead of the md body */
  references_list?: boolean;
  /** nested child blocks, laid out with the band system (wide / left-right) */
  children?: Block[];
  /** child layout: follow the global columns ("inherit", default) or override */
  child_layout?: {
    mode?: "inherit" | "custom";
    count?: number;
    ratio?: number[];
    width_mode?: ColumnWidthMode;
  };
}

export interface Crop {
  enabled: boolean;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export type FigurePlacement =
  | "inside-block"
  | "full-width"
  | "column";

export type FigureAlign = "left" | "center" | "right";
export type FigureVAlign = "top" | "middle" | "bottom";

export interface Figure {
  id: string;
  path: string; // relative to project root
  /** additional image paths rendered together with `path` as a gallery
   *  sharing one caption. Images are auto-aligned to equal heights per row
   *  (when intrinsic sizes are known). Crop applies only without a gallery. */
  images?: string[];
  /** images per gallery row (0 / undefined = all in one row) */
  gallery_columns?: number;
  caption?: string;
  placement: FigurePlacement;
  block?: string; // owning block id when placement = inside-block
  column?: ColumnName;
  order?: number;
  /** fraction of the container width; values > 1 let the figure bleed past
   *  its block bounds (not clipped unless the block clips) */
  scale: number;
  /** per-image crop for gallery images, keyed by image path (the main `path`
   *  and each entry of `images`). Falls back to `crop` for the main image.
   *  Applied to a chosen subset; the rest stay uncropped (N13). */
  image_crops?: Record<string, Crop>;
  /** horizontal placement of the figure within its block */
  align?: FigureAlign;
  /** vertical placement within the block when the block is taller than the
   *  figure (e.g. a fixed-height block or a synced band cell) */
  valign?: FigureVAlign;
  /** flow-based float: the figure sits at the left/right of its owning block and
   *  the body text wraps around it (CSS float — structured, not absolute) (N4) */
  float?: "left" | "right";
  crop?: Crop;
  style?: {
    border?: boolean;
    border_color?: string;
    caption_position?: "top" | "bottom" | "left" | "right";
    caption_font_size?: string;
    /** caption text color (role name or hex; default theme muted) (N5) */
    caption_color?: string;
    /** when the figure has a border, include the figure title inside it */
    title_inside_border?: boolean;
    /** drop a white/light image background by multiply-blending it with the
     *  page background (works on light backgrounds; no true alpha) */
    transparent_white?: boolean;
  };
}

export interface ReferencesConfig {
  /** BibTeX ファイルのプロジェクト相対パス（default "references.bib"） */
  bib?: string;
  /** 引用スタイル名: 組込み "apa7"/"jpa" または styles/*.yaml の name */
  style?: string;
  /** DOI / URL を文献リストに含めるか（スタイル設定を上書き） */
  include_doi?: boolean;
}

export interface ExportConfig {
  pdf?: { enabled: boolean; filename: string };
  png?: { enabled: boolean; filename: string; dpi?: number };
  svg?: { enabled: boolean; filename: string };
  pptx?: { enabled: boolean; filename: string };
  marp?: { enabled: boolean; filename: string };
}

export interface PosterDoc {
  project: ProjectMeta;
  layout: Layout;
  theme: Theme;
  header?: HeaderConfig;
  blocks: Block[];
  figures: Figure[];
  references?: ReferencesConfig;
  export?: ExportConfig;
}

/** sentinel block id for selecting the poster header in the GUI */
export const HEADER_ID = "__header__";

// ---- Runtime project (document + resolved content + figure data) -----------

export interface FigureAsset {
  name: string;
  path: string;
  dataUri: string;
  bytes: number;
  /** intrinsic pixel size, filled in after the browser decodes it */
  naturalWidth?: number;
  naturalHeight?: number;
}

export interface PosterProject {
  /** absolute path to the project directory */
  dir: string;
  /** poster yaml filename within dir (default "poster.yaml") */
  posterFile?: string;
  doc: PosterDoc;
  /** content markdown keyed by block id */
  content: Record<string, string>;
  /** figure assets keyed by figure id (and also by filename) */
  figures: Record<string, FigureAsset>;
  /** parsed BibTeX entries (undefined = no .bib file in the project) */
  bib?: import("./bibtex").BibEntry[];
  /** parse problems from the .bib file */
  bibErrors?: string[];
  /** user citation styles from styles/*.yaml, keyed by style name */
  citationStyles?: Record<string, import("./citation").CitationStyle>;
}
