// Pure logic for the new-project wizard (no Tauri / Vite dependencies) so it
// can be exercised from Node-based checks. File I/O lives in newProject.ts.

import type { CustomSize, Orientation, PaperSize, PosterDoc } from "@rps/core";
import {
  THEME_PRESETS,
  buildCombinedContent,
  contentAnchorSource,
  flattenBlocks,
  normalizeDoc,
  splitContentAnchor,
} from "@rps/core";

/** single-file body content path for new wizard projects */
export const CONTENT_FILE = "content.md";

export type StructureId = "single" | "multi";
export type WizardLang = "ja" | "en";

export interface WizardAuthor {
  name: string;
  affiliation: string;
}

export interface NewProjectInput {
  parentDir: string;
  folderName: string;
  title: string;
  subtitle: string;
  authors: WizardAuthor[];
  conferenceName: string;
  conferenceDate: string;
  posterSize: PaperSize;
  orientation: Orientation;
  customSize?: CustomSize;
  /** 0 = 構成の既定カラム数のまま */
  columns: number;
  /** 章立て構成 */
  structureId: StructureId;
  /** 見出し・本文ファイルの言語 */
  language: WizardLang;
  /** undefined = 構成の既定テーマのまま */
  themePresetId?: string;
  /** 既存フォルダの中に作成してよいか（ウィザードの確認後に true） */
  allowExisting?: boolean;
}

interface BlockSpec {
  id: string;
  title: { ja: string; en: string };
  column: "left" | "right" | "wide";
  order: number;
  height: Record<string, unknown>;
}

interface StructureSpec {
  id: StructureId;
  label: string;
  description: string;
  /** 構成の既定カラム数（columns=0 のとき使用） */
  columns: number;
  blocks: BlockSpec[];
}

const T = {
  background: { ja: "背景", en: "Background" },
  method: { ja: "方法", en: "Method" },
  results: { ja: "結果", en: "Results" },
  discussion: { ja: "考察", en: "Discussion" },
  references: { ja: "引用文献", en: "References" },
  study1: { ja: "研究1", en: "Study 1" },
  study2: { ja: "研究2", en: "Study 2" },
};

/** Two structures the wizard offers (× 日本語 / English). */
export const STRUCTURES: StructureSpec[] = [
  {
    id: "single",
    label: "単一研究",
    description: "背景・方法・結果・考察・引用文献の 2 カラム構成",
    columns: 2,
    blocks: [
      { id: "background", title: T.background, column: "left", order: 1, height: { mode: "auto", min: "120mm" } },
      { id: "method", title: T.method, column: "left", order: 2, height: { mode: "flex", weight: 1 } },
      { id: "results", title: T.results, column: "right", order: 1, height: { mode: "flex", weight: 1, min: "160mm" } },
      { id: "discussion", title: T.discussion, column: "wide", order: 90, height: { mode: "auto", min: "90mm" } },
      { id: "references", title: T.references, column: "wide", order: 100, height: { mode: "auto" } },
    ],
  },
  {
    id: "multi",
    label: "複数研究",
    description: "背景・研究1・研究2・考察・引用文献の 2 カラム構成",
    columns: 2,
    blocks: [
      { id: "background", title: T.background, column: "wide", order: 1, height: { mode: "auto", min: "80mm" } },
      { id: "study1", title: T.study1, column: "left", order: 10, height: { mode: "flex", weight: 1, min: "160mm" } },
      { id: "study2", title: T.study2, column: "right", order: 10, height: { mode: "flex", weight: 1, min: "160mm" } },
      { id: "discussion", title: T.discussion, column: "wide", order: 90, height: { mode: "auto", min: "90mm" } },
      { id: "references", title: T.references, column: "wide", order: 100, height: { mode: "auto" } },
    ],
  },
];

export function findStructure(id: StructureId): StructureSpec {
  return STRUCTURES.find((s) => s.id === id) ?? STRUCTURES[0];
}

/** Build the raw (un-normalized) poster doc object for a structure + language. */
export function buildBaseDoc(structureId: StructureId, language: WizardLang): any {
  const spec = findStructure(structureId);
  return {
    project: {
      title: "（タイトル）",
      poster_size: "A0",
      orientation: "portrait",
      authors: [{ name: "（著者）", affiliation: "（所属）" }],
      content_file: CONTENT_FILE,
    },
    layout: {
      template: "two-column-research",
      margin_mm: 18,
      gap_mm: 8,
      columns: { count: spec.columns, width_mode: "ratio", ratio: [0.5, 0.5], sync_mode: "independent" },
    },
    theme: {
      name: "default",
      font_size: {
        title: "54pt",
        subtitle: "30pt",
        heading1: "34pt",
        heading2: "26pt",
        body: "22pt",
        caption: "16pt",
        references: "14pt",
      },
    },
    blocks: spec.blocks.map((b) => ({
      id: b.id,
      type: "text",
      title: b.title[language],
      source: contentAnchorSource(CONTENT_FILE, b.id),
      column: b.column,
      order: b.order,
      height: b.height,
    })),
    export: {
      pdf: { enabled: true, filename: "exports/poster.pdf" },
      svg: { enabled: true, filename: "exports/poster.svg" },
      pptx: { enabled: true, filename: "exports/poster.pptx" },
      marp: { enabled: true, filename: "exports/poster.marp.md" },
    },
  };
}

/** Windows のフォルダ名として安全な文字だけを許可する． */
export function isValidFolderName(name: string): boolean {
  const n = name.trim();
  if (!n || n.length > 100) return false;
  if (/[\\/:*?"<>|]/.test(n)) return false;
  if (/^\.+$/.test(n) || n.endsWith(".") || n.endsWith(" ")) return false;
  return true;
}

/** equal split summing to exactly 1 (4 decimal places, remainder on the last) */
export function equalRatio(count: number): number[] {
  const r = Math.round(10000 / count) / 10000;
  const ratio = Array.from({ length: count }, () => r);
  ratio[count - 1] = Math.round((1 - r * (count - 1)) * 10000) / 10000;
  return ratio;
}

/** Build the normalized PosterDoc from the wizard inputs. */
export function buildNewDoc(input: NewProjectInput): PosterDoc {
  const raw = buildBaseDoc(input.structureId, input.language);

  raw.project.title = input.title.trim() || raw.project.title || "（タイトル）";
  const subtitle = input.subtitle.trim();
  if (subtitle) raw.project.subtitle = subtitle;
  else delete raw.project.subtitle;

  // authors: legacy {name, affiliation} form — normalizeDoc converts it to the
  // indexed affiliations model
  const authors = input.authors
    .map((a) => ({ name: a.name.trim(), affiliation: a.affiliation.trim() }))
    .filter((a) => a.name);
  if (authors.length > 0) {
    raw.project.authors = authors.map((a) =>
      a.affiliation ? { name: a.name, affiliation: a.affiliation } : { name: a.name },
    );
  }

  const confName = input.conferenceName.trim();
  const confDate = input.conferenceDate.trim();
  if (confName || confDate) {
    raw.project.conference = {
      ...(confName ? { name: confName } : {}),
      ...(confDate ? { date: confDate } : {}),
    };
  }

  raw.project.poster_size = input.posterSize;
  raw.project.orientation = input.orientation;
  if (input.posterSize === "custom" && input.customSize) {
    raw.project.custom_size = { ...input.customSize };
  }

  // columns: 0 = keep the structure's default; otherwise equal split
  if (input.columns > 0 && raw.layout.columns.count !== input.columns) {
    raw.layout.columns.count = input.columns;
    raw.layout.columns.ratio = equalRatio(input.columns);
  }

  // theme preset (着せ替え): same fields ProjectSettings applies
  if (input.themePresetId) {
    const preset = THEME_PRESETS.find((p) => p.id === input.themePresetId);
    if (preset) {
      raw.theme.name = preset.id;
      raw.theme.colors = { ...preset.colors };
      if (preset.font_family) raw.theme.font_family = { ...preset.font_family };
    }
  }

  return normalizeDoc(raw);
}

export interface ScaffoldFile {
  /** path segments relative to the project dir */
  segments: string[];
  content: string;
}

/**
 * Scaffold files for a new project (besides poster.yaml): content stubs for
 * every block source (same convention as `rps init`).
 */
export function scaffoldFiles(doc: PosterDoc, language: WizardLang = "ja"): ScaffoldFile[] {
  const files: ScaffoldFile[] = [];
  const combined: Record<string, string> = {};
  let anyCombined = false;
  const stubFor = (base: string) =>
    language === "en" ? `(Write the body of "${base}" here.)\n` : `（${base} の本文をここに記述）\n`;

  for (const block of flattenBlocks(doc.blocks)) {
    if (!block.source) continue;
    if (splitContentAnchor(block.source)) {
      // single-file mode: collect stubs and emit one content.md below
      combined[block.id] = stubFor(block.title || block.id);
      anyCombined = true;
    } else {
      const segs = block.source.split("/");
      const base = (segs[segs.length - 1] ?? "").replace(/\.md$/, "");
      files.push({ segments: segs, content: stubFor(base) });
    }
  }
  if (anyCombined) {
    for (const [rel, text] of Object.entries(buildCombinedContent(doc, combined))) {
      files.push({ segments: rel.split("/"), content: text });
    }
  }
  return files;
}
