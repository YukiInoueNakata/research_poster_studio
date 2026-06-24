// Global keyboard shortcuts for the desktop GUI (docs/shortcuts-proposal.md).
//
// Undo / redo are handled separately in useHistory; this hook covers file,
// view (zoom), selection and toggle actions. While focus is inside a text
// field (input / textarea / select / contenteditable), block-level keys are
// suppressed and the text input keeps its native behaviour (cut/copy/paste/
// select/undo). macOS Cmd is treated as Ctrl via metaKey.

import { useEffect, useRef } from "react";

export interface ShortcutHandlers {
  onSave?: () => void;
  onSaveAs?: () => void;
  onOpen?: () => void;
  onNew?: () => void;
  onPrint?: () => void; // Ctrl+P → export PDF
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void; // Ctrl+0
  onRealSize?: () => void; // Ctrl+9 (100% real size)
  onZoomFit?: () => void; // Ctrl+1 (fit width)
  onClose?: () => void; // Ctrl+W (close project)
  onExportMenu?: () => void; // Ctrl+E (export chooser)
  onDeleteSelection?: () => void; // Delete / Backspace (outside text)
  onDuplicate?: () => void; // Ctrl+D
  onEscape?: () => void;
  onToggleBoundaries?: () => void; // Ctrl+G
  onToggleLang?: () => void; // Ctrl+L
  onToggleLeftPane?: () => void; // Ctrl+\
  onToggleRightPane?: () => void; // Ctrl+Shift+\
  onSelectNext?: () => void; // Tab
  onSelectPrev?: () => void; // Shift+Tab
  onSelectAll?: () => void; // Ctrl+A (outside text)
  onMoveUp?: () => void; // Alt+ArrowUp
  onMoveDown?: () => void; // Alt+ArrowDown
  onMoveColumnPrev?: () => void; // Alt+ArrowLeft
  onMoveColumnNext?: () => void; // Alt+ArrowRight
  onCopy?: () => void; // Ctrl+C (outside text)
  onCut?: () => void; // Ctrl+X (outside text)
  onPaste?: () => void; // Ctrl+V (outside text)
  onAddChild?: () => void; // Ctrl+Enter
  onSettings?: () => void; // Ctrl+,
  onToggleBadges?: () => void; // Ctrl+Shift+B
  onToggleWarnings?: () => void; // Ctrl+Shift+V
  onHelp?: () => void; // F1 / Ctrl+/
}

function isTextTarget(el: EventTarget | null): boolean {
  const n = el as HTMLElement | null;
  if (!n || !n.tagName) return false;
  const tag = n.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!n.isContentEditable;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  // keep the latest handlers in a ref so the listener binds only once
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const h = ref.current;
      const mod = e.ctrlKey || e.metaKey;
      const inText = isTextTarget(e.target);
      const key = e.key;

      if (key === "Escape") {
        h.onEscape?.();
        return;
      }
      if (!inText && (key === "Delete" || key === "Backspace")) {
        if (h.onDeleteSelection) {
          e.preventDefault();
          h.onDeleteSelection();
        }
        return;
      }
      // Tab / Shift+Tab: move block selection (only outside text fields)
      if (key === "Tab" && !inText && (h.onSelectNext || h.onSelectPrev)) {
        e.preventDefault();
        (e.shiftKey ? h.onSelectPrev : h.onSelectNext)?.();
        return;
      }
      // Alt + Arrows: reorder (up/down) or change column (left/right)
      if (e.altKey && !inText && key.startsWith("Arrow")) {
        const fn =
          key === "ArrowUp" ? h.onMoveUp
          : key === "ArrowDown" ? h.onMoveDown
          : key === "ArrowLeft" ? h.onMoveColumnPrev
          : key === "ArrowRight" ? h.onMoveColumnNext
          : undefined;
        if (fn) {
          e.preventDefault();
          fn();
        }
        return;
      }
      if (!mod) {
        if (key === "F1") {
          e.preventDefault();
          h.onHelp?.();
        }
        return;
      }

      const k = key.toLowerCase();
      // let the focused text field keep clipboard / select / undo combos
      if (inText && ["c", "x", "v", "a", "z", "y"].includes(k)) return;

      const run = (fn?: () => void) => {
        if (!fn) return;
        e.preventDefault();
        fn();
      };

      if (k === "s") return run(e.shiftKey ? h.onSaveAs : h.onSave);
      if (k === "o" && !e.shiftKey) return run(h.onOpen);
      if (k === "n" && !e.shiftKey) return run(h.onNew);
      if (k === "p" && !e.shiftKey) return run(h.onPrint);
      if (key === "+" || key === "=") return run(h.onZoomIn);
      if (key === "-" || key === "_") return run(h.onZoomOut);
      if (key === "0") return run(h.onZoomReset);
      if (key === "9") return run(h.onRealSize);
      if (key === "1") return run(h.onZoomFit);
      if (k === "w" && !e.shiftKey) return run(h.onClose);
      if (k === "e" && !e.shiftKey) return run(h.onExportMenu);
      if (key === "Enter") return run(h.onAddChild);
      if (key === ",") return run(h.onSettings);
      if (k === "a" && !e.shiftKey && !inText) return run(h.onSelectAll);
      if (k === "c" && !e.shiftKey && !inText) return run(h.onCopy);
      if (k === "x" && !e.shiftKey && !inText) return run(h.onCut);
      if (k === "v" && !e.shiftKey && !inText) return run(h.onPaste);
      if (k === "v" && e.shiftKey) return run(h.onToggleWarnings);
      if (k === "b" && e.shiftKey) return run(h.onToggleBadges);
      if (k === "d" && !e.shiftKey && !inText) return run(h.onDuplicate);
      if (k === "g" && !e.shiftKey) return run(h.onToggleBoundaries);
      if (k === "l" && !e.shiftKey) return run(h.onToggleLang);
      if (k === "/" || k === "?") return run(h.onHelp);
      if (e.key === "\\") return run(e.shiftKey ? h.onToggleRightPane : h.onToggleLeftPane);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
