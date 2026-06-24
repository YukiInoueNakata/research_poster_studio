// Zod schema for poster.yaml. Intentionally permissive — `normalizeDoc` fills
// defaults, so this catches gross structural errors and bad enum values while
// allowing partial / Agent-generated documents.

import { z } from "zod";

const hAlign = z.enum(["left", "center", "right"]);

const author = z
  .object({
    name: z.string().optional(),
    affiliation: z.string().optional(),
    affiliations: z.array(z.number()).optional(),
  })
  .passthrough();

const projectMeta = z
  .object({
    title: z.string({ required_error: "project.title は必須です" }),
    subtitle: z.string().optional(),
    authors: z.array(author).optional(),
    affiliations: z.array(z.string()).optional(),
    affiliation_line_breaks: z.array(z.number()).optional(),
    conference: z
      .object({ name: z.string().optional(), date: z.string().optional() })
      .passthrough()
      .optional(),
    poster_size: z.enum(["A0", "A1", "A2", "36x48in", "42x56in", "48x96in", "custom"]),
    orientation: z.enum(["portrait", "landscape"]),
    // custom dimensions; normalizeDoc also accepts width/height strings with units
    custom_size: z
      .object({
        width_mm: z.number().positive().optional(),
        height_mm: z.number().positive().optional(),
        width: z.union([z.string(), z.number()]).optional(),
        height: z.union([z.string(), z.number()]).optional(),
      })
      .passthrough()
      .optional(),
    units: z.enum(["mm", "in"]).optional(),
    content_file: z.string().optional(),
  })
  .passthrough();

// left / center / right / wide, or col1..colN (4+ columns)
const columnName = z
  .string()
  .regex(/^(left|center|right|wide|col[1-9]\d*)$/, {
    message: "column は left / center / right / wide / colN のいずれかです",
  });

const blockHeight = z
  .object({
    mode: z.enum(["auto", "fixed", "flex", "locked"]),
    value: z.string().optional(),
    min: z.string().optional(),
    max: z.string().optional(),
    weight: z.number().optional(),
  })
  .passthrough();

const block = z
  .object({
    id: z.string().optional(),
    type: z.enum(["text", "figure", "mixed"]).optional(),
    title: z.string().optional(),
    source: z.string().optional(),
    column: columnName.optional(),
    order: z.number().optional(),
    visible: z.boolean().optional(),
    height: blockHeight.optional(),
    pin_bottom: z.boolean().optional(),
    style: z.record(z.any()).optional(),
    figures: z.array(z.string()).optional(),
    overflow: z.object({ action: z.enum(["warn", "clip", "scroll"]) }).optional(),
    // nested child blocks (validated loosely; normalizeDoc recurses)
    children: z.array(z.any()).optional(),
  })
  .passthrough();

const figure = z
  .object({
    id: z.string({ required_error: "figure.id は必須です" }),
    path: z.string({ required_error: "figure.path は必須です" }),
    images: z.array(z.string()).optional(),
    gallery_columns: z.number().optional(),
    caption: z.string().optional(),
    placement: z.enum(["inside-block", "full-width", "column"]).optional(),
    block: z.string().optional(),
    column: columnName.optional(),
    order: z.number().optional(),
    scale: z.number().optional(),
    align: hAlign.optional(),
    crop: z.record(z.any()).optional(),
    style: z.record(z.any()).optional(),
  })
  .passthrough();

export const posterSchema = z
  .object({
    project: projectMeta,
    layout: z.record(z.any()).optional(),
    theme: z.record(z.any()).optional(),
    header: z.record(z.any()).optional(),
    blocks: z.array(block).optional(),
    figures: z.array(figure).optional(),
    export: z.record(z.any()).optional(),
  })
  .passthrough();

export type PosterSchemaInput = z.infer<typeof posterSchema>;
