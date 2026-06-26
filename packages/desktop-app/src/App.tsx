import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { open, save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

import type {
  AlnumKind,
  Block,
  Figure,
  FigureAsset,
  FormatPackage,
  FormatSections,
  HeaderConfig,
  Layout,
  PosterProject,
  ProjectMeta,
  ProofTarget,
  ReferencesConfig,
  Theme,
  Warning,
  WidthTarget,
} from "@rps/core";
import {
  HEADER_ID,
  MINIMUMS,
  buildCombinedContent,
  mergeCombinedContent,
  flattenBlocks,
  mmToPx,
  posterSizeMm,
  proofItems,
  staticWarnings,
  syncOwnedFigureChildBlocks,
  syncStandaloneFigureBlocks,
  unifyAlnumWidth,
} from "@rps/core";
import { pathExists } from "./lib/tauri";
import {
  loadProject,
  saveBlockContent,
  saveCombinedContent,
  saveProjectYaml,
  usesCombinedContent,
} from "./lib/project";
import { createNewProject, type NewProjectInput } from "./lib/newProject";
import { useHistory } from "./lib/useHistory";
import { useDiagrams } from "./lib/useDiagrams";
import { useKeyboardShortcuts } from "./lib/useKeyboardShortcuts";
import { columnOptions } from "./lib/columns";
import { writeFileFromBase64, convertEmfToPng } from "./lib/tauri";
import {
  convertFigureAsset,
  convertFigureAssets,
  isConvertibleFigure,
  knockoutWhiteToDataUri,
} from "./lib/figureConvert";
import {
  loadRecentProjects,
  pushRecentProject,
  removeRecentProject,
  type RecentProject,
} from "./lib/recent";
import {
  findBlock,
  findContainingArray,
  makeIdFactory,
  mapBlockTree,
  removeBlockFromTree,
  treeOrderIds,
} from "./lib/blockTree";

import Toolbar, { type ExportKind } from "./components/Toolbar";
import ProjectTree from "./components/ProjectTree";
import PreviewPane from "./components/PreviewPane";
import Inspector from "./components/Inspector";
import MultiInspector from "./components/MultiInspector";
import FigureInspector from "./components/FigureInspector";
import HeaderInspector from "./components/HeaderInspector";
import ProjectSettings from "./components/ProjectSettings";
import ProofreadView from "./components/ProofreadView";
import LogPanel, { type LogEntry } from "./components/LogPanel";
import NewProjectWizard from "./components/NewProjectWizard";
import StartDialog from "./components/StartDialog";

import { runExport } from "./export/exportService";
import {
  type FormatCtx,
  exportFormat as exportFormatSvc,
  pickFormatFile as pickFormatFileSvc,
  applyFormat as applyFormatSvc,
} from "./lib/formatService";
import { useLang } from "./i18n";

export default function App() {
  const { t, lang, setLang } = useLang();
  const [project, setProject] = useState<PosterProject | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null); // primary
  const [selectedIds, setSelectedIds] = useState<string[]>([]); // multi-select
  const [selectedFigureId, setSelectedFigureId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.2);
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [showFontBadges, setShowFontBadges] = useState(true);
  const [uiScale, setUiScale] = useState(1);
  const [logOpen, setLogOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contentEditorText, setContentEditorText] = useState<string | null>(null);
  const [proofreadOpen, setProofreadOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(true);
  const [measured, setMeasured] = useState<Warning[]>([]);
  const [blockSizes, setBlockSizes] = useState<Record<string, { w: number; h: number }>>({});
  const [fonts, setFonts] = useState<string[]>([]);

  useEffect(() => {
    invoke<string[]>("list_fonts").then(setFonts).catch(() => {});
  }, []);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const posterRootRef = useRef<HTMLElement | null>(null);
  const [recent, setRecent] = useState<RecentProject[]>(() => loadRecentProjects());

  // side-pane open/width state
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [leftW, setLeftW] = useState(240);
  const [rightW, setRightW] = useState(330);
  // refs so the (stable) drag handlers can read current open state
  const leftOpenRef = useRef(leftOpen);
  leftOpenRef.current = leftOpen;
  const rightOpenRef = useRef(rightOpen);
  rightOpenRef.current = rightOpen;
  const bandState = useRef<{ side: "left" | "right"; startX: number; moved: boolean } | null>(null);

  // The inner-edge band: click = toggle open/close, drag = resize (when open).
  const bandMove = useCallback((e: MouseEvent) => {
    const st = bandState.current;
    if (!st) return;
    if (Math.abs(e.clientX - st.startX) > 3) st.moved = true;
    if (!st.moved) return;
    if (st.side === "left" && leftOpenRef.current) {
      setLeftW(Math.min(560, Math.max(170, e.clientX)));
    } else if (st.side === "right" && rightOpenRef.current) {
      setRightW(Math.min(640, Math.max(220, window.innerWidth - e.clientX)));
    }
  }, []);
  const bandUp = useCallback(() => {
    const st = bandState.current;
    if (st && !st.moved) {
      if (st.side === "left") setLeftOpen((o) => !o);
      else setRightOpen((o) => !o);
    }
    bandState.current = null;
    document.body.style.cursor = "";
    window.removeEventListener("mousemove", bandMove);
    window.removeEventListener("mouseup", bandUp);
  }, [bandMove]);
  const bandDown = (side: "left" | "right") => (e: React.MouseEvent) => {
    e.preventDefault();
    bandState.current = { side, startX: e.clientX, moved: false };
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", bandMove);
    window.addEventListener("mouseup", bandUp);
  };

  const log = (level: LogEntry["level"], message: string) =>
    setLogs((prev) => [...prev, { level, message }]);

  // ---- Mermaid / Graphviz コードブロックの描画キャッシュ（#63 / #64） ----
  // 本文 markdown 中の ```mermaid / ```dot をスキャンし，未描画のものを
  // 非同期で SVG 化して diagramKey -> SVG 文字列のキャッシュに溜める．
  // renderMarkdown は同期なので，描画済み SVG をリゾルバ経由で渡す．
  // ```mermaid / ```dot の非同期描画キャッシュ（useDiagrams に分離）
  const diagramLookup = useDiagrams(project, t, log);

  // ---- Undo / Redo（#61，useHistory に分離） ----
  const { undo, redo, canUndo, canRedo } = useHistory(project, setProject, setDirty);

  // ---- キーボードショートカット（docs/shortcuts-proposal.md） ----
  useKeyboardShortcuts({
    onSave: () => { if (project) void onSave(); },
    onSaveAs: () => { if (project) void onSaveAs(); },
    onOpen: () => void onOpen(),
    onNew: () => setWizardOpen(true),
    onPrint: () => { if (project) void onExport("pdf"); },
    onZoomIn: () => setZoom((z) => Math.min(2, +(z * 1.15).toFixed(3))),
    onZoomOut: () => setZoom((z) => Math.max(0.05, +(z / 1.15).toFixed(3))),
    onZoomReset: () => setZoom(0.2),
    onRealSize: () => setZoom(1),
    onZoomFit: () => fitZoom(),
    onClose: () => closeProject(),
    onExportMenu: () => { if (project) setShowExportMenu(true); },
    onEscape: () => {
      if (showHelp) setShowHelp(false);
      else setSelectedIds([]);
    },
    onDeleteSelection: () => {
      const id = selectedId;
      if (id && id !== HEADER_ID) removeBlock(id);
    },
    onDuplicate: () => {
      if (selectedId) duplicateBlock(selectedId);
    },
    onToggleBoundaries: () => setShowBoundaries((v) => !v),
    onToggleLang: () => setLang(lang === "ja" ? "en" : "ja"),
    onToggleLeftPane: () => setLeftOpen((o) => !o),
    onToggleRightPane: () => setRightOpen((o) => !o),
    onSelectNext: () => {
      if (!project) return;
      const ids = treeOrderIds(project.doc.blocks);
      if (!ids.length) return;
      const i = selectedId ? ids.indexOf(selectedId) : -1;
      selectBlock(ids[(i + 1 + ids.length) % ids.length]);
    },
    onSelectPrev: () => {
      if (!project) return;
      const ids = treeOrderIds(project.doc.blocks);
      if (!ids.length) return;
      const i = selectedId ? ids.indexOf(selectedId) : 0;
      selectBlock(ids[(i - 1 + ids.length) % ids.length]);
    },
    onMoveUp: () => moveBlock(-1),
    onMoveDown: () => moveBlock(1),
    onMoveColumnPrev: () => moveColumn(-1),
    onMoveColumnNext: () => moveColumn(1),
    onSelectAll: () => {
      if (!project) return;
      const ids = treeOrderIds(project.doc.blocks);
      if (ids.length) {
        setSelectedId(ids[0]);
        setSelectedIds(ids);
      }
    },
    onCopy: () => { if (selectedId) copyBlock(selectedId); },
    onCut: () => { if (selectedId) cutBlock(selectedId); },
    onPaste: () => pasteBlock(),
    onAddChild: () => {
      if (selectedId && selectedId !== HEADER_ID) addChild(selectedId, "wide");
    },
    onSettings: () => setSettingsOpen(true),
    onToggleBadges: () => setShowFontBadges((v) => !v),
    onToggleWarnings: () => setLogOpen((v) => !v),
    onHelp: () => setShowHelp(true),
  });

  const warnings = useMemo<Warning[]>(() => {
    if (!project) return [];
    return [...staticWarnings(project), ...measured];
  }, [project, measured]);

  const selectedBlock: Block | null = useMemo(() => {
    if (!project || !selectedId) return null;
    return findBlock(project.doc.blocks, selectedId);
  }, [project, selectedId]);

  const overflowIds = useMemo(
    () =>
      new Set(
        measured
          .filter((w) => w.code === "overflow" && w.blockId)
          .map((w) => w.blockId as string),
      ),
    [measured],
  );

  async function doLoad(dir: string, posterFile?: string) {
    try {
      const p = await loadProject(dir, posterFile);
      // PDF / Mermaid / Graphviz の図表ファイルを画像 data URI へ変換（#62-#65）
      p.figures = await convertFigureAssets(p.figures, (m) => log("warn", m));
      setProject(p);
      setSelectedId(p.doc.blocks[0]?.id ?? null);
      setSelectedIds(p.doc.blocks[0] ? [p.doc.blocks[0].id] : []);
      setSelectedFigureId(null);
      setDirty(false);
      setMeasured([]);
      setStartOpen(false);
      setRecent(
        pushRecentProject({
          dir,
          posterFile: p.posterFile ?? "poster.yaml",
          title: p.doc.project.title || "",
        }),
      );
      log("ok", t("log.loaded", { dir, n: p.doc.blocks.length }));
    } catch (e: any) {
      log("error", t("log.loadFailed", { msg: e?.message ?? e }));
    }
  }

  async function onOpenRecent(r: RecentProject) {
    try {
      const yamlPath = await invoke<string>("join_path", {
        base: r.dir,
        segments: [r.posterFile],
      });
      const exists = await pathExists(yamlPath);
      if (!exists) {
        setRecent(removeRecentProject(r.dir, r.posterFile));
        log("warn", t("log.notFoundRemoved", { path: yamlPath }));
        return;
      }
      await doLoad(r.dir, r.posterFile);
    } catch (e: any) {
      log("error", t("log.loadFailed", { msg: e?.message ?? e }));
    }
  }

  async function onOpen() {
    const sel = await open({
      title: t("app.openPosterTitle"),
      multiple: false,
      filters: [{ name: t("app.posterFilter"), extensions: ["yaml", "yml"] }],
    });
    if (typeof sel !== "string") return;
    const m = sel.match(/^(.*)[\\/]([^\\/]+)$/);
    if (!m) {
      log("error", t("log.pathUnparsable", { path: sel }));
      return;
    }
    await doLoad(m[1], m[2]);
  }

  async function onSaveAs() {
    if (!project) return;
    try {
      const def = await invoke<string>("join_path", {
        base: project.dir,
        segments: [project.posterFile ?? "poster.yaml"],
      });
      const sel = await save({
        title: t("app.saveAsTitle"),
        defaultPath: def,
        filters: [{ name: t("app.posterFilter"), extensions: ["yaml", "yml"] }],
      });
      if (typeof sel !== "string") return;
      const name = sel.split(/[\\/]/).pop() ?? "poster.yaml";
      const chosenDir = sel.replace(/[\\/][^\\/]+$/, "");
      // figures/ and content/ live in the project folder; always save the yaml
      // there so relative image paths keep working.
      const np: PosterProject = { ...project, posterFile: name };
      await backupBeforeSave(np);
      await saveProjectYaml(np);
      if (usesCombinedContent(np)) {
        await saveCombinedContent(np);
      } else {
        for (const b of flattenBlocks(np.doc.blocks)) {
          if (b.source) await saveBlockContent(np, b.id, np.content[b.id] ?? "");
        }
      }
      setProject(np);
      setDirty(false);
      log(
        "ok",
        t("log.savedAs", { dir: project.dir, name }) +
          (chosenDir !== project.dir ? t("log.savedAsInProjectFolder") : ""),
      );
    } catch (e: any) {
      log("error", t("log.saveFailed", { msg: e?.message ?? e }));
    }
  }

  async function onOpenSample() {
    try {
      const dir = await invoke<string>("sample_project_dir");
      await doLoad(dir);
    } catch (e: any) {
      log("error", t("log.sampleNotFound", { msg: e?.message ?? e }));
    }
  }

  // 新規作成ウィザード: プロジェクトを scaffold して読み込む．失敗は throw して
  // ウィザード内に表示する（既存フォルダの上書き拒否など）．
  async function handleCreateProject(input: NewProjectInput) {
    const dir = await createNewProject(input);
    await doLoad(dir);
    setWizardOpen(false);
    setStartOpen(false);
    log("ok", t("log.projectCreated", { dir }));
  }

  const selectedFigure: Figure | null = useMemo(() => {
    if (!project || !selectedFigureId) return null;
    return project.doc.figures.find((f) => f.id === selectedFigureId) ?? null;
  }, [project, selectedFigureId]);

  // a selected figure-block edits its underlying figure (+ block layout)
  const figureBlockFig: Figure | null = useMemo(() => {
    if (!project || !selectedBlock || selectedBlock.type !== "figure" || !selectedBlock.figure_id) {
      return null;
    }
    return project.doc.figures.find((f) => f.id === selectedBlock.figure_id) ?? null;
  }, [project, selectedBlock]);

  function selectBlock(id: string, e?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) {
    setSelectedFigureId(null);
    if (!id) {
      setSelectedId(null);
      setSelectedIds([]);
      return;
    }
    // header is single-select only
    if (id === HEADER_ID || !project) {
      setSelectedId(id);
      setSelectedIds([id]);
      return;
    }
    if (e?.ctrlKey || e?.metaKey) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev.filter((x) => x !== HEADER_ID), id],
      );
      setSelectedId(id);
    } else if (e?.shiftKey && selectedId && selectedId !== HEADER_ID) {
      const order = treeOrderIds(project.doc.blocks);
      const a = order.indexOf(selectedId);
      const b = order.indexOf(id);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        setSelectedIds(order.slice(lo, hi + 1));
      } else {
        setSelectedIds([id]);
      }
      setSelectedId(id);
    } else {
      setSelectedId(id);
      setSelectedIds([id]);
    }
  }
  function selectFigure(id: string) {
    setSelectedFigureId(id || null);
    setSelectedId(null);
    setSelectedIds([]);
  }

  /** Apply a patch (layout/style/height) to all currently selected blocks. */
  function patchBlocks(
    ids: string[],
    p: { block?: Partial<Block>; style?: Partial<NonNullable<Block["style"]>>; height?: Partial<Block["height"]> },
  ) {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setProject((prev) =>
      prev
        ? {
            ...prev,
            doc: {
              ...prev.doc,
              blocks: mapBlockTree(prev.doc.blocks, (b) =>
                idSet.has(b.id)
                  ? {
                      ...b,
                      ...(p.block ?? {}),
                      style: p.style ? { ...(b.style ?? {}), ...p.style } : b.style,
                      height: p.height ? { ...b.height, ...p.height } : b.height,
                    }
                  : b,
              ),
            },
          }
        : prev,
    );
    setDirty(true);
  }
  const patchSelected = (p: Parameters<typeof patchBlocks>[1]) =>
    patchBlocks(selectedIds.length ? selectedIds : selectedId ? [selectedId] : [], p);
  const patchPrimary = (p: Parameters<typeof patchBlocks>[1]) =>
    patchBlocks(selectedId ? [selectedId] : [], p);

  /** Fit a block's body font size to its box height by measuring the live
   *  preview DOM (user-triggered; never shrinks below MIN_BODY_PT — 設計書 §8.5). */
  function autoFitBlock(id: string) {
    if (!project) return;
    const root = posterRootRef.current;
    const blockEl = root?.querySelector<HTMLElement>(
      `section[data-block-id="${CSS.escape(id)}"]`,
    );
    const bodyEl = blockEl?.querySelector<HTMLElement>(":scope > .rps-block-body");
    if (!blockEl || !bodyEl) {
      log("warn", t("log.autoFitNoBody", { id }));
      return;
    }
    const prevInline = bodyEl.style.fontSize;
    const setPt = (pt: number) => {
      bodyEl.style.fontSize = `${pt}pt`;
    };
    // tolerance 1px for sub-pixel rounding
    const fits = () => blockEl.scrollHeight <= blockEl.clientHeight + 1;
    try {
      // auto-height blocks grow with their content, so "fit" has no target.
      // Detect: raise the font; if the box height follows, bail out.
      const h0 = blockEl.clientHeight;
      const curPt = (parseFloat(getComputedStyle(bodyEl).fontSize) * 72) / 96;
      setPt(curPt + 8);
      const grew = blockEl.clientHeight > h0 + 1;
      setPt(curPt);
      if (grew) {
        log("warn", t("log.autoFitAutoHeight", { id }));
        return;
      }
      const MIN = MINIMUMS.MIN_BODY_PT;
      // §8.5: never auto-shrink below the minimum readable size
      setPt(MIN);
      if (!fits()) {
        log("warn", t("log.autoFitMinOverflow", { min: MIN }));
        return;
      }
      // binary search the largest fitting size, then round down to 0.5pt
      let lo = MIN;
      let hi = 96;
      while (hi - lo > 0.25) {
        const mid = (lo + hi) / 2;
        setPt(mid);
        if (fits()) lo = mid;
        else hi = mid;
      }
      const result = Math.floor(lo * 2) / 2;
      patchBlocks([id], { style: { body_font_size: `${result}pt` } });
      log("ok", t("log.autoFitDone", { id, pt: result }));
    } finally {
      bodyEl.style.fontSize = prevInline;
    }
  }

  /**
   * Vertical "track" for up/down reordering (visual-neighbour semantics):
   * a block's track is the same-column blocks at its nesting level PLUS every
   * full-width (`wide`) block at that level. A wide block spans all columns, so
   * it sits above/below the block and is a crossable barrier; other-column
   * blocks are beside (not above/below) the block and are skipped. A wide
   * block's own track is all siblings. `full` is the whole sibling list, used
   * for level-wide renumbering.
   */
  function moveTrack(
    id: string,
  ): { full: Block[]; track: Block[]; idx: number } | null {
    if (!project) return null;
    const b = findBlock(project.doc.blocks, id);
    const siblings = findContainingArray(project.doc.blocks, id);
    if (!b || !siblings) return null;
    const full = siblings.slice().sort((a, c) => a.order - c.order);
    const track =
      b.column === "wide"
        ? full
        : full.filter((x) => x.column === b.column || x.column === "wide");
    return { full, track, idx: track.findIndex((x) => x.id === id) };
  }

  function canMove(id: string | null, dir: -1 | 1): boolean {
    if (!id) return false;
    const r = moveTrack(id);
    if (!r || r.idx < 0) return false;
    const j = r.idx + dir;
    return j >= 0 && j < r.track.length;
  }

  function moveBlock(dir: -1 | 1) {
    if (!project || !selectedId) return;
    const r = moveTrack(selectedId);
    if (!r) return;
    const { full, track, idx } = r;
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= track.length) return;
    // Reposition the block immediately past its track-neighbour in the full
    // sibling order — jumping over other-column blocks and crossing full-width
    // barriers — while keeping its own column. Then renumber the whole level
    // 1..n so orders stay distinct across all columns (no ties, no surprise
    // band re-flushing).
    const neighbor = track[j];
    const self = full.find((x) => x.id === selectedId)!;
    const seq = full.filter((x) => x.id !== selectedId);
    const at = seq.findIndex((x) => x.id === neighbor.id);
    seq.splice(dir === 1 ? at + 1 : at, 0, self);
    const orderById = new Map<string, number>();
    seq.forEach((s, k) => orderById.set(s.id, k + 1));
    const blocks = mapBlockTree(project.doc.blocks, (x) =>
      orderById.has(x.id) ? { ...x, order: orderById.get(x.id)! } : x,
    );
    setProject({ ...project, doc: { ...project.doc, blocks } });
    setDirty(true);
  }

  // Duplicate a block (and its text subtree) with fresh ids, inserted right
  // after the original. Figures are not cloned — blocks that own/are figures
  // are skipped (cloning would corrupt figure↔block links).
  function duplicateBlock(id: string) {
    if (!project || id === HEADER_ID) return;
    const src = findBlock(project.doc.blocks, id);
    if (!src) return;
    const hasFig = (b: Block): boolean =>
      b.type === "figure" || /__fig_/.test(b.id) || (b.children ?? []).some(hasFig);
    if (hasFig(src)) {
      log("warn", t("log.dupHasFigure"));
      return;
    }
    const next = makeIdFactory(project.doc.blocks);
    const content = { ...project.content };
    const cloneRec = (b: Block): Block => {
      const nid = next();
      if (content[b.id] !== undefined) content[nid] = content[b.id];
      const out: Block = { ...b, id: nid };
      if (b.children?.length) out.children = b.children.map(cloneRec);
      return out;
    };
    const clone = { ...cloneRec(src), order: src.order + 1 };
    const insert = (arr: Block[]): Block[] => {
      const i = arr.findIndex((b) => b.id === id);
      if (i >= 0) {
        const bumped = arr.map((b) => (b.order > src.order ? { ...b, order: b.order + 1 } : b));
        bumped.splice(i + 1, 0, clone);
        return bumped;
      }
      return arr.map((b) => (b.children?.length ? { ...b, children: insert(b.children) } : b));
    };
    const blocks = insert(project.doc.blocks);
    setProject({ ...project, doc: { ...project.doc, blocks }, content });
    setDirty(true);
    selectBlock(clone.id);
    log("ok", t("log.blockDuplicated", { id: clone.id }));
  }

  // ---- block clipboard (Ctrl+C / X / V) ----
  const clipboardRef = useRef<{ block: Block; content: Record<string, string> } | null>(null);
  const subtreeHasFigure = (b: Block): boolean =>
    b.type === "figure" || /__fig_/.test(b.id) || (b.children ?? []).some(subtreeHasFigure);
  function collectSubtreeContent(b: Block, src: Record<string, string>, out: Record<string, string>) {
    if (src[b.id] !== undefined) out[b.id] = src[b.id];
    (b.children ?? []).forEach((c) => collectSubtreeContent(c, src, out));
  }
  function copyBlock(id: string): boolean {
    if (!project || id === HEADER_ID) return false;
    const src = findBlock(project.doc.blocks, id);
    if (!src) return false;
    if (subtreeHasFigure(src)) {
      log("warn", t("log.dupHasFigure"));
      return false;
    }
    const content: Record<string, string> = {};
    collectSubtreeContent(src, project.content, content);
    clipboardRef.current = { block: JSON.parse(JSON.stringify(src)) as Block, content };
    log("ok", t("log.blockCopied", { id }));
    return true;
  }
  function cutBlock(id: string) {
    if (copyBlock(id)) removeBlock(id);
  }
  function pasteBlock() {
    const clip = clipboardRef.current;
    if (!project || !clip) return;
    const next = makeIdFactory(project.doc.blocks);
    const content = { ...project.content };
    const cloneRec = (b: Block): Block => {
      const nid = next();
      if (clip.content[b.id] !== undefined) content[nid] = clip.content[b.id];
      const out: Block = { ...b, id: nid };
      if (b.children?.length) out.children = b.children.map(cloneRec);
      return out;
    };
    const clone = cloneRec(clip.block);
    const target = selectedId && selectedId !== HEADER_ID ? findBlock(project.doc.blocks, selectedId) : null;
    let blocks: Block[];
    if (target) {
      clone.order = target.order + 1;
      const insert = (arr: Block[]): Block[] => {
        const i = arr.findIndex((b) => b.id === target.id);
        if (i >= 0) {
          const bumped = arr.map((b) => (b.order > target.order ? { ...b, order: b.order + 1 } : b));
          bumped.splice(i + 1, 0, clone);
          return bumped;
        }
        return arr.map((b) => (b.children?.length ? { ...b, children: insert(b.children) } : b));
      };
      blocks = insert(project.doc.blocks);
    } else {
      clone.column = "wide";
      clone.order = project.doc.blocks.reduce((m, b) => Math.max(m, b.order), 0) + 1;
      blocks = [...project.doc.blocks, clone];
    }
    setProject({ ...project, doc: { ...project.doc, blocks }, content });
    setDirty(true);
    selectBlock(clone.id);
    log("ok", t("log.blockPasted", { id: clone.id }));
  }
  // Ctrl+W: close the current project back to the start screen (confirm if dirty).
  function closeProject() {
    if (!project) return;
    if (dirty && !window.confirm(t("app.confirmClose"))) return;
    setProject(null);
    setSelectedId(null);
    setSelectedIds([]);
    setDirty(false);
    setStartOpen(true);
  }
  // Ctrl+1: fit the poster width to the preview viewport.
  function fitZoom() {
    if (!project) return;
    const wrap = document.querySelector(".preview-wrap") as HTMLElement | null;
    if (!wrap) return;
    const avail = wrap.clientWidth - 40; // leave a small margin
    const { w } = posterSizeMm(project.doc.project);
    const posterPx = mmToPx(w);
    if (posterPx > 0 && avail > 0) {
      setZoom(Math.max(0.05, Math.min(2, +(avail / posterPx).toFixed(3))));
    }
  }

  function moveColumn(dir: -1 | 1) {
    if (!project || !selectedId || selectedId === HEADER_ID) return;
    const b = findBlock(project.doc.blocks, selectedId);
    if (!b) return;
    const opts = columnOptions(project.doc.layout.columns.count);
    const cur = opts.indexOf(b.column);
    const i = ((cur < 0 ? 0 : cur) + dir + opts.length) % opts.length;
    patchBlocks([selectedId], { block: { column: opts[i] } });
  }

  function applyBorderToAll(border: {
    border: boolean;
    border_color?: string;
    border_width?: string;
  }) {
    setProject((prev) =>
      prev
        ? {
            ...prev,
            doc: {
              ...prev.doc,
              blocks: mapBlockTree(prev.doc.blocks, (b) => ({
                ...b,
                style: {
                  ...(b.style ?? {}),
                  border: border.border,
                  border_color: border.border_color,
                  border_width: border.border_width,
                },
              })),
            },
          }
        : prev,
    );
    setDirty(true);
  }

  /** Source path for a newly created block: combined file if the project uses
   *  one (content.md#id), else a per-block content/<id>.md. */
  function newBlockSource(id: string): string {
    const cf = project?.doc.project.content_file;
    return cf ? `${cf}#${id}` : `content/${id}.md`;
  }

  /** Switch the whole project between single-file (content.md) and per-block
   *  content/<id>.md. Rewrites block sources + content_file; the content map is
   *  unchanged (keyed by block id). Old files are left on disk (orphaned). */
  function handleConvertContent(mode: "combined" | "per-block") {
    if (!project) return;
    const cf = "content.md";
    const anchorOf = (id: string) => id.replace(/__text$/, "");
    const blocks = mapBlockTree(project.doc.blocks, (b) => {
      if (!b.source) return b;
      const anchor = anchorOf(b.id);
      return { ...b, source: mode === "combined" ? `${cf}#${anchor}` : `content/${anchor}.md` };
    });
    const meta = { ...project.doc.project, content_file: mode === "combined" ? cf : undefined };
    setProject({ ...project, doc: { ...project.doc, project: meta, blocks } });
    setDirty(true);
    log(
      "ok",
      mode === "combined" ? t("log.contentToCombined") : t("log.contentToPerBlock"),
    );
  }

  /** Open the whole-content editor (single-file mode): show content.md text. */
  function openContentEditor() {
    if (!project) return;
    const built = buildCombinedContent(project.doc, project.content);
    const cf = project.doc.project.content_file ?? "content.md";
    setContentEditorText(built[cf] ?? "");
  }

  /** Apply edits from the whole-content editor: re-parse and merge back. */
  function applyContentEditor() {
    if (!project || contentEditorText == null) return;
    const cf = project.doc.project.content_file ?? "content.md";
    const merged = mergeCombinedContent(project.doc, { [cf]: contentEditorText });
    setProject({
      ...project,
      doc: merged.doc,
      content: { ...project.content, ...merged.content },
    });
    setDirty(true);
    setContentEditorText(null);
    log("ok", t("log.contentEditorApplied"));
  }

  /** Add child block(s) to a parent. */
  function addChild(parentId: string, kind: "wide" | "pair" | "left" | "right") {
    if (!project) return;
    const nextId = makeIdFactory(project.doc.blocks);
    const parent = findBlock(project.doc.blocks, parentId);
    const baseOrder = (parent?.children ?? []).reduce((m, c) => Math.max(m, c.order), 0) + 1;
    const make = (column: Block["column"], order: number): Block => {
      const id = nextId();
      return {
        id,
        type: "text",
        title: "",
        source: newBlockSource(id),
        column,
        order,
        visible: true,
        height: { mode: "auto", weight: 1 },
        style: {},
        figures: [],
        overflow: { action: "warn" },
      };
    };
    const newKids: Block[] =
      kind === "wide"
        ? [make("wide", baseOrder)]
        : kind === "left"
          ? [make("left", baseOrder)]
          : kind === "right"
            ? [make("right", baseOrder)]
            : [make("left", baseOrder), make("right", baseOrder + 1)];
    const blocks = mapBlockTree(project.doc.blocks, (b) =>
      b.id === parentId ? { ...b, children: [...(b.children ?? []), ...newKids] } : b,
    );
    const content = { ...project.content };
    newKids.forEach((k) => (content[k.id] = ""));
    setProject({ ...project, doc: { ...project.doc, blocks }, content });
    setDirty(true);
    setSelectedFigureId(null);
    setSelectedId(newKids[0].id);
    setSelectedIds([newKids[0].id]);
  }

  function removeBlock(id: string) {
    if (!project) return;
    const blocks = removeBlockFromTree(project.doc.blocks, id);
    setProject({ ...project, doc: { ...project.doc, blocks } });
    setDirty(true);
    setSelectedId(null);
    setSelectedIds([]);
  }

  /** Add a new top-level block of the given column. */
  function addTopBlock(column: Block["column"]) {
    if (!project) return;
    const id = makeIdFactory(project.doc.blocks)();
    const maxOrder = project.doc.blocks.reduce((m, b) => Math.max(m, b.order), 0);
    const nb: Block = {
      id,
      type: "text",
      title: t("app.newBlockTitle"),
      source: newBlockSource(id),
      column,
      order: maxOrder + 1,
      visible: true,
      height: { mode: "auto", weight: 1 },
      style: {},
      figures: [],
      overflow: { action: "warn" },
    };
    setProject({
      ...project,
      doc: { ...project.doc, blocks: [...project.doc.blocks, nb] },
      content: { ...project.content, [id]: "" },
    });
    setDirty(true);
    setSelectedFigureId(null);
    setSelectedId(id);
    setSelectedIds([id]);
  }

  /** Add a figure (from a file or the clipboard) as a figure child block. */
  async function addFigure(targetBlockId: string | null, src: "file" | "clipboard") {
    if (!project) return;
    try {
      let filename: string;
      let dataUri: string;
      if (src === "file") {
        const sel = await open({
          title: t("app.selectFigureTitle"),
          multiple: false,
          filters: [
            {
              name: t("app.figureFilter"),
              extensions: [
                "png", "jpg", "jpeg", "gif", "webp", "svg",
                "pdf", "csv", "mmd", "dot", "gv",
              ],
            },
          ],
        });
        if (typeof sel !== "string") return;
        filename = sel.split(/[\\/]/).pop() ?? "figure";
        dataUri = await invoke<string>("read_file_as_data_uri", { path: sel });
        const dest = await invoke<string>("join_path", {
          base: project.dir,
          segments: ["figures", filename],
        });
        await writeFileFromBase64(dest, dataUri);
      } else {
        filename = await invoke<string>("paste_clipboard_image", { dir: project.dir });
        const dest = await invoke<string>("join_path", {
          base: project.dir,
          segments: ["figures", filename],
        });
        dataUri = await invoke<string>("read_file_as_data_uri", { path: dest });
      }

      const figIds = new Set(project.doc.figures.map((f) => f.id));
      let n = 1;
      while (figIds.has(`img${n}`)) n++;
      const figId = `img${n}`;
      const blockId = makeIdFactory(project.doc.blocks)();
      const newFig: Figure = {
        id: figId,
        path: `figures/${filename}`,
        caption: "",
        placement: "inside-block",
        block: blockId,
        scale: 1,
        align: "center",
        crop: { enabled: false },
        style: { border: false, caption_position: "bottom" },
      };
      const figBlock: Block = {
        id: blockId,
        type: "figure",
        figure_id: figId,
        title: "",
        column: "wide",
        order: 0,
        visible: true,
        height: { mode: "auto", weight: 1 },
        style: {},
        figures: [],
        overflow: { action: "warn" },
      };

      let blocks: Block[];
      if (targetBlockId) {
        const parent = findBlock(project.doc.blocks, targetBlockId);
        figBlock.order = (parent?.children ?? []).reduce((m, c) => Math.max(m, c.order), 0) + 1;
        blocks = mapBlockTree(project.doc.blocks, (b) =>
          b.id === targetBlockId ? { ...b, children: [...(b.children ?? []), figBlock] } : b,
        );
      } else {
        figBlock.order = project.doc.blocks.reduce((m, b) => Math.max(m, b.order), 0) + 1;
        blocks = [...project.doc.blocks, figBlock];
      }

      // PDF / Mermaid / Graphviz は読み込み時に画像 data URI へ変換して登録する
      let asset: FigureAsset = { name: filename, path: newFig.path, dataUri, bytes: 0 };
      if (isConvertibleFigure(filename)) {
        try {
          asset = await convertFigureAsset(asset);
        } catch (e: any) {
          log("warn", t("log.figureConvertFailed", { name: filename, msg: e?.message ?? e }));
        }
      }
      const figures = {
        ...project.figures,
        [figId]: asset,
      };
      setProject({
        ...project,
        doc: { ...project.doc, blocks, figures: [...project.doc.figures, newFig] },
        figures,
      });
      setDirty(true);
      setSelectedFigureId(null);
      setSelectedId(blockId);
      setSelectedIds([blockId]);
      log("ok", t("log.figureAdded", { name: filename }));
    } catch (e: any) {
      log("error", t("log.figureAddFailed", { msg: e?.message ?? e }));
    }
  }

  /** Pick an image, copy it into figures/, register the asset, return its relative path. */
  async function addImageFile(title = t("app.selectImageTitle")): Promise<string | null> {
    if (!project) return null;
    try {
      const sel = await open({
        title,
        multiple: false,
        filters: [{ name: t("app.imageFilter"), extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] }],
      });
      if (typeof sel !== "string") return null;
      const filename = sel.split(/[\\/]/).pop() ?? "image";
      const dataUri = await invoke<string>("read_file_as_data_uri", { path: sel });
      const dest = await invoke<string>("join_path", {
        base: project.dir,
        segments: ["figures", filename],
      });
      await writeFileFromBase64(dest, dataUri);
      // register under the filename key so the renderer can resolve it
      setProject((prev) =>
        prev
          ? {
              ...prev,
              figures: {
                ...prev.figures,
                [filename]: { name: filename, path: `figures/${filename}`, dataUri, bytes: 0 },
              },
            }
          : prev,
      );
      log("ok", t("log.imageAdded", { name: filename }));
      return `figures/${filename}`;
    } catch (e: any) {
      log("error", t("log.imageAddFailed", { msg: e?.message ?? e }));
      return null;
    }
  }

  // Bake a white background to true alpha: process the figure's image (and any
  // gallery images) on canvas, write new transparent PNGs into figures/, and
  // repoint the figure at them. Persists + works in every export (unlike the
  // multiply-only `transparent_white` render flag).
  async function knockoutWhiteFigure(fig: Figure) {
    if (!project) return;
    const base = (p: string) => p.replace(/\\/g, "/").split("/").pop() ?? p;
    const assetFor = (key: string, byPath?: string) =>
      project.figures[key] ?? (byPath ? project.figures[base(byPath)] : undefined);
    const newAssets: Record<string, FigureAsset> = {};
    const writeClear = async (srcKey: string, srcPath: string): Promise<string | null> => {
      const asset = assetFor(srcKey, srcPath);
      if (!asset) {
        log("warn", t("log.knockoutNoAsset", { id: srcKey }));
        return null;
      }
      const clearedUri = await knockoutWhiteToDataUri(asset.dataUri);
      const stem = base(srcPath).replace(/\.[^.]+$/, "");
      const name = `${stem}-clear.png`;
      const dest = await invoke<string>("join_path", {
        base: project.dir,
        segments: ["figures", name],
      });
      await writeFileFromBase64(dest, clearedUri);
      newAssets[name] = { name, path: `figures/${name}`, dataUri: clearedUri, bytes: 0 };
      return `figures/${name}`;
    };
    try {
      const newMain = await writeClear(fig.id, fig.path);
      const newImages: string[] = [];
      for (const img of fig.images ?? []) {
        const np = await writeClear(base(img), img);
        newImages.push(np ?? img);
      }
      if (!newMain && newImages.length === 0) return;
      const nextFig: Figure = {
        ...fig,
        path: newMain ?? fig.path,
        images: (fig.images ?? []).length ? newImages : fig.images,
        // turn off the multiply flag — the file itself is now transparent
        style: { ...(fig.style ?? {}), transparent_white: false },
      };
      const figures = project.doc.figures.map((f) => (f.id === fig.id ? nextFig : f));
      setProject((prev) =>
        prev
          ? {
              ...prev,
              doc: { ...prev.doc, figures },
              figures: {
                ...prev.figures,
                ...newAssets,
                // also refresh the id-keyed asset so the preview updates at once
                ...(newMain && newAssets[base(newMain)]
                  ? { [fig.id]: { ...newAssets[base(newMain)], name: fig.id } }
                  : null),
              },
            }
          : prev,
      );
      setDirty(true);
      log("ok", t("log.knockoutDone", { id: fig.id }));
    } catch (e: any) {
      log("error", t("log.knockoutFailed", { msg: e?.message ?? e }));
    }
  }

  // N12: convert an EMF/WMF figure to PNG (Windows-only Rust command) and
  // repoint the figure at the rasterized file.
  async function convertEmfFigure(fig: Figure) {
    if (!project) return;
    const base = (p: string) => p.replace(/\\/g, "/").split("/").pop() ?? p;
    const srcRel = fig.path;
    const stem = base(srcRel).replace(/\.[^.]+$/, "");
    const dstName = `${stem}.png`;
    try {
      const srcAbs = await invoke<string>("join_path", { base: project.dir, segments: srcRel.split("/") });
      const dstAbs = await invoke<string>("join_path", { base: project.dir, segments: ["figures", dstName] });
      await convertEmfToPng(srcAbs, dstAbs);
      const dataUri = await invoke<string>("read_file_as_data_uri", { path: dstAbs });
      const nextFig: Figure = { ...fig, path: `figures/${dstName}` };
      const figures = project.doc.figures.map((f) => (f.id === fig.id ? nextFig : f));
      setProject((prev) =>
        prev
          ? {
              ...prev,
              doc: { ...prev.doc, figures },
              figures: {
                ...prev.figures,
                [dstName]: { name: dstName, path: `figures/${dstName}`, dataUri, bytes: 0 },
                [fig.id]: { name: fig.id, path: `figures/${dstName}`, dataUri, bytes: 0 },
              },
            }
          : prev,
      );
      setDirty(true);
      log("ok", t("log.emfConverted", { name: dstName }));
    } catch (e: any) {
      log("error", t("log.emfFailed", { msg: e?.message ?? e }));
    }
  }

  const selectedBlocks: Block[] = useMemo(() => {
    if (!project || selectedIds.length === 0) return [];
    return selectedIds
      .map((id) => findBlock(project.doc.blocks, id))
      .filter((b): b is Block => !!b);
  }, [project, selectedIds]);

  function updateFigure(next: Figure) {
    if (!project) return;
    const figures = project.doc.figures.map((f) => (f.id === next.id ? next : { ...f }));
    // reflect placement / 所属ブロック changes immediately (no save→reload):
    // - standalone (full-width / column): add / move / remove the __fig_* block
    // - owned: migrate the owning block into a container (text + figure
    //   children) and prune the figure's previous figure block
    // owned sync first: it prunes the figure's previous figure block, which the
    // standalone sync needs gone to recognize the figure as unowned
    const blocks = syncOwnedFigureChildBlocks([...project.doc.blocks], figures);
    syncStandaloneFigureBlocks(blocks, figures);
    // a fresh `<id>__text` child inherits the parent's loaded markdown
    const content = { ...project.content };
    for (const b of flattenBlocks(blocks)) {
      const t = b.children?.find((c) => c.id === `${b.id}__text`);
      if (t && content[t.id] === undefined && content[b.id] !== undefined) {
        content[t.id] = content[b.id];
      }
    }
    setProject({ ...project, doc: { ...project.doc, figures, blocks }, content });
    setDirty(true);
  }

  function updateMeta(patch: Partial<ProjectMeta>) {
    setProject((prev) =>
      prev
        ? { ...prev, doc: { ...prev.doc, project: { ...prev.doc.project, ...patch } } }
        : prev,
    );
    setDirty(true);
  }

  function updateHeader(patch: Partial<HeaderConfig>) {
    setProject((prev) =>
      prev
        ? { ...prev, doc: { ...prev.doc, header: { ...(prev.doc.header ?? {}), ...patch } } }
        : prev,
    );
    setDirty(true);
  }

  function updateTheme(patch: Partial<Theme>) {
    setProject((prev) =>
      prev ? { ...prev, doc: { ...prev.doc, theme: { ...prev.doc.theme, ...patch } } } : prev,
    );
    setDirty(true);
  }

  function updateLayout(patch: Partial<Layout>) {
    setProject((prev) =>
      prev ? { ...prev, doc: { ...prev.doc, layout: { ...prev.doc.layout, ...patch } } } : prev,
    );
    setDirty(true);
  }

  function updateReferences(patch: Partial<ReferencesConfig>) {
    setProject((prev) =>
      prev
        ? {
            ...prev,
            doc: { ...prev.doc, references: { ...(prev.doc.references ?? {}), ...patch } },
          }
        : prev,
    );
    setDirty(true);
  }

  // フォーマットパッケージ（書き出し / 読み込み / 適用）は lib/formatService に分離
  const fmtCtx = (): FormatCtx => ({ project: project!, setProject, setDirty, t, log });
  const exportFormat = () => exportFormatSvc(fmtCtx());
  const pickFormatFile = () => (project ? pickFormatFileSvc(fmtCtx()) : Promise.resolve(null));
  const applyFormat = (pkg: FormatPackage, sections: FormatSections) =>
    project ? applyFormatSvc(fmtCtx(), pkg, sections) : undefined;

  function updateFigureNatSizes(sizes: Record<string, { w: number; h: number }>) {
    setProject((prev) => {
      if (!prev) return prev;
      let changed = false;
      const figures = { ...prev.figures };
      for (const [id, s] of Object.entries(sizes)) {
        const a = figures[id];
        if (a && (a.naturalWidth == null || a.naturalHeight == null)) {
          figures[id] = { ...a, naturalWidth: s.w, naturalHeight: s.h };
          changed = true;
        }
      }
      return changed ? { ...prev, figures } : prev;
    });
  }

  function updateContent(md: string) {
    if (!project || !selectedId) return;
    setProject({
      ...project,
      content: { ...project.content, [selectedId]: md },
    });
    setDirty(true);
  }

  /** 校正編集を project に適用する純関数（連続適用しても安全）． */
  function proofEditReducer(proj: PosterProject, target: ProofTarget, text: string): PosterProject {
    const doc = proj.doc;
    const p = doc.project;
    const withMeta = (patch: Partial<ProjectMeta>): PosterProject => ({
      ...proj,
      doc: { ...doc, project: { ...p, ...patch } },
    });
    switch (target.type) {
      case "meta-title":
        return withMeta({ title: text });
      case "meta-subtitle":
        return withMeta({ subtitle: text });
      case "conference-name":
        return withMeta({ conference: { ...(p.conference ?? {}), name: text } });
      case "conference-date":
        return withMeta({ conference: { ...(p.conference ?? {}), date: text } });
      case "author":
        return withMeta({
          authors: p.authors.map((a, i) => (i === target.index ? { ...a, name: text } : a)),
        });
      case "affiliation": {
        const affiliations = [...(p.affiliations ?? [])];
        affiliations[target.index] = text;
        return withMeta({ affiliations });
      }
      case "keyword": {
        const keywords = [...(p.keywords ?? [])];
        keywords[target.index] = text;
        return withMeta({ keywords });
      }
      case "block-title":
        return {
          ...proj,
          doc: {
            ...doc,
            blocks: mapBlockTree(doc.blocks, (b) =>
              b.id === target.blockId ? { ...b, title: text } : b,
            ),
          },
        };
      case "block-body":
        return { ...proj, content: { ...proj.content, [target.blockId]: text } };
      case "figure-caption":
        return {
          ...proj,
          doc: {
            ...doc,
            figures: doc.figures.map((f) =>
              f.id === target.figureId ? { ...f, caption: text } : f,
            ),
          },
        };
    }
  }

  /** 校正モードからの編集を該当フィールドへ反映する． */
  function applyProofEdit(target: ProofTarget, text: string) {
    setProject((prev) => (prev ? proofEditReducer(prev, target, text) : prev));
    setDirty(true);
  }

  /** 英字 / 数字の全角・半角をポスター全文で統一する（校正モードの一括変換）． */
  function unifyProofWidth(kind: AlnumKind, target: WidthTarget) {
    if (!project) return;
    const edits = proofItems(project.doc, project.content)
      .map((it) => ({ target: it.target, next: unifyAlnumWidth(it.text, kind, target), prev: it.text }))
      .filter((e) => e.next !== e.prev);
    if (edits.length === 0) {
      log("info", t("log.unifyNoTarget"));
      return;
    }
    setProject((prev) =>
      prev ? edits.reduce((proj, e) => proofEditReducer(proj, e.target, e.next), prev) : prev,
    );
    setDirty(true);
    log(
      "ok",
      t("log.unifyDone", {
        kind: kind === "alpha" ? t("app.alnumAlpha") : t("app.alnumNumber"),
        width: target === "half" ? t("app.widthHalf") : t("app.widthFull"),
        n: edits.length,
      }),
    );
  }

  /** 保存前バックアップ（#60）: poster.yaml / references.bib / content / styles を
   *  backups/<タイムスタンプ>/ にコピーし，10 世代を超えた分を削除する．
   *  初回保存（ファイル未存在）やバックアップ失敗は警告のみで保存は続行する． */
  async function backupBeforeSave(p: PosterProject) {
    try {
      const stamp = await invoke<string>("backup_project", {
        dir: p.dir,
        posterFile: p.posterFile ?? "poster.yaml",
        keep: 10,
      });
      log("info", t("log.backupCreated", { stamp }));
    } catch (e: any) {
      log("warn", t("log.backupSkipped", { msg: e?.message ?? e }));
    }
  }

  async function onSave() {
    if (!project) return;
    try {
      await backupBeforeSave(project);
      await saveProjectYaml(project);
      if (usesCombinedContent(project)) {
        await saveCombinedContent(project);
      } else {
        for (const b of flattenBlocks(project.doc.blocks)) {
          if (b.source) await saveBlockContent(project, b.id, project.content[b.id] ?? "");
        }
      }
      setDirty(false);
      log(
        "ok",
        t("log.saved", { files: usesCombinedContent(project) ? "content.md" : "content/*.md" }),
      );
    } catch (e: any) {
      log("error", t("log.saveFailed", { msg: e?.message ?? e }));
    }
  }

  /**
   * Show a save dialog for an export. Defaults to the project's exports/
   * location (from export config), creating exports/ so the dialog can open
   * there. Returns the chosen absolute path, or null if cancelled.
   */
  async function onExport(kind: ExportKind) {
    if (!project) return;
    setBusy(true);
    try {
      await runExport(kind, {
        project,
        diagram: diagramLookup,
        posterRoot: posterRootRef.current,
        t,
        log,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="app-scale"
      style={{
        width: `${100 / uiScale}vw`,
        height: `${100 / uiScale}vh`,
        transform: `scale(${uiScale})`,
      }}
    >
    <div className="app">
      <Toolbar
        loaded={!!project}
        dirty={dirty}
        zoom={zoom}
        showBoundaries={showBoundaries}
        busy={busy}
        canUndo={canUndo}
        canRedo={canRedo}
        recent={recent}
        onNew={() => setWizardOpen(true)}
        onOpen={onOpen}
        onOpenSample={onOpenSample}
        onOpenRecent={onOpenRecent}
        onSave={onSave}
        onSaveAs={onSaveAs}
        onUndo={undo}
        onRedo={redo}
        onZoom={setZoom}
        onToggleBoundaries={() => setShowBoundaries((v) => !v)}
        showFontBadges={showFontBadges}
        onToggleFontBadges={() => setShowFontBadges((v) => !v)}
        uiScale={uiScale}
        onUiScale={(s) => setUiScale(Math.min(1.6, Math.max(0.6, Math.round(s * 100) / 100)))}
        onExport={onExport}
        onOpenSettings={() => setSettingsOpen(true)}
        proofreadOpen={proofreadOpen}
        onToggleProofread={() => setProofreadOpen((v) => !v)}
      />

      <div
        className="main"
        style={{
          gridTemplateColumns: `${leftOpen ? leftW : 0}px 11px 1fr 11px ${
            rightOpen ? rightW : 0
          }px`,
        }}
      >
        {/* left = プロジェクトペイン */}
        <div className="pane left">
          {leftOpen ? (
            <>
              <div className="pane-titlebar">
                <span>{t("app.projectPane")}</span>
              </div>
              {project ? (
                <ProjectTree
                  project={project}
                  selectedBlockId={selectedId}
                  selectedIds={selectedIds}
                  selectedFigureId={selectedFigureId}
                  onSelectBlock={selectBlock}
                  onSelectFigure={selectFigure}
                  onAddBlock={addTopBlock}
                  onAddFigure={addFigure}
                />
              ) : (
                <div className="empty">
                  {t("app.emptyPrepareProject")}
                  <div style={{ marginTop: 8 }}>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setWizardOpen(true);
                      }}
                    >
                      {t("app.openNewProjectWizard")}
                    </a>
                  </div>
                  {recent.length > 0 ? (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ marginBottom: 4 }}>{t("app.recentProjects")}</div>
                      {recent.map((r) => (
                        <div key={`${r.dir}/${r.posterFile}`} style={{ marginBottom: 2 }}>
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              onOpenRecent(r);
                            }}
                            title={`${r.dir}\\${r.posterFile}`}
                          >
                            {r.title || r.dir.split(/[\\/]/).pop() || r.dir}
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* inner-edge band on the right of the project pane: click=toggle, drag=resize */}
        <div
          className={`pane-band${leftOpen ? "" : " collapsed"}`}
          title={leftOpen ? t("app.bandCloseOrResize") : t("app.bandOpenProjectPane")}
          onMouseDown={bandDown("left")}
        >
          <span className="band-arrow">{leftOpen ? "‹" : "›"}</span>
        </div>

        <div className="pane center" style={{ padding: 0, display: "flex" }}>
          {project && proofreadOpen ? (
            <ProofreadView project={project} onEdit={applyProofEdit} onUnify={unifyProofWidth} />
          ) : project ? (
            <PreviewPane
              project={project}
              zoom={zoom}
              selectedBlockId={selectedId}
              selectedIds={selectedIds}
              onSelectBlock={selectBlock}
              onEditBlock={(id) => {
                const b = findBlock(project.doc.blocks, id);
                if (!b || b.source === undefined) return;
                selectBlock(id);
                setEditingBlockId(id);
              }}
              editingBlockId={editingBlockId}
              editContent={editingBlockId ? project.content[editingBlockId] ?? "" : ""}
              onEditContent={updateContent}
              onEndEdit={() => setEditingBlockId(null)}
              showBoundaries={showBoundaries}
              onMeasured={setMeasured}
              rootRef={posterRootRef}
              overflowIds={overflowIds}
              selectedFigureId={selectedFigureId}
              onSelectFigure={selectFigure}
              onFigureNatSizes={updateFigureNatSizes}
              onZoom={setZoom}
              showFontBadges={showFontBadges}
              onBlockSizes={setBlockSizes}
              diagram={diagramLookup}
            />
          ) : (
            <div className="empty" style={{ margin: "auto" }}>
              {t("app.previewHere")}
            </div>
          )}
        </div>

        {/* inner-edge band on the left of the settings pane: click=toggle, drag=resize */}
        <div
          className={`pane-band${rightOpen ? "" : " collapsed"}`}
          title={rightOpen ? t("app.bandCloseOrResize") : t("app.bandOpenBlockPane")}
          onMouseDown={bandDown("right")}
        >
          <span className="band-arrow">{rightOpen ? "›" : "‹"}</span>
        </div>

        {/* right = ブロック設定ペイン */}
        <div className="pane right">
          {rightOpen ? (
            <>
              <div className="pane-titlebar">
                <span>{t("app.blockSettingsPane")}</span>
              </div>
              {!project ? (
                <div className="empty">{t("app.projectNotLoaded")}</div>
              ) : settingsOpen ? (
                <ProjectSettings
                  project={project}
                  onChangeMeta={updateMeta}
                  onChangeLayout={updateLayout}
                  onChangeTheme={updateTheme}
                  onChangeReferences={updateReferences}
                  onExportFormat={exportFormat}
                  onPickFormatFile={pickFormatFile}
                  onApplyFormat={applyFormat}
                  onClose={() => setSettingsOpen(false)}
                  onAddImageFile={() => addImageFile(t("app.selectBackgroundImage"))}
                  onConvertContent={handleConvertContent}
                  onEditContentFile={openContentEditor}
                />
              ) : figureBlockFig && selectedBlock ? (
                <FigureInspector
                  project={project}
                  figure={figureBlockFig}
                  onChangeFigure={updateFigure}
                  figureBlock={selectedBlock}
                  onPatchBlock={(p) => patchPrimary({ block: p })}
                  onMoveBlock={moveBlock}
                  onRemoveBlock={removeBlock}
                  onAddImageFile={() => addImageFile(t("app.selectGalleryImage"))}
                  onKnockoutWhite={knockoutWhiteFigure}
                  onConvertEmf={convertEmfFigure}
                />
              ) : selectedFigure ? (
                <FigureInspector
                  project={project}
                  figure={selectedFigure}
                  onChangeFigure={updateFigure}
                  onAddImageFile={() => addImageFile(t("app.selectGalleryImage"))}
                  onKnockoutWhite={knockoutWhiteFigure}
                  onConvertEmf={convertEmfFigure}
                />
              ) : selectedId === HEADER_ID ? (
                <HeaderInspector
                  project={project}
                  onChangeMeta={updateMeta}
                  onChangeHeader={updateHeader}
                  onChangeTheme={updateTheme}
                  onAddLogoFile={() => addImageFile(t("app.selectLogoImage"))}
                />
              ) : selectedIds.length > 1 ? (
                <MultiInspector
                  project={project}
                  blocks={selectedBlocks}
                  onPatch={patchSelected}
                />
              ) : (
                <Inspector
                  project={project}
                  block={selectedBlock}
                  selectedCount={selectedIds.length}
                  content={selectedId ? project.content[selectedId] ?? "" : ""}
                  onPatch={patchSelected}
                  onPatchPrimary={patchPrimary}
                  onChangeContent={updateContent}
                  onMoveBlock={moveBlock}
                  canMoveUp={canMove(selectedId, -1)}
                  canMoveDown={canMove(selectedId, 1)}
                  onApplyBorderToAll={applyBorderToAll}
                  onAddChild={addChild}
                  onRemoveBlock={removeBlock}
                  onAddFigure={addFigure}
                  onAutoFit={autoFitBlock}
                  size={selectedId ? blockSizes[selectedId] : undefined}
                />
              )}
            </>
          ) : null}
        </div>
      </div>

      {logOpen ? (
        <LogPanel
          warnings={warnings}
          logs={logs}
          onSelectBlock={selectBlock}
          onToggle={() => setLogOpen(false)}
        />
      ) : (
        <button className="log-reopen" onClick={() => setLogOpen(true)}>
          ▲ {t("app.showWarningsLog")}
          {warnings.length ? `（${warnings.length}）` : ""}
        </button>
      )}

      <datalist id="rps-fonts">
        {fonts.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>

      {/* 起動時ダイアログ（未読み込み時のみ）．ウィザードはこの上に重なる */}
      {startOpen && !project && !wizardOpen ? (
        <StartDialog
          recent={recent}
          onNew={() => setWizardOpen(true)}
          onOpen={onOpen}
          onOpenSample={onOpenSample}
          onOpenRecent={onOpenRecent}
          onClose={() => setStartOpen(false)}
        />
      ) : null}
      {wizardOpen ? (
        <NewProjectWizard
          onCancel={() => setWizardOpen(false)}
          onCreate={handleCreateProject}
        />
      ) : null}

      {contentEditorText != null ? (
        <div className="modal-overlay">
          <div className="modal" style={{ width: "min(820px, calc(100vw - 40px))" }}>
            <div className="modal-titlebar">
              <span>{t("content.editorTitle")}</span>
              <button onClick={() => setContentEditorText(null)}>{t("content.cancel")}</button>
            </div>
            <div className="modal-body">
              <div className="wizard-hint" style={{ marginBottom: 6 }}>
                {t("content.editorHint")}
              </div>
              <textarea
                value={contentEditorText}
                onChange={(e) => setContentEditorText(e.target.value)}
                spellCheck={false}
                style={{ width: "100%", height: "55vh", fontFamily: "monospace", fontSize: 13, resize: "vertical" }}
              />
            </div>
            <div className="modal-actions">
              <button onClick={() => setContentEditorText(null)}>{t("content.cancel")}</button>
              <button className="primary" onClick={applyContentEditor}>{t("content.apply")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {showHelp ? (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div
            className="modal"
            style={{ width: "min(560px, calc(100vw - 40px))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-titlebar">
              <span>{t("shortcuts.title")}</span>
              <button onClick={() => setShowHelp(false)}>{t("content.cancel")}</button>
            </div>
            <div className="modal-body">
              <table className="shortcuts-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <tbody>
                  {[
                    ["Ctrl+S / Ctrl+Shift+S", lang === "ja" ? "保存 / 名前を付けて保存" : "Save / Save as"],
                    ["Ctrl+O / Ctrl+N", lang === "ja" ? "開く / 新規" : "Open / New"],
                    ["Ctrl+W", lang === "ja" ? "プロジェクトを閉じる" : "Close project"],
                    ["Ctrl+P / Ctrl+E", lang === "ja" ? "PDF 出力 / 形式選択" : "Export PDF / chooser"],
                    ["Ctrl+Z / Ctrl+Y", lang === "ja" ? "元に戻す / やり直す" : "Undo / Redo"],
                    ["Ctrl+D", lang === "ja" ? "ブロックを複製" : "Duplicate block"],
                    ["Ctrl+C / X / V", lang === "ja" ? "ブロックをコピー / 切り取り / 貼り付け" : "Copy / cut / paste block"],
                    ["Ctrl+A", lang === "ja" ? "全ブロック選択" : "Select all blocks"],
                    ["Delete", lang === "ja" ? "選択ブロックを削除" : "Delete selected block"],
                    ["Ctrl+Enter", lang === "ja" ? "子ブロックを追加" : "Add child block"],
                    ["Tab / Shift+Tab", lang === "ja" ? "次 / 前のブロックを選択" : "Select next / prev block"],
                    ["Alt+↑ / ↓", lang === "ja" ? "ブロックの並び順を上 / 下へ" : "Reorder block up / down"],
                    ["Alt+← / →", lang === "ja" ? "ブロックの列を移動" : "Move block column"],
                    ["Ctrl + / Ctrl - / Ctrl 0", lang === "ja" ? "拡大 / 縮小 / 既定" : "Zoom in / out / reset"],
                    ["Ctrl+9 / Ctrl+1", lang === "ja" ? "実寸 / 幅に合わせる" : "Real size / fit width"],
                    ["Ctrl+G", lang === "ja" ? "枠 / 境界ガイド" : "Frame / boundaries"],
                    ["Ctrl+Shift+B", lang === "ja" ? "pt バッジ表示" : "Toggle pt badges"],
                    ["Ctrl+Shift+V", lang === "ja" ? "ログ / 警告パネル" : "Toggle log / warnings"],
                    ["Ctrl+L", lang === "ja" ? "言語切替" : "Toggle language"],
                    ["Ctrl+\\ / Ctrl+Shift+\\", lang === "ja" ? "左 / 右ペイン開閉" : "Toggle left / right pane"],
                    ["Ctrl+,", lang === "ja" ? "全体設定" : "Settings"],
                    ["Ctrl+B / I / U", lang === "ja" ? "太字 / 斜体 / 下線（本文中）" : "Bold / italic / underline (in editor)"],
                    ["Esc", lang === "ja" ? "選択解除 / 閉じる" : "Deselect / close"],
                    ["F1 / Ctrl+/", lang === "ja" ? "このヘルプ" : "This help"],
                  ].map(([keys, desc]) => (
                    <tr key={keys}>
                      <td style={{ padding: "3px 10px 3px 0", whiteSpace: "nowrap", fontFamily: "monospace" }}>{keys}</td>
                      <td style={{ padding: "3px 0" }}>{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
      {showExportMenu && project ? (
        <div className="modal-overlay" onClick={() => setShowExportMenu(false)}>
          <div
            className="modal"
            style={{ width: "min(360px, calc(100vw - 40px))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-titlebar">
              <span>{t("export.menuTitle")}</span>
              <button onClick={() => setShowExportMenu(false)}>{t("content.cancel")}</button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(["pdf", "png", "html", "svg", "pptx", "marp"] as ExportKind[]).map((kind) => (
                <button
                  key={kind}
                  className={kind === "pdf" ? "primary" : undefined}
                  onClick={() => {
                    setShowExportMenu(false);
                    void onExport(kind);
                  }}
                  style={{ minWidth: 72 }}
                >
                  {kind.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
    </div>
  );
}
