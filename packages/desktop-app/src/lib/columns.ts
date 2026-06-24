// Column option helpers for the GUI: derive the selectable column names from
// the project's column count (1-3 = left/center/right, 4+ = col1..colN) and
// give them Japanese labels.

import { columnOrder, type ColumnName } from "@rps/core";
import { tStatic } from "../i18n";

export function columnLabel(name: ColumnName | string): string {
  switch (name) {
    case "left":
      return tStatic("columns.left");
    case "center":
      return tStatic("columns.center");
    case "right":
      return tStatic("columns.right");
    case "wide":
      return tStatic("columns.wide");
    default: {
      const m = /^col([1-9]\d*)$/.exec(name);
      return m ? tStatic("columns.colN", { n: m[1] }) : name;
    }
  }
}

/** short label for compact buttons (left → 左, col4 → 列4) */
export function columnShortLabel(name: ColumnName | string): string {
  switch (name) {
    case "left":
      return tStatic("columns.left.short");
    case "center":
      return tStatic("columns.center.short");
    case "right":
      return tStatic("columns.right.short");
    case "wide":
      return tStatic("columns.wide.short");
    default: {
      const m = /^col([1-9]\d*)$/.exec(name);
      return m ? tStatic("columns.colN.short", { n: m[1] }) : name;
    }
  }
}

/** selectable columns for a given count, plus "wide" */
export function columnOptions(count: number): ColumnName[] {
  return [...columnOrder(count), "wide"];
}
