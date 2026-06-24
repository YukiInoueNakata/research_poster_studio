// Minimal BibTeX parser for the citation mode (設計書外・2026-06 仕様ヒヤリング).
//
// Supports the common subset: `@type{key, field = {...} / "..." / bare, ...}`.
// Not supported (skipped with a note in `errors`): @string / @preamble,
// crossref resolution, LaTeX macro expansion. Brace-protected text keeps its
// content (braces are stripped).

export interface BibEntry {
  /** citation key as written in the .bib file */
  key: string;
  /** entry type, lowercased ("article", "book", ...) */
  type: string;
  /** field values keyed by lowercased field name, braces stripped */
  fields: Record<string, string>;
}

export interface BibParseResult {
  entries: BibEntry[];
  errors: string[];
}

/** Strip outer/protection braces and normalize whitespace / simple LaTeX. */
function cleanValue(v: string): string {
  return v
    .replace(/[{}]/g, "")
    .replace(/\\&/g, "&")
    .replace(/\\%/g, "%")
    .replace(/~/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse a BibTeX string into entries. Tolerant: bad entries are skipped. */
export function parseBibtex(text: string): BibParseResult {
  const entries: BibEntry[] = [];
  const errors: string[] = [];
  const src = text ?? "";
  let i = 0;

  const skipWs = () => {
    while (i < src.length && /\s/.test(src[i])) i++;
  };

  while (i < src.length) {
    const at = src.indexOf("@", i);
    if (at < 0) break;
    // % line comment (outside entries): an @ preceded by % on the same line
    // is comment text, not an entry start. Skip to the end of the line.
    const lineStart = src.lastIndexOf("\n", at - 1) + 1;
    const pct = src.indexOf("%", lineStart);
    if (pct >= 0 && pct < at) {
      const eol = src.indexOf("\n", at);
      if (eol < 0) break;
      i = eol + 1;
      continue;
    }
    i = at + 1;

    // entry type
    const typeMatch = /^[A-Za-z]+/.exec(src.slice(i));
    if (!typeMatch) continue;
    const type = typeMatch[0].toLowerCase();
    i += typeMatch[0].length;
    skipWs();

    if (type === "comment") continue; // body ignored (scan continues at next @)
    const open = src[i];
    if (open !== "{" && open !== "(") {
      errors.push(`@${type}: 開き括弧がありません（位置 ${at}）`);
      continue;
    }
    const close = open === "{" ? "}" : ")";
    i++;

    if (type === "string" || type === "preamble") {
      errors.push(`@${type} は未対応のため読み飛ばしました`);
      // skip to the matching close brace
      let depth = 1;
      while (i < src.length && depth > 0) {
        if (src[i] === open) depth++;
        else if (src[i] === close) depth--;
        i++;
      }
      continue;
    }

    // citation key
    skipWs();
    const keyMatch = /^[^,\s{}()]+/.exec(src.slice(i));
    if (!keyMatch) {
      errors.push(`@${type}: 引用キーが読めません（位置 ${at}）`);
      continue;
    }
    const key = keyMatch[0];
    i += key.length;
    skipWs();
    if (src[i] === ",") i++;

    // fields
    const fields: Record<string, string> = {};
    let ok = true;
    for (;;) {
      skipWs();
      if (i >= src.length) {
        errors.push(`@${type}{${key}}: エントリが閉じていません`);
        ok = false;
        break;
      }
      if (src[i] === close) {
        i++;
        break;
      }
      const nameMatch = /^[A-Za-z][A-Za-z0-9_-]*/.exec(src.slice(i));
      if (!nameMatch) {
        errors.push(`@${type}{${key}}: フィールド名が読めません`);
        ok = false;
        break;
      }
      const fname = nameMatch[0].toLowerCase();
      i += nameMatch[0].length;
      skipWs();
      if (src[i] !== "=") {
        errors.push(`@${type}{${key}}: ${fname} の = がありません`);
        ok = false;
        break;
      }
      i++;
      skipWs();

      let value = "";
      if (src[i] === "{") {
        // balanced-brace value
        let depth = 1;
        i++;
        const start = i;
        while (i < src.length && depth > 0) {
          if (src[i] === "{") depth++;
          else if (src[i] === "}") depth--;
          if (depth > 0) i++;
        }
        value = src.slice(start, i);
        i++; // closing }
      } else if (src[i] === '"') {
        i++;
        const start = i;
        while (i < src.length && src[i] !== '"') {
          if (src[i] === "{") {
            // braces inside quotes protect a quote character
            let depth = 1;
            i++;
            while (i < src.length && depth > 0) {
              if (src[i] === "{") depth++;
              else if (src[i] === "}") depth--;
              i++;
            }
            continue;
          }
          i++;
        }
        value = src.slice(start, i);
        i++; // closing "
      } else {
        // bare value (number / macro name) up to , or close
        const start = i;
        while (i < src.length && src[i] !== "," && src[i] !== close) i++;
        value = src.slice(start, i);
      }
      fields[fname] = cleanValue(value);
      skipWs();
      if (src[i] === ",") i++;
    }
    if (ok) {
      if (entries.some((e) => e.key === key)) {
        errors.push(`引用キーが重複しています: ${key}（後のエントリを無視）`);
      } else {
        entries.push({ key, type, fields });
      }
    }
  }

  return { entries, errors };
}

// ---- author names ----------------------------------------------------------

export interface BibAuthor {
  /** family name (姓) */
  family: string;
  /** given name(s) (名)．空のことがある */
  given: string;
}

const CJK_RE = /[぀-ヿ一-鿿]/;

/** Does the string contain Japanese (kana/kanji) characters? */
export function hasJapanese(s: string): boolean {
  return CJK_RE.test(s ?? "");
}

/**
 * Split a BibTeX author field ("A and B and C") into structured names.
 * "Last, First" is preferred; without a comma, latin names take the last
 * token as family, Japanese names take the FIRST token as family (姓 名).
 */
export function parseBibAuthors(field: string): BibAuthor[] {
  const parts = (field ?? "")
    .split(/\s+and\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.map((p) => {
    const comma = p.indexOf(",");
    if (comma >= 0) {
      return { family: p.slice(0, comma).trim(), given: p.slice(comma + 1).trim() };
    }
    const toks = p.split(/[\s　]+/).filter(Boolean);
    if (toks.length <= 1) return { family: p, given: "" };
    if (hasJapanese(p)) {
      // Japanese order: 姓 名
      return { family: toks[0], given: toks.slice(1).join(" ") };
    }
    return { family: toks[toks.length - 1], given: toks.slice(0, -1).join(" ") };
  });
}

/** "Yuki Inoue" -> "Y. I." (latin given names to initials). */
export function toInitials(given: string): string {
  return (given ?? "")
    .split(/[\s.\-]+/)
    .filter(Boolean)
    .map((t) => `${t[0].toUpperCase()}.`)
    .join(" ");
}
