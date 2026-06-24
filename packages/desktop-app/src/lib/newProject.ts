// New-project wizard I/O layer. The pure doc-building logic lives in
// newProjectCore.ts so it can be exercised from Node-based checks.
//
// Unlike the CLI `rps init` (which reads skills/ template YAMLs), the GUI wizard
// builds its structures inline (single-study / multi-study × 日本語 / English),
// so packaged builds need no repository checkout.

import { ensureDir, joinPath, pathExists, writeText } from "./tauri";
import { docToYaml, POSTER_FILE } from "./project";
import {
  STRUCTURES,
  buildNewDoc,
  isValidFolderName,
  scaffoldFiles,
  type NewProjectInput,
  type StructureId,
} from "./newProjectCore";

export { buildNewDoc, isValidFolderName, STRUCTURES } from "./newProjectCore";
export type { NewProjectInput, WizardAuthor, StructureId, WizardLang } from "./newProjectCore";

/** Structure choices shown in the wizard (× language toggle). */
export const WIZARD_STRUCTURES: { id: StructureId; label: string; description: string }[] =
  STRUCTURES.map((s) => ({ id: s.id, label: s.label, description: s.description }));

/** Marker thrown by createNewProject when the target folder already exists. */
export const DIR_EXISTS = "DIR_EXISTS";

/**
 * Create the project directory and all scaffold files. If the target directory
 * already exists and `input.allowExisting` is not set, throws an error tagged
 * with code === DIR_EXISTS so the wizard can ask the user for confirmation.
 * Returns the absolute project path.
 */
export async function createNewProject(input: NewProjectInput): Promise<string> {
  const folder = input.folderName.trim();
  if (!input.parentDir) throw new Error("保存先の親フォルダを選択してください．");
  if (!isValidFolderName(folder)) {
    throw new Error(`プロジェクト名に使えない文字が含まれています: ${folder}`);
  }
  const dir = await joinPath(input.parentDir, [folder]);
  if (!input.allowExisting && (await pathExists(dir))) {
    const err: any = new Error(`既に存在するフォルダです: ${dir}`);
    err.code = DIR_EXISTS;
    err.dir = dir;
    throw err;
  }

  const doc = buildNewDoc(input);

  await ensureDir(dir);
  await ensureDir(await joinPath(dir, ["content"]));
  await ensureDir(await joinPath(dir, ["figures"]));

  await writeText(await joinPath(dir, [POSTER_FILE]), docToYaml(doc));
  for (const f of scaffoldFiles(doc, input.language)) {
    await writeText(await joinPath(dir, f.segments), f.content);
  }

  return dir;
}
