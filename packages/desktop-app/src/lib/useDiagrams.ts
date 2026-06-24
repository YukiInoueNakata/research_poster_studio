// Async render cache for ```mermaid / ```dot code blocks in block bodies
// (extracted from App.tsx). renderMarkdown is synchronous, so this scans the
// content, renders diagrams off-thread into a key->SVG cache, and exposes a
// (synchronous) DiagramResolver for the renderer.

import { useCallback, useEffect, useRef, useState } from "react";
import type { DiagramResolver, PosterProject } from "@rps/core";
import { diagramKey, extractDiagramBlocks } from "@rps/core";
import { renderDiagramSvg } from "./figureConvert";

type Translate = (key: string, vars?: Record<string, string | number>) => string;
type Log = (level: "ok" | "info" | "warn" | "error", message: string) => void;

export function useDiagrams(
  project: PosterProject | null,
  t: Translate,
  log: Log,
): DiagramResolver {
  const [diagrams, setDiagrams] = useState<Record<string, string>>({});
  const diagramsRef = useRef(diagrams);
  diagramsRef.current = diagrams;
  const diagramRendering = useRef(new Set<string>());

  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    const specs = Object.values(project.content).flatMap((md) => extractDiagramBlocks(md));
    for (const spec of specs) {
      if (diagramsRef.current[spec.key] !== undefined) continue;
      if (diagramRendering.current.has(spec.key)) continue;
      diagramRendering.current.add(spec.key);
      renderDiagramSvg(spec.kind, spec.code)
        .then((svg) => {
          if (!cancelled) setDiagrams((prev) => ({ ...prev, [spec.key]: svg }));
        })
        .catch((e: any) => {
          const msg = String(e?.message ?? e).split("\n")[0];
          if (!cancelled) {
            setDiagrams((prev) => ({
              ...prev,
              [spec.key]: `<div class="rps-diagram-error">${t("app.diagramSyntaxError", {
                kind: spec.kind === "mermaid" ? "Mermaid" : "Graphviz",
                msg: msg.replace(/</g, "&lt;"),
              })}</div>`,
            }));
            log(
              "warn",
              t("log.diagramRenderFailed", {
                kind: spec.kind === "mermaid" ? "Mermaid" : "Graphviz",
                msg,
              }),
            );
          }
        })
        .finally(() => diagramRendering.current.delete(spec.key));
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.content]);

  return useCallback<DiagramResolver>((kind, code) => diagrams[diagramKey(kind, code)], [diagrams]);
}
