# Create a poster

Given the research content the user provides:

1. Decide the poster type (quantitative / qualitative / mixed-methods /
   multi-study / method-tool / activity-report) and explain the choice in one
   line.
2. Copy the matching `templates/*.yaml` into the project root as `poster.yaml`.
3. Fill `project` (title, authors, conference, size A0/A1) and adjust `blocks`
   to match the actual sections.
4. Write each block's `content/*.md` from the user's material. Keep body text
   ≤ ~140 words per block; use lists and `**bold**` for key results.
5. Declare every figure under `figures:` with a unique `id` and a `caption`.
6. Validate against `schema/poster.schema.json` and list remaining warnings.
7. Do NOT touch anything under `exports/`.

Report: created/changed files, the chosen type, and remaining warnings.
