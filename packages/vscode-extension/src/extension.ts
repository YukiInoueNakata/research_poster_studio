// Research Poster Studio — minimal VS Code extension.
// Reuses @rps/core (validation) and @rps/renderer (HTML) — no layout engine of
// its own. Provides: Validate (diagnostics), Open Preview (webview, refreshes
// on save), Show Warnings. Export / Create delegate to the CLI / desktop app.

import * as vscode from "vscode";
import * as path from "node:path";
import { validatePosterYaml, type Warning } from "@rps/core";
import { loadPosterProjectFs } from "@rps/core/node";
import { buildHtml } from "@rps/renderer";

const POSTER_FILE = "poster.yaml";

function isPosterDoc(doc: vscode.TextDocument): boolean {
  return path.basename(doc.fileName) === POSTER_FILE;
}

/** The active poster.yaml document, or any visible/open one. */
function findPosterDoc(): vscode.TextDocument | undefined {
  const active = vscode.window.activeTextEditor?.document;
  if (active && isPosterDoc(active)) return active;
  return vscode.workspace.textDocuments.find(isPosterDoc);
}

/** Best-effort: 0-based line of `id: <id>` in the yaml (else 0). */
function lineOfId(text: string, id?: string): number {
  if (!id) return 0;
  const lines = text.split(/\r?\n/);
  const re = new RegExp(`\\bid:\\s*["']?${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']?\\s*$`);
  const i = lines.findIndex((l) => re.test(l) || l.includes(`id: ${id}`));
  return i >= 0 ? i : 0;
}

function severityOf(level: Warning["level"]): vscode.DiagnosticSeverity {
  return level === "error"
    ? vscode.DiagnosticSeverity.Error
    : level === "warn"
      ? vscode.DiagnosticSeverity.Warning
      : vscode.DiagnosticSeverity.Information;
}

function runValidate(doc: vscode.TextDocument, diagnostics: vscode.DiagnosticCollection): number {
  const text = doc.getText();
  const res = validatePosterYaml(text);
  const out: vscode.Diagnostic[] = [];
  for (const e of res.errors) {
    out.push(
      new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 1),
        e,
        vscode.DiagnosticSeverity.Error,
      ),
    );
  }
  for (const w of res.warnings) {
    const line = lineOfId(text, w.blockId);
    const lineText = text.split(/\r?\n/)[line] ?? "";
    const range = new vscode.Range(line, 0, line, Math.max(1, lineText.length));
    const d = new vscode.Diagnostic(range, w.message, severityOf(w.level));
    d.source = `rps:${w.code}`;
    out.push(d);
  }
  diagnostics.set(doc.uri, out);
  return out.length;
}

// ---- preview webview --------------------------------------------------------

let previewPanel: vscode.WebviewPanel | undefined;
let previewDir: string | undefined;

function previewScaleStyle(): string {
  // Fit-to-width scaling for the webview (the poster is rendered at mm size).
  return `<style>
    html,body{margin:0;background:#3a3a3a;}
    .rps-poster{ zoom: 0.32; box-shadow:0 0 0 1px #888; margin:12px auto; }
    @media print { .rps-poster{ zoom:1; } }
  </style>`;
}

async function renderPreviewHtml(dir: string): Promise<string> {
  const project = await loadPosterProjectFs(dir);
  // No diagram conversion here (graphviz/mermaid show placeholders in-preview;
  // use `rps export` or the desktop app for full-fidelity output).
  const html = buildHtml(project);
  return html.replace("</head>", `${previewScaleStyle()}</head>`);
}

async function refreshPreview() {
  if (!previewPanel || !previewDir) return;
  try {
    previewPanel.webview.html = await renderPreviewHtml(previewDir);
  } catch (e: any) {
    previewPanel.webview.html = `<body style="font-family:sans-serif;padding:16px;color:#c00">
      <h3>Research Poster — preview error</h3><pre>${String(e?.message ?? e)}</pre></body>`;
  }
}

async function openPreview(context: vscode.ExtensionContext) {
  const doc = findPosterDoc();
  if (!doc) {
    vscode.window.showWarningMessage("poster.yaml を開いてからプレビューを実行してください．");
    return;
  }
  previewDir = path.dirname(doc.fileName);
  if (previewPanel) {
    previewPanel.reveal(vscode.ViewColumn.Beside);
  } else {
    previewPanel = vscode.window.createWebviewPanel(
      "rpsPreview",
      "Poster Preview",
      vscode.ViewColumn.Beside,
      { enableScripts: false, retainContextWhenHidden: true },
    );
    previewPanel.onDidDispose(
      () => {
        previewPanel = undefined;
        previewDir = undefined;
      },
      null,
      context.subscriptions,
    );
  }
  await refreshPreview();
}

// ---- activation -------------------------------------------------------------

export function activate(context: vscode.ExtensionContext) {
  const diagnostics = vscode.languages.createDiagnosticCollection("rps");
  context.subscriptions.push(diagnostics);

  const onChange = (doc: vscode.TextDocument) => {
    if (!isPosterDoc(doc)) return;
    runValidate(doc, diagnostics);
    if (previewPanel && previewDir === path.dirname(doc.fileName)) void refreshPreview();
  };
  vscode.workspace.textDocuments.forEach((d) => isPosterDoc(d) && runValidate(d, diagnostics));
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(onChange),
    vscode.workspace.onDidOpenTextDocument((d) => isPosterDoc(d) && runValidate(d, diagnostics)),
    vscode.workspace.onDidCloseTextDocument((d) => isPosterDoc(d) && diagnostics.delete(d.uri)),
  );

  const delegate = (what: string) =>
    vscode.window.showInformationMessage(
      `${what} は \`rps ${what === "PDF" ? "export pdf" : "export png"}\`（CLI）またはデスクトップアプリを使ってください．`,
    );

  context.subscriptions.push(
    vscode.commands.registerCommand("rps.validate", () => {
      const doc = findPosterDoc();
      if (!doc) return void vscode.window.showWarningMessage("poster.yaml が見つかりません．");
      const n = runValidate(doc, diagnostics);
      vscode.window.showInformationMessage(`Research Poster: ${n} 件の指摘（problems パネル参照）．`);
    }),
    vscode.commands.registerCommand("rps.openPreview", () => openPreview(context)),
    vscode.commands.registerCommand("rps.showWarnings", () => {
      const doc = findPosterDoc();
      if (doc) runValidate(doc, diagnostics);
      void vscode.commands.executeCommand("workbench.actions.view.problems");
    }),
    vscode.commands.registerCommand("rps.createNew", () =>
      vscode.window.showInformationMessage(
        "新規作成はデスクトップアプリの設定ウィザード，または `rps init -t <template> <dir>`（CLI）を使ってください．",
      ),
    ),
    vscode.commands.registerCommand("rps.exportPdf", () => delegate("PDF")),
    vscode.commands.registerCommand("rps.exportPng", () => delegate("PNG")),
  );
}

export function deactivate() {
  previewPanel?.dispose();
}
