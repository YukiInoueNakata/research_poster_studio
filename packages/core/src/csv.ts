// Minimal RFC 4180 CSV parser for the簡易表生成 feature (設計書 §10.1).
// Quoted fields, escaped quotes (""), CRLF / LF line endings. No streaming —
// poster tables are small.

/** Parse CSV text into rows of cells. Empty trailing line is dropped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, ""); // strip BOM

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // drop a trailing fully-empty row (file ending with a newline)
  if (rows.length > 0 && rows[rows.length - 1].every((c) => c === "")) {
    rows.pop();
  }
  return rows;
}

/** Decode the text payload of a base64 data URI (browser and Node). */
export function dataUriToText(uri: string): string {
  const m = uri.match(/^data:[^,]*;base64,(.*)$/s);
  if (!m) {
    const comma = uri.indexOf(",");
    return comma >= 0 ? decodeURIComponent(uri.slice(comma + 1)) : "";
  }
  const bin = atob(m[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

/** Encode text as a base64 data URI (browser and Node, UTF-8 safe). */
export function textToDataUri(text: string, mime: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return `data:${mime};base64,${btoa(bin)}`;
}
