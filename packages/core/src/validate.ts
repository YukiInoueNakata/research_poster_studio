// High-level validation + layout API (DOM-free).

import yaml from "js-yaml";
import type { PosterDoc } from "./types";
import { normalizeDoc } from "./normalize";
import { computeBands, type Band } from "./layout";
import { docWarnings, type Warning } from "./warnings";
import { posterSizeMm } from "./units";
import { posterSchema } from "./schema";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: Warning[];
  doc: PosterDoc;
}

/** Validate an already-parsed object. */
export function validatePoster(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const parsed = posterSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
  }
  // normalizeDoc is tolerant and always yields a renderable doc
  const doc = normalizeDoc(raw);
  const warnings = docWarnings(doc);
  return { ok: errors.length === 0, errors, warnings, doc };
}

/** Validate raw poster.yaml text. */
export function validatePosterYaml(text: string): ValidationResult {
  let raw: unknown;
  try {
    raw = yaml.load(text);
  } catch (e: any) {
    return {
      ok: false,
      errors: [`YAML parse error: ${e?.message ?? e}`],
      warnings: [],
      doc: normalizeDoc({}),
    };
  }
  return validatePoster(raw);
}

export interface LayoutResult {
  paper: { w: number; h: number };
  bands: Band[];
}

/** Compute paper size (mm) and the band layout for a normalized document. */
export function calculateLayout(doc: PosterDoc): LayoutResult {
  return {
    paper: posterSizeMm(doc.project),
    bands: computeBands(doc),
  };
}
