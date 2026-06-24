import { useState } from "react";
import type { Block, ColumnName, Figure, PosterProject } from "@rps/core";
import { columnOrder, HEADER_ID, posterSizeLabel } from "@rps/core";
import { columnShortLabel } from "../lib/columns";
import { useLang } from "../i18n";

interface Props {
  project: PosterProject;
  selectedBlockId: string | null;
  selectedIds: string[];
  selectedFigureId: string | null;
  onSelectBlock: (id: string, e?: React.MouseEvent) => void;
  onSelectFigure: (id: string) => void;
  onAddBlock: (column: ColumnName) => void;
  onAddFigure: (parentId: string | null, src: "file" | "clipboard") => void;
}

export default function ProjectTree({
  project,
  selectedBlockId,
  selectedIds,
  selectedFigureId,
  onSelectBlock,
  onSelectFigure,
  onAddBlock,
  onAddFigure,
}: Props) {
  const { t } = useLang();
  const { doc } = project;
  const sel = new Set(selectedIds);
  const [menu, setMenu] = useState<{ x: number; y: number; blockId: string } | null>(null);

  const figuresForBlock = (b: Block): Figure[] =>
    doc.figures
      .filter((f) => f.block === b.id || (b.figures ?? []).includes(f.id))
      .sort((a, c) => (a.order ?? 0) - (c.order ?? 0));

  const assignedFigIds = new Set(
    doc.figures
      .filter((f) => doc.blocks.length && figureBelongsToAnyBlock(f))
      .map((f) => f.id),
  );
  function figureBelongsToAnyBlock(f: Figure): boolean {
    // f is owned if any block references it
    const ownerById = (blocks: Block[]): boolean =>
      blocks.some(
        (b) =>
          f.block === b.id ||
          (b.figures ?? []).includes(f.id) ||
          (b.children ? ownerById(b.children) : false),
      );
    return ownerById(doc.blocks);
  }

  const figItem = (f: Figure, depth: number) => (
    <div
      key={`fig-${f.id}`}
      className={`tree-item${selectedFigureId === f.id ? " selected" : ""}`}
      style={{ paddingLeft: 12 + depth * 14 }}
      onClick={() => onSelectFigure(f.id)}
    >
      <span>
        {"└ "}
        🖼 {f.id}
      </span>
      <span className="tag">{project.figures[f.id] ? t("tree.figure") : t("tree.missing")}</span>
    </div>
  );

  const renderBlock = (b: Block, depth: number): React.ReactNode => {
    const kids = (b.children ?? []).slice().sort((x, y) => x.order - y.order);
    const isFig = b.type === "figure";
    const figs = isFig ? [] : figuresForBlock(b);
    const label = isFig
      ? `🖼 ${b.figure_id ?? b.id}`
      : `${depth > 0 ? "└ " : ""}${b.title || b.id}`;
    return (
      <div key={b.id}>
        <div
          className={[
            "tree-item",
            sel.has(b.id) ? "selected" : "",
            b.visible === false ? "hidden-block" : "",
          ].join(" ")}
          style={{ paddingLeft: 12 + depth * 14 }}
          onClick={(e) => onSelectBlock(b.id, e)}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu({ x: e.clientX, y: e.clientY, blockId: b.id });
          }}
        >
          <span>{label}</span>
          <span className="tag">
            {isFig ? t("tree.figure") : columnShortLabel(b.column)}
            {kids.length ? `・${t("tree.children", { n: kids.length })}` : ""}
            {figs.length ? `・${t("tree.figures", { n: figs.length })}` : ""}
            {b.visible === false ? `・${t("tree.hidden")}` : ""}
          </span>
        </div>
        {figs.map((f) => figItem(f, depth + 1))}
        {kids.map((c) => renderBlock(c, depth + 1))}
      </div>
    );
  };

  const topBlocks = doc.blocks.slice().sort((a, b) => a.order - b.order);
  const unassigned = doc.figures.filter((f) => !assignedFigIds.has(f.id));

  return (
    <div>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontWeight: 600 }}>{doc.project.title}</div>
        <div className="tag" style={{ marginTop: 4 }}>
          {posterSizeLabel(doc.project)}
          {doc.project.poster_size !== "custom" &&
            `・${doc.project.orientation === "portrait" ? t("tree.portrait") : t("tree.landscape")}`}
          ・{t("tree.columns", { n: doc.layout.columns.count })}
        </div>
      </div>

      <div className="tree-section">{t("tree.header")}</div>
      <div
        className={`tree-item${selectedBlockId === HEADER_ID ? " selected" : ""}`}
        onClick={() => onSelectBlock(HEADER_ID)}
      >
        <span>{t("tree.title_author")}</span>
        <span className="tag">header</span>
      </div>

      <div className="tree-section">
        {t("tree.blocks_section", { n: topBlocks.length })}
      </div>
      <div className="row" style={{ gap: 4, padding: "2px 10px 6px", flexWrap: "wrap" }}>
        <span className="tag" style={{ alignSelf: "center" }}>{t("tree.add")}</span>
        {columnOrder(doc.layout.columns.count).map((c) => (
          <button key={c} onClick={() => onAddBlock(c)}>＋{columnShortLabel(c)}</button>
        ))}
        <button onClick={() => onAddBlock("wide")}>＋{t("tree.full_width")}</button>
      </div>
      {topBlocks.map((b) => renderBlock(b, 0))}

      {unassigned.length > 0 && (
        <>
          <div className="tree-section">{t("tree.unassigned", { n: unassigned.length })}</div>
          {unassigned.map((f) => figItem(f, 0))}
        </>
      )}

      {menu ? (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 50 }}
            onClick={() => setMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu(null);
            }}
          />
          <div className="ctx-menu" style={{ left: menu.x, top: menu.y }}>
            <div className="ctx-head">{t("tree.ctx_head", { id: menu.blockId })}</div>
            <div
              className="ctx-item"
              onClick={() => {
                onAddFigure(menu.blockId, "file");
                setMenu(null);
              }}
            >
              {t("tree.ctx_from_file")}
            </div>
            <div
              className="ctx-item"
              onClick={() => {
                onAddFigure(menu.blockId, "clipboard");
                setMenu(null);
              }}
            >
              {t("tree.ctx_from_clipboard")}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
