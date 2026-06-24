// Undo / Redo history for the poster project (extracted from App.tsx).
// Snapshots doc + content; figures-only updates (e.g. naturalWidth backfill)
// are not recorded; consecutive body-text edits coalesce within a 1.2s window.
// Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z) trigger undo/redo, except while typing in an
// input/textarea (the browser's native undo handles those).

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { PosterProject } from "@rps/core";

type Snapshot = { doc: PosterProject["doc"]; content: PosterProject["content"] };

const UNDO_DEPTH = 100;
const COALESCE_MS = 1200;

export interface History {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useHistory(
  project: PosterProject | null,
  setProject: Dispatch<SetStateAction<PosterProject | null>>,
  setDirty: (v: boolean) => void,
): History {
  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  const histPrev = useRef<{ proj: PosterProject; at: number } | null>(null);
  const histSkip = useRef(false); // undo / redo 由来の setProject を履歴に積まない
  const [histVer, setHistVer] = useState(0); // ボタン活性の再計算用

  useEffect(() => {
    const prev = histPrev.current;
    if (!project) {
      histPrev.current = null;
      undoStack.current = [];
      redoStack.current = [];
      setHistVer((v) => v + 1);
      return;
    }
    const now = Date.now();
    if (!prev || prev.proj.dir !== project.dir || prev.proj.posterFile !== project.posterFile) {
      // 読み込み直後: 履歴をリセットして基準点だけ覚える
      undoStack.current = [];
      redoStack.current = [];
      histPrev.current = { proj: project, at: now };
      setHistVer((v) => v + 1);
      return;
    }
    if (histSkip.current) {
      histSkip.current = false;
      histPrev.current = { proj: project, at: now };
      setHistVer((v) => v + 1);
      return;
    }
    const docChanged = prev.proj.doc !== project.doc;
    const contentChanged = prev.proj.content !== project.content;
    if (!docChanged && !contentChanged) {
      // figures マップのみの更新（画像サイズ補完など）は履歴対象外
      histPrev.current = { proj: project, at: prev.at };
      return;
    }
    // 本文のみの連続編集は直前エントリにまとめる（タイピング 1 打 1 履歴を防ぐ）
    const coalesce =
      !docChanged && contentChanged && now - prev.at < COALESCE_MS && undoStack.current.length > 0;
    if (!coalesce) {
      undoStack.current.push({ doc: prev.proj.doc, content: prev.proj.content });
      if (undoStack.current.length > UNDO_DEPTH) undoStack.current.shift();
    }
    redoStack.current = [];
    histPrev.current = { proj: project, at: now };
    setHistVer((v) => v + 1);
  }, [project]);

  const applySnapshot = useCallback(
    (snap: Snapshot) => {
      histSkip.current = true;
      setProject((prev) => (prev ? { ...prev, doc: snap.doc, content: snap.content } : prev));
      setDirty(true);
    },
    [setProject, setDirty],
  );
  const undo = useCallback(() => {
    const cur = histPrev.current;
    const snap = undoStack.current.pop();
    if (!cur || !snap) return;
    redoStack.current.push({ doc: cur.proj.doc, content: cur.proj.content });
    applySnapshot(snap);
  }, [applySnapshot]);
  const redo = useCallback(() => {
    const cur = histPrev.current;
    const snap = redoStack.current.pop();
    if (!cur || !snap) return;
    undoStack.current.push({ doc: cur.proj.doc, content: cur.proj.content });
    applySnapshot(snap);
  }, [applySnapshot]);

  const canUndo = undoStack.current.length > 0 && histVer >= 0;
  const canRedo = redoStack.current.length > 0 && histVer >= 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.isComposing) return;
      const k = e.key.toLowerCase();
      // テキスト入力中はブラウザ標準の undo に任せる（入力欄の編集を壊さない）
      const t = e.target as HTMLElement | null;
      const inEditor =
        !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (inEditor) return;
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (k === "y" || (k === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return { undo, redo, canUndo, canRedo };
}
