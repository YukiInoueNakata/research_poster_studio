// Citation mode: pandoc-basic in-text citations + reference list generation.
//
// 仕様（2026-06-11 ヒヤリングで確定）:
// - markdown は [@key] のまま保持し，プレビュー / エクスポート時に動的展開する
// - 対応記法は pandoc 基本形のみ: [@key]，[@a; @b]，[-@key]（年のみ），@key（地の文）．
//   ページ番号・接頭辞などの拡張は未対応で，マッチしない角括弧はそのまま残す
// - リストは「引用された文献のみ」を著者アルファベット順（yomi フィールドで
//   和文献を統合ソート．yomi が無い和文献は警告）で生成する
// - DOI/URL の出力はスタイル設定 include_doi（doc.references.include_doi で上書き）
// - スタイルは組込み apa7 / jpa ＋ プロジェクト内 styles/*.yaml のユーザー定義

import type { BibEntry } from "./bibtex";
import { hasJapanese, parseBibAuthors, toInitials } from "./bibtex";
import type { PosterDoc, PosterProject } from "./types";
import { flattenBlocks } from "./layout";

// ---- style model ------------------------------------------------------------

export interface CitationStyleInText {
  /** 単独引用の全体形（任意）例: "（{authors}, {year}）" */
  single?: string;
  /** 複数引用の 1 件分 例: "{authors}, {year}" */
  item: string;
  /** 複数引用全体の囲み 例: "（{items}）" */
  wrap: string;
  /** [-@key]（著者省略）の 1 件分 例: "{year}" */
  year_only: string;
  /** 地の文 @key の形 例: "{authors}（{year}）" */
  narrative: string;
  /** 複数引用の区切り 例: "; " */
  multi_sep: string;
  /** この人数以上で第一著者＋et al./他 に短縮（0 = しない） */
  et_al_min: number;
}

export interface CitationStyle {
  name: string;
  locale: "en" | "ja";
  in_text: CitationStyleInText;
  /** 文献リストのテンプレート（エントリ type 別．"default" がフォールバック） */
  reference: Record<string, string>;
  /** ja スタイルで欧文エントリに使うテンプレート（既定: apa7 の reference） */
  reference_latin?: Record<string, string>;
  sort: "author" | "appearance";
  /** DOI / URL をリストに含めるか（doc.references.include_doi で上書き可） */
  include_doi?: boolean;
  /** 番号引用（Vancouver / IEEE）: 本文 [@key]→[1]，末尾リストは出現順で [n] 前置．
   *  true のとき in_text の著者・年テンプレは使わず番号で描画する（N16）． */
  numeric?: boolean;
}

export interface CitationWarning {
  code: "bib-error" | "unknown-key" | "missing-yomi";
  message: string;
}

// 組込みスタイル．和文・欧文の著者連結（"・"/"他" vs " & "/"et al."）は
// エントリの文字種から自動で切り替えるため，テンプレ側は {authors} だけ書く．
const APA7_REFERENCE: Record<string, string> = {
  article: "{authors} ({year}). {title}. {journal}, {volume}({number}), {pages}. {doi}",
  book: "{authors} ({year}). {title}. {publisher}. {doi}",
  incollection:
    "{authors} ({year}). {title}. In {editor} (Ed.), {booktitle} (pp. {pages}). {publisher}. {doi}",
  inbook:
    "{authors} ({year}). {title}. In {editor} (Ed.), {booktitle} (pp. {pages}). {publisher}. {doi}",
  inproceedings: "{authors} ({year}). {title}. {booktitle}, {pages}. {doi}",
  phdthesis: "{authors} ({year}). {title} [Doctoral dissertation, {school}]. {doi}",
  mastersthesis: "{authors} ({year}). {title} [Master's thesis, {school}]. {doi}",
  techreport: "{authors} ({year}). {title} ({number}). {institution}. {doi}",
  misc: "{authors} ({year}). {title}. {howpublished} {doi}",
  default: "{authors} ({year}). {title}. {doi}",
};

const JPA_REFERENCE: Record<string, string> = {
  article: "{authors}（{year}）．{title}　{journal}，{volume}，{pages}．{doi}",
  book: "{authors}（{year}）．{title}　{publisher}",
  incollection: "{authors}（{year}）．{title}　{editor}（編）{booktitle}（pp. {pages}）　{publisher}",
  inbook: "{authors}（{year}）．{title}　{editor}（編）{booktitle}（pp. {pages}）　{publisher}",
  inproceedings: "{authors}（{year}）．{title}　{booktitle}，{pages}．",
  misc: "{authors}（{year}）．{title}　{howpublished}　{doi}",
  default: "{authors}（{year}）．{title}　{doi}",
};

// 番号引用（IEEE 風）の文献テンプレート．著者は既存の referenceAuthors（APA 形式）を
// 流用する（厳密な IEEE の "A. B. Author" 表記・句読点は将来の精緻化対象）．
const IEEE_REFERENCE: Record<string, string> = {
  article: '{authors}, "{title}," {journal}, vol. {volume}, no. {number}, pp. {pages}, {year}. {doi}',
  inproceedings: '{authors}, "{title}," in {booktitle}, {year}, pp. {pages}. {doi}',
  incollection: '{authors}, "{title}," in {booktitle}, {editor}, Ed. {publisher}, {year}, pp. {pages}. {doi}',
  inbook: '{authors}, "{title}," in {booktitle}, {publisher}, {year}, pp. {pages}. {doi}',
  book: "{authors}, {title}. {publisher}, {year}. {doi}",
  phdthesis: "{authors}, \"{title},\" Ph.D. dissertation, {school}, {year}. {doi}",
  mastersthesis: "{authors}, \"{title},\" M.S. thesis, {school}, {year}. {doi}",
  techreport: "{authors}, \"{title},\" {institution}, Rep. {number}, {year}. {doi}",
  misc: '{authors}, "{title}," {howpublished}, {year}. {doi}',
  default: '{authors}, "{title}," {year}. {doi}',
};

export const BUILTIN_STYLES: Record<string, CitationStyle> = {
  ieee: {
    name: "ieee",
    locale: "en",
    numeric: true,
    in_text: {
      // numeric styles render bracketed numbers; these templates are unused for
      // in-text numbers but kept valid for the shared type.
      item: "{number}",
      wrap: "[{items}]",
      year_only: "{number}",
      narrative: "[{number}]",
      multi_sep: ", ",
      et_al_min: 0,
    },
    reference: IEEE_REFERENCE,
    sort: "appearance",
    include_doi: true,
  },
  apa7: {
    name: "apa7",
    locale: "en",
    in_text: {
      item: "{authors}, {year}",
      wrap: "({items})",
      year_only: "{year}",
      narrative: "{authors} ({year})",
      multi_sep: "; ",
      et_al_min: 3,
    },
    reference: APA7_REFERENCE,
    sort: "author",
    include_doi: true,
  },
  jpa: {
    name: "jpa",
    locale: "ja",
    in_text: {
      item: "{authors}, {year}",
      wrap: "（{items}）",
      year_only: "{year}",
      narrative: "{authors}（{year}）",
      multi_sep: "; ",
      et_al_min: 3,
    },
    reference: JPA_REFERENCE,
    reference_latin: APA7_REFERENCE,
    sort: "author",
    include_doi: true,
  },
};

/** styles/*.yaml のパース済みオブジェクトを CitationStyle に正規化する． */
export function normalizeCitationStyle(raw: any, fallbackName?: string): CitationStyle | null {
  if (raw == null || typeof raw !== "object") return null;
  const locale = raw.locale === "ja" ? "ja" : "en";
  const base = locale === "ja" ? BUILTIN_STYLES.jpa : BUILTIN_STYLES.apa7;
  const name =
    typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : fallbackName;
  if (!name) return null;
  const it = raw.in_text ?? {};
  const str = (v: any, d: string) => (typeof v === "string" ? v : d);
  return {
    name,
    locale,
    in_text: {
      single: typeof it.single === "string" ? it.single : undefined,
      item: str(it.item, base.in_text.item),
      wrap: str(it.wrap, base.in_text.wrap),
      year_only: str(it.year_only, base.in_text.year_only),
      narrative: str(it.narrative, base.in_text.narrative),
      multi_sep: str(it.multi_sep, base.in_text.multi_sep),
      et_al_min:
        typeof it.et_al_min === "number" && it.et_al_min >= 0
          ? Math.floor(it.et_al_min)
          : base.in_text.et_al_min,
    },
    reference:
      raw.reference && typeof raw.reference === "object"
        ? { ...base.reference, ...raw.reference }
        : { ...base.reference },
    reference_latin: locale === "ja" ? { ...APA7_REFERENCE, ...(raw.reference_latin ?? {}) } : undefined,
    sort: raw.sort === "appearance" || raw.numeric === true ? "appearance" : "author",
    include_doi: typeof raw.include_doi === "boolean" ? raw.include_doi : base.include_doi,
    numeric: raw.numeric === true,
  };
}

// ---- entry helpers -----------------------------------------------------------

function entryYear(e: BibEntry): string {
  const y = e.fields.year ?? e.fields.date?.slice(0, 4);
  return y && y.trim() ? y.trim() : "n.d.";
}

/** Is this entry Japanese (by author / title script)? */
export function isJapaneseEntry(e: BibEntry): boolean {
  return hasJapanese(`${e.fields.author ?? ""}${e.fields.title ?? ""}`);
}

/** 本文中の著者表記（第一著者ほか，et al. 短縮込み）． */
function inTextAuthors(e: BibEntry, style: CitationStyle): string {
  const authors = parseBibAuthors(e.fields.author ?? e.fields.editor ?? "");
  if (authors.length === 0) return e.key;
  const ja = hasJapanese(authors[0].family);
  const fams = authors.map((a) => a.family);
  const etAlMin = style.in_text.et_al_min;
  if (etAlMin > 0 && fams.length >= etAlMin) {
    return ja ? `${fams[0]}他` : `${fams[0]} et al.`;
  }
  if (fams.length === 1) return fams[0];
  if (ja) return fams.join("・");
  if (fams.length === 2) return `${fams[0]} & ${fams[1]}`;
  return `${fams.slice(0, -1).join(", ")}, & ${fams[fams.length - 1]}`;
}

/** 文献リストの著者表記（和: 姓名連結を・で接続，欧: Family, I. I. 形式）． */
function referenceAuthors(e: BibEntry): string {
  const authors = parseBibAuthors(e.fields.author ?? e.fields.editor ?? "");
  if (authors.length === 0) return "";
  if (hasJapanese(authors[0].family)) {
    return authors.map((a) => `${a.family}${a.given.replace(/[\s　]+/g, "")}`).join("・");
  }
  const names = authors.map((a) =>
    a.given ? `${a.family}, ${toInitials(a.given)}` : a.family,
  );
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}, & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
}

function fillTemplate(tpl: string, vals: Record<string, string>): string {
  return tpl.replace(/\{([a-z_]+)\}/g, (_, k: string) => vals[k] ?? "");
}

/** Collapse a sorted unique number list into IEEE-style ranges: [1,2,3,5] -> "1–3, 5". */
function collapseRanges(nums: number[]): string {
  const xs = [...new Set(nums)].sort((a, b) => a - b);
  const out: string[] = [];
  let i = 0;
  while (i < xs.length) {
    let j = i;
    while (j + 1 < xs.length && xs[j + 1] === xs[j] + 1) j++;
    out.push(j - i >= 2 ? `${xs[i]}–${xs[j]}` : xs.slice(i, j + 1).join(", "));
    i = j + 1;
  }
  return out.join(", ");
}

/** 空フィールドで残った "()" "，，" などのテンプレ残骸を掃除する． */
function cleanupArtifacts(s: string): string {
  let prev = "";
  let out = s;
  while (out !== prev) {
    prev = out;
    out = out
      .replace(/\(\s*\)/g, "")
      .replace(/（\s*）/g, "")
      .replace(/(?:pp|vol|no)\.\s*(?=[).，．,;；]|$)/g, "")
      .replace(/,\s*(?=[,.;．，；)])/g, "")
      .replace(/，\s*(?=[，．；)）])/g, "")
      .replace(/\.\s+\./g, ".")
      .replace(/．\s*．/g, "．")
      .replace(/；\s*(?=[；．])/g, "")
      .replace(/^[\s,，;；.．]+/, "");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

/** 1 エントリ分の文献リスト文字列を作る． */
export function formatReference(
  e: BibEntry,
  style: CitationStyle,
  includeDoi: boolean,
): string {
  const ja = isJapaneseEntry(e);
  const templates =
    style.locale === "ja" && !ja
      ? style.reference_latin ?? APA7_REFERENCE
      : style.reference;
  const tpl = templates[e.type] ?? templates.default ?? "{authors} ({year}). {title}.";
  const f = e.fields;
  const doiRaw = f.doi?.trim();
  const urlRaw = f.url?.trim();
  const doi = includeDoi
    ? doiRaw
      ? /^https?:\/\//i.test(doiRaw)
        ? doiRaw
        : `https://doi.org/${doiRaw}`
      : urlRaw ?? ""
    : "";
  const vals: Record<string, string> = {
    authors: referenceAuthors(e),
    year: entryYear(e),
    title: f.title ?? "",
    journal: f.journal ?? f.journaltitle ?? "",
    volume: f.volume ?? "",
    number: f.number ?? "",
    pages: (f.pages ?? "").replace(/--/g, "–"),
    publisher: f.publisher ?? "",
    address: f.address ?? "",
    editor: f.editor ?? "",
    booktitle: f.booktitle ?? "",
    edition: f.edition ?? "",
    school: f.school ?? "",
    institution: f.institution ?? "",
    howpublished: f.howpublished ?? "",
    note: f.note ?? "",
    doi,
    url: includeDoi ? urlRaw ?? "" : "",
  };
  return cleanupArtifacts(fillTemplate(tpl, vals));
}

// ---- in-text expansion -------------------------------------------------------

// pandoc の引用キー: 英数字で始まり，内部の . / : は次が英数字のときだけ許す
const KEY = "[A-Za-z0-9_](?:[A-Za-z0-9_-]|[.:](?=[A-Za-z0-9_]))*";
// one citation item: optional prefix text, optional "-" (year-only), @key, and
// an optional locator/suffix (pandoc extended notation: [see @key, pp. 4-6]).
const RE_ITEM = new RegExp(`^(?<prefix>[^@]*?)(?<sign>-)?@(?<key>${KEY})(?<suffix>.*)$`);
const RE_BRACKET = /\[([^\][]*)\]/g;
const RE_NARRATIVE = new RegExp(`(?<![\\w@.\\]])@(${KEY})`, "g");

// markdown のコード・URL・リンク先は引用展開の対象外（proofread と同方針）
const PROTECTED: RegExp[] = [
  /```[\s\S]*?```/g,
  /`[^`\n]+`/g,
  /\]\([^)\n]*\)/g,
  /https?:\/\/[^\s)]+/g,
];

/** PROTECTED にかからない部分にだけ fn を適用する． */
function mapUnprotectedText(text: string, fn: (seg: string) => string): string {
  const ranges: Array<[number, number]> = [];
  for (const re of PROTECTED) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) ranges.push([m.index, m.index + m[0].length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  let out = "";
  let pos = 0;
  for (const [s, e] of ranges) {
    if (s < pos) {
      pos = Math.max(pos, e);
      continue;
    }
    out += fn(text.slice(pos, s)) + text.slice(s, e);
    pos = e;
  }
  return out + fn(text.slice(pos));
}

export interface ExpandResult {
  text: string;
  /** 参照されたキー（未知キー含む，出現順・重複なし） */
  citedKeys: string[];
  /** bib に無いキー */
  unknownKeys: string[];
}

/**
 * pandoc 基本形の引用を展開する．[@a; @b] / [-@a] / 地の文 @a．
 * 角括弧の中身が基本形にマッチしない場合（拡張記法など）はそのまま残す．
 */
export function expandCitations(
  text: string,
  entries: Map<string, BibEntry>,
  style: CitationStyle,
  /** numeric styles (N16): maps a key to its 1-based citation number */
  numberOf?: (key: string) => number | undefined,
): ExpandResult {
  const cited: string[] = [];
  const unknown: string[] = [];
  const seen = new Set<string>();
  const note = (key: string, known: boolean) => {
    if (seen.has(key)) return;
    seen.add(key);
    cited.push(key);
    if (!known) unknown.push(key);
  };

  // one item: prefix (e.g. "see ") + author/year (or year-only) + locator/suffix
  // (e.g. ", pp. 4-6"). prefix / suffix are passed through verbatim.
  const renderItem = (prefix: string, sign: string | undefined, key: string, suffix: string): string => {
    const e = entries.get(key);
    note(key, !!e);
    const core = e
      ? fillTemplate(sign === "-" ? style.in_text.year_only : style.in_text.item, {
          authors: inTextAuthors(e, style),
          year: entryYear(e),
        })
      : `@${key}?`;
    const pre = prefix.trim() ? `${prefix.trim()} ` : "";
    let suf = suffix.trim();
    if (suf && !/^[,，]/.test(suf)) suf = `, ${suf}`;
    return `${pre}${core}${suf}`;
  };

  // 地の文 @key（著者（年）形式）．角括弧の外側にだけ適用する
  const narrate = (s: string): string =>
    s.replace(RE_NARRATIVE, (_whole, key: string) => {
      const e = entries.get(key);
      note(key, !!e);
      if (style.numeric) {
        if (!e) return `[?]`;
        return `[${numberOf?.(key) ?? "?"}]`;
      }
      if (!e) return `@${key}?`;
      return fillTemplate(style.in_text.narrative, {
        authors: inTextAuthors(e, style),
        year: entryYear(e),
      });
    });

  // 角括弧引用 1 つ分．基本形にマッチしなければ null（拡張記法はそのまま残す）
  const expandBracket = (inner: string): string | null => {
    if (!inner.includes("@")) return null;
    const parts = inner.split(";").map((p) => p.trim());
    const matches = parts.map((p) => RE_ITEM.exec(p));
    if (parts.length === 0 || matches.some((m) => !m)) return null;
    const grp = (m: RegExpExecArray) => m.groups!;
    if (style.numeric) {
      const nums: number[] = [];
      for (const m of matches) {
        const key = grp(m!).key;
        note(key, !!entries.get(key));
        const n = numberOf?.(key);
        if (n != null) nums.push(n);
      }
      return `[${nums.length ? collapseRanges(nums) : "?"}]`;
    }
    const hasExtra = matches.some((m) => grp(m!).prefix.trim() || grp(m!).suffix.trim());
    const items = matches.map((m) =>
      renderItem(grp(m!).prefix, grp(m!).sign, grp(m!).key, grp(m!).suffix),
    );
    // narrative single form (e.g. "Smith (2020)") only without prefix/suffix
    if (parts.length === 1 && !grp(matches[0]!).sign && !hasExtra && style.in_text.single) {
      const e = entries.get(grp(matches[0]!).key);
      if (e) {
        return fillTemplate(style.in_text.single, {
          authors: inTextAuthors(e, style),
          year: entryYear(e),
        });
      }
    }
    return fillTemplate(style.in_text.wrap, { items: items.join(style.in_text.multi_sep) });
  };

  const expandSeg = (seg: string): string => {
    // 角括弧を区切りに走査し，narrative 置換は角括弧の外にだけかける
    // （マッチしない拡張記法の中身まで展開しないため）
    let out = "";
    let pos = 0;
    RE_BRACKET.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RE_BRACKET.exec(seg))) {
      out += narrate(seg.slice(pos, m.index));
      // 直後が "(" なら markdown リンク（保護範囲外に来た場合の保険）
      const isLink = seg[m.index + m[0].length] === "(";
      const replaced = isLink ? null : expandBracket(m[1]);
      out += replaced ?? m[0];
      pos = m.index + m[0].length;
    }
    out += narrate(seg.slice(pos));
    return out;
  };

  return { text: mapUnprotectedText(text, expandSeg), citedKeys: cited, unknownKeys: unknown };
}

/** 展開せずにキーだけ集める（リスト生成・警告用）． */
export function collectCitedKeys(text: string, entries: Map<string, BibEntry>): ExpandResult {
  return expandCitations(text, entries, BUILTIN_STYLES.apa7); // text は捨てる
}

// ---- reference list ----------------------------------------------------------

/** ソートキー: 欧文は著者表記，和文は yomi（無ければ警告して著者表記）． */
function sortKeyFor(e: BibEntry, warnings: CitationWarning[]): string {
  const yomi = e.fields.yomi?.trim();
  if (isJapaneseEntry(e)) {
    if (yomi && !hasJapanese(yomi)) return yomi.toLowerCase();
    warnings.push({
      code: "missing-yomi",
      message: `和文献 ${e.key} に yomi（アルファベット表記）がないため統合ソートが不正確です`,
    });
    return (yomi ?? referenceAuthors(e) ?? e.key).toLowerCase();
  }
  return referenceAuthors(e).toLowerCase();
}

export interface ReferenceListResult {
  /** 整形済み文献（表示順） */
  items: string[];
  warnings: CitationWarning[];
}

/** 引用されたキーから文献リストを作る（style.sort に従い著者順／出現順）． */
export function buildReferenceList(
  citedKeys: string[],
  entries: Map<string, BibEntry>,
  style: CitationStyle,
  includeDoi: boolean,
): ReferenceListResult {
  const warnings: CitationWarning[] = [];
  const cited = citedKeys
    .map((k) => entries.get(k))
    .filter((e): e is BibEntry => !!e);
  let ordered = cited;
  if (style.sort === "author" && !style.numeric) {
    ordered = cited
      .map((e) => ({ e, k: `${sortKeyFor(e, warnings)} ${entryYear(e)}` }))
      .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
      .map((x) => x.e);
  }
  const items = ordered.map((e) => formatReference(e, style, includeDoi));
  // numeric styles (N16): appearance order + [n] prefix; numbers match the
  // in-text [n] (both count existing cited keys in first-appearance order).
  return {
    items: style.numeric ? items.map((s, i) => `[${i + 1}] ${s}`) : items,
    warnings,
  };
}

// ---- project-level preparation -------------------------------------------------

export interface CitationPrep {
  /** bib が読み込まれているか（false のとき expand は素通し） */
  active: boolean;
  style: CitationStyle;
  includeDoi: boolean;
  /** 本文 markdown / キャプションの引用を展開する */
  expand: (text: string) => string;
  /** 引用された文献のみの整形済みリスト */
  referenceItems: string[];
  warnings: CitationWarning[];
}

/** doc.references.style とユーザースタイルから使用スタイルを解決する． */
export function resolveCitationStyle(
  doc: PosterDoc,
  userStyles?: Record<string, CitationStyle>,
): CitationStyle {
  const name = doc.references?.style ?? "apa7";
  return userStyles?.[name] ?? BUILTIN_STYLES[name] ?? BUILTIN_STYLES.apa7;
}

/**
 * レンダラ用の引用コンテキストを作る．全ブロック本文＋図キャプションを
 * 走査して cited keys を集め，リストと警告をまとめて返す．
 */
export function prepareCitations(project: PosterProject): CitationPrep {
  const style = resolveCitationStyle(project.doc, project.citationStyles);
  const includeDoi = project.doc.references?.include_doi ?? style.include_doi ?? true;
  const entries = new Map((project.bib ?? []).map((e) => [e.key, e]));
  const active = project.bib != null;
  if (!active) {
    return {
      active,
      style,
      includeDoi,
      expand: (t) => t,
      referenceItems: [],
      warnings: [],
    };
  }

  const warnings: CitationWarning[] = (project.bibErrors ?? []).map((m) => ({
    code: "bib-error" as const,
    message: m,
  }));

  // collect cited keys over all bodies (reading-ish order) + captions
  const citedKeys: string[] = [];
  const seen = new Set<string>();
  const collect = (text: string | undefined) => {
    if (!text) return;
    const r = expandCitations(text, entries, style);
    for (const k of r.citedKeys) {
      if (!seen.has(k)) {
        seen.add(k);
        citedKeys.push(k);
      }
    }
    for (const k of r.unknownKeys) {
      warnings.push({
        code: "unknown-key",
        message: `bib に無い引用キーです: @${k}`,
      });
    }
  };
  for (const b of flattenBlocks(project.doc.blocks)) collect(project.content[b.id]);
  for (const f of project.doc.figures) collect(f.caption);

  // numeric styles (N16): number existing cited keys 1..n in first-appearance
  // order; the in-text [n] and the [n] list prefix both derive from this.
  const numberMap = new Map<string, number>();
  if (style.numeric) {
    let n = 0;
    for (const k of citedKeys) if (entries.has(k)) numberMap.set(k, ++n);
  }
  const numberOf = (k: string) => numberMap.get(k);

  const list = buildReferenceList(citedKeys, entries, style, includeDoi);
  warnings.push(...list.warnings);

  return {
    active,
    style,
    includeDoi,
    expand: (t) => expandCitations(t, entries, style, numberOf).text,
    referenceItems: list.items,
    warnings,
  };
}
