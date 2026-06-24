// Thin typed wrappers over the Rust commands and Tauri plugins.

import { invoke } from "@tauri-apps/api/core";

export interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

export interface FigureFile {
  name: string;
  path: string;
  data_uri: string;
  bytes: number;
}

export const readText = (path: string) => invoke<string>("read_text", { path });

export const writeText = (path: string, contents: string) =>
  invoke<void>("write_text", { path, contents });

export const readFileAsDataUri = (path: string) =>
  invoke<string>("read_file_as_data_uri", { path });

export const writeFileFromBase64 = (path: string, base64Data: string) =>
  invoke<void>("write_file_from_base64", { path, base64Data });

/** N12: rasterize an EMF/WMF file to PNG (Windows only). */
export const convertEmfToPng = (src: string, dst: string) =>
  invoke<void>("convert_emf_to_png", { src, dst });

export const listDir = (path: string) => invoke<DirEntry[]>("list_dir", { path });

export const loadFigures = (dir: string) =>
  invoke<FigureFile[]>("load_figures", { dir });

export const pathExists = (path: string) =>
  invoke<boolean>("path_exists", { path });

export const ensureDir = (path: string) => invoke<void>("ensure_dir", { path });

export const joinPath = (base: string, segments: string[]) =>
  invoke<string>("join_path", { base, segments });
