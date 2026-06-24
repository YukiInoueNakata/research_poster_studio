// Format package (フォーマットパッケージ): export / import the poster's look
// and structure as a single shareable YAML file.
//
// Included sections (2026-06 仕様ヒヤリング):
//   - theme     : フォント・フォントサイズ・配色・文字組み・背景設定
//   - layout    : カラム構成・余白・gap
//   - header    : ヘッダー体裁（配置・枠線・要素別サイズ・ロゴ）．著者名等の内容は含めない
//   - structure : ブロックの骨組み（タイトル・配置・順序・高さ・スタイル）．本文 markdown は含めない
// Citation styles are NOT packaged — distribute styles/*.yaml files directly.
// Images referenced by theme.background / header.logos are embedded as data
// URIs (`assets`) and written back into figures/ on import.

import type {
  Block,
  FigureAsset,
  HeaderConfig,
  Layout,
  PosterDoc,
  Theme,
} from "./types";
import { flattenBlocks } from "./layout";

export const FORMAT_PACKAGE_VERSION = 1;

export interface FormatAsset {
  /** filename under figures/ (basename only — no directories) */
  name: string;
  /** image content as a data URI */
  data: string;
}

export interface FormatPackage {
  /** format marker + version; presence identifies a format package YAML */
  rps_format: number;
  /** display name (defaults to the theme name on export) */
  name?: string;
  theme?: Theme;
  layout?: Layout;
  header?: HeaderConfig;
  /** block skeleton without body markdown / figure bindings */
  structure?: { blocks: Block[] };
  /** embedded images (background / logos) */
  assets?: FormatAsset[];
}

/** which sections of a package to apply on import */
export interface FormatSections {
  theme: boolean;
  layout: boolean;
  header: boolean;
  structure: boolean;
}

export interface FormatApplyResult {
  doc: PosterDoc;
  /** package assets referenced by the applied sections — write into figures/ */
  assets: FormatAsset[];
  warnings: string[];
}

const clone = <T>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));

const basename = (p: string): string => p.replace(/\\/g, "/").split("/").pop() ?? p;

/** Is this parsed YAML a format package (vs. a poster.yaml)? */
export function isFormatPackage(raw: unknown): raw is FormatPackage {
  return (
    !!raw &&
    typeof raw === "object" &&
    typeof (raw as any).rps_format === "number"
  );
}

/**
 * Strip a block tree down to its reusable skeleton: figure blocks (bound to
 * figures that won't exist in the target project) are dropped, and `source` /
 * figure bindings are removed. Body markdown is never included.
 */
function stripBlocks(blocks: Block[]): Block[] {
  return blocks
    .filter((b) => b.type !== "figure")
    .map((b) => {
      const nb = clone(b);
      nb.source = undefined;
      nb.figure_id = undefined;
      nb.figures = undefined;
      nb.children = b.children?.length ? stripBlocks(b.children) : undefined;
      if (nb.children && nb.children.length === 0) nb.children = undefined;
      return nb;
    });
}

/**
 * Build a format package from the current document. `figureAssets` (the
 * project's loaded figure files, keyed by id and filename) provides the data
 * URIs for embedded images; pass undefined to skip embedding.
 */
export function buildFormatPackage(
  doc: PosterDoc,
  figureAssets?: Record<string, FigureAsset>,
  name?: string,
): FormatPackage {
  const assets = new Map<string, string>();
  const addAsset = (path: string): string => {
    const base = basename(path);
    const a =
      figureAssets?.[base] ??
      Object.values(figureAssets ?? {}).find((f) => f.name === base);
    if (a?.dataUri) assets.set(base, a.dataUri);
    return base;
  };

  const theme = clone(doc.theme);
  if (theme.background?.image) {
    theme.background = { ...theme.background, image: addAsset(theme.background.image) };
  }

  const header = clone(doc.header ?? {});
  if (header.logos?.length) {
    header.logos = header.logos.map((l) => ({ ...l, path: addAsset(l.path) }));
  }

  return {
    rps_format: FORMAT_PACKAGE_VERSION,
    name: name ?? doc.theme.name,
    theme,
    layout: clone(doc.layout),
    header,
    structure: { blocks: stripBlocks(doc.blocks) },
    assets:
      assets.size > 0
        ? [...assets].map(([n, data]) => ({ name: n, data }))
        : undefined,
  };
}

/**
 * Apply the selected sections of a package onto a document. Pure — returns a
 * new doc plus the embedded assets the applied sections reference (the caller
 * writes them into figures/) and human-readable warnings.
 *
 * Structure import replaces `doc.blocks` with the package skeleton:
 * - blocks whose id matches an existing block keep that block's `source`
 *   (so their body text survives a re-import)
 * - other text blocks get a fresh `content/<id>.md` source
 * - figures whose owning block disappeared are detached (with a warning);
 *   full-width / column figures are re-attached by the normalize sync passes
 */
export function applyFormatPackage(
  doc: PosterDoc,
  pkg: FormatPackage,
  sections: FormatSections,
): FormatApplyResult {
  const next: PosterDoc = clone(doc);
  const warnings: string[] = [];
  const byName = new Map((pkg.assets ?? []).map((a) => [a.name, a]));
  const used = new Map<string, FormatAsset>();
  const assetRef = (name: string): string => {
    const base = basename(name);
    const a = byName.get(base);
    if (a) used.set(base, a);
    else {
      warnings.push(
        `画像 ${base} はパッケージに含まれていません（figures/ に手動で配置してください）`,
      );
    }
    return `figures/${base}`;
  };

  if (sections.theme && pkg.theme) {
    next.theme = clone(pkg.theme);
    if (next.theme.background?.image) {
      next.theme.background.image = assetRef(next.theme.background.image);
    }
  }
  if (sections.layout && pkg.layout) {
    next.layout = clone(pkg.layout);
  }
  if (sections.header && pkg.header) {
    next.header = clone(pkg.header);
    if (next.header.logos?.length) {
      next.header.logos = next.header.logos.map((l) => ({ ...l, path: assetRef(l.path) }));
    }
  }
  if (sections.structure && pkg.structure?.blocks) {
    const oldById = new Map(flattenBlocks(doc.blocks).map((b) => [b.id, b]));
    const safeId = (id: string) => id.replace(/[^A-Za-z0-9_-]/g, "_");
    const blocks = stripBlocks(clone(pkg.structure.blocks)); // defensive re-strip
    const assignSources = (bs: Block[]) => {
      for (const b of bs) {
        if (b.children?.length) {
          assignSources(b.children);
        } else if (b.type !== "figure") {
          b.source = oldById.get(b.id)?.source ?? `content/${safeId(b.id)}.md`;
        }
      }
    };
    assignSources(blocks);
    next.blocks = blocks;
    // detach figures whose owning block no longer exists
    const ids = new Set(flattenBlocks(blocks).map((b) => b.id));
    for (const f of next.figures) {
      if (f.block && !ids.has(f.block)) {
        f.block = undefined;
        warnings.push(
          `図 ${f.id} の所属ブロックが無くなったため解除しました（図の設定で再割り当てしてください）`,
        );
      }
    }
  }

  return { doc: next, assets: [...used.values()], warnings };
}
