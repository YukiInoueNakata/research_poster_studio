// Research Poster Studio - Rust backend.
//
// The frontend owns layout/rendering. Rust handles only filesystem I/O so the
// project (poster.yaml, content/*.md, figures/*) stays as plain text files that
// Agent LLMs can read and edit directly.

use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
struct DirEntry {
    name: String,
    path: String,
    is_dir: bool,
}

#[derive(Serialize)]
struct FigureFile {
    name: String,
    path: String,
    /// data URI (data:<mime>;base64,...) so the webview can render it and the
    /// HTML/SVG exporter can embed it without external file references.
    data_uri: String,
    /// file size in bytes (used for resolution / quality warnings)
    bytes: u64,
}

fn mime_for(ext: &str) -> &'static str {
    match ext.to_ascii_lowercase().as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "emf" => "image/x-emf",
        "wmf" => "image/x-wmf",
        "pdf" => "application/pdf",
        "csv" => "text/csv",
        "mmd" => "text/plain",
        "dot" | "gv" => "text/vnd.graphviz",
        _ => "application/octet-stream",
    }
}

/// Read a UTF-8 text file.
#[tauri::command]
fn read_text(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("read_text {path}: {e}"))
}

/// Write a UTF-8 text file, creating parent directories as needed.
#[tauri::command]
fn write_text(path: String, contents: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create_dir_all: {e}"))?;
    }
    fs::write(&path, contents).map_err(|e| format!("write_text {path}: {e}"))
}

/// Read a binary file and return it as a base64 data URI.
#[tauri::command]
fn read_file_as_data_uri(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| format!("read {path}: {e}"))?;
    let ext = Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    let mime = mime_for(ext);
    Ok(format!("data:{};base64,{}", mime, B64.encode(&bytes)))
}

/// Decode a base64 payload and write it to a binary file (used for PPTX export
/// where pptxgenjs produces a base64 blob in the frontend).
#[tauri::command]
fn write_file_from_base64(path: String, base64_data: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create_dir_all: {e}"))?;
    }
    // accept both raw base64 and "data:...;base64,xxxx"
    let payload = match base64_data.split_once(";base64,") {
        Some((_, data)) => data,
        None => base64_data.as_str(),
    };
    let bytes = B64
        .decode(payload.trim())
        .map_err(|e| format!("base64 decode: {e}"))?;
    fs::write(&path, bytes).map_err(|e| format!("write {path}: {e}"))
}

/// List entries of a directory (non-recursive).
#[tauri::command]
fn list_dir(path: String) -> Result<Vec<DirEntry>, String> {
    let mut out = Vec::new();
    let rd = fs::read_dir(&path).map_err(|e| format!("read_dir {path}: {e}"))?;
    for entry in rd.flatten() {
        let p = entry.path();
        let is_dir = p.is_dir();
        out.push(DirEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: p.to_string_lossy().to_string(),
            is_dir,
        });
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

/// Load every image-like figure in a directory as data URIs.
#[tauri::command]
fn load_figures(dir: String) -> Result<Vec<FigureFile>, String> {
    let mut out = Vec::new();
    let rd = match fs::read_dir(&dir) {
        Ok(rd) => rd,
        Err(_) => return Ok(out), // no figures dir yet is fine
    };
    for entry in rd.flatten() {
        let p = entry.path();
        if !p.is_file() {
            continue;
        }
        let ext = p
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        // images + convertible figure sources (PDF / CSV table / Mermaid / Graphviz)
        if !matches!(
            ext.as_str(),
            "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "emf" | "wmf" | "pdf" | "csv" | "mmd" | "dot" | "gv"
        ) {
            continue;
        }
        let bytes = match fs::read(&p) {
            Ok(b) => b,
            Err(_) => continue,
        };
        let mime = mime_for(&ext);
        out.push(FigureFile {
            name: entry.file_name().to_string_lossy().to_string(),
            path: p.to_string_lossy().to_string(),
            data_uri: format!("data:{};base64,{}", mime, B64.encode(&bytes)),
            bytes: bytes.len() as u64,
        });
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

#[tauri::command]
fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
fn ensure_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| format!("ensure_dir {path}: {e}"))
}

/// Join path segments using the OS separator (so the frontend stays
/// platform-agnostic).
#[tauri::command]
fn join_path(base: String, segments: Vec<String>) -> String {
    let mut p = PathBuf::from(base);
    for s in segments {
        p.push(s);
    }
    p.to_string_lossy().to_string()
}

/// Locate the bundled sample project by walking up from the current dir and
/// the executable dir looking for `examples/sample-poster/poster.yaml`.
#[tauri::command]
fn sample_project_dir() -> Result<String, String> {
    let mut roots: Vec<PathBuf> = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        roots.push(cwd);
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(p) = exe.parent() {
            roots.push(p.to_path_buf());
        }
    }
    for root in roots {
        let mut dir: Option<&Path> = Some(root.as_path());
        let mut depth = 0;
        while let Some(d) = dir {
            let candidate = d.join("examples").join("sample-poster");
            if candidate.join("poster.yaml").exists() {
                return Ok(candidate.to_string_lossy().to_string());
            }
            if depth >= 7 {
                break;
            }
            depth += 1;
            dir = d.parent();
        }
    }
    Err("sample-poster が見つかりません".into())
}

/// Read an image from the OS clipboard, save it as PNG under `<dir>/figures/`,
/// and return the saved filename.
#[tauri::command]
fn paste_clipboard_image(dir: String) -> Result<String, String> {
    use std::time::{SystemTime, UNIX_EPOCH};
    let mut cb = arboard::Clipboard::new().map_err(|e| format!("clipboard init: {e}"))?;
    let img = cb
        .get_image()
        .map_err(|_| "クリップボードに画像がありません".to_string())?;
    let w = img.width as u32;
    let h = img.height as u32;
    let buf = image::RgbaImage::from_raw(w, h, img.bytes.into_owned())
        .ok_or_else(|| "画像データの変換に失敗しました".to_string())?;
    let fig_dir = Path::new(&dir).join("figures");
    fs::create_dir_all(&fig_dir).map_err(|e| format!("create figures dir: {e}"))?;
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let name = format!("clip-{millis}.png");
    buf.save_with_format(fig_dir.join(&name), image::ImageFormat::Png)
        .map_err(|e| format!("save png: {e}"))?;
    Ok(name)
}

/// Copy a file if it exists (helper for backup_project).
fn copy_if_exists(src: &Path, dst_dir: &Path) -> Result<(), String> {
    if src.is_file() {
        let name = src
            .file_name()
            .ok_or_else(|| "invalid file name".to_string())?;
        fs::copy(src, dst_dir.join(name)).map_err(|e| format!("copy {src:?}: {e}"))?;
    }
    Ok(())
}

/// Copy every regular file in a directory (non-recursive) into dst_dir/<name>.
fn copy_dir_files(src: &Path, dst: &Path) -> Result<(), String> {
    if !src.is_dir() {
        return Ok(());
    }
    fs::create_dir_all(dst).map_err(|e| format!("create {dst:?}: {e}"))?;
    let rd = fs::read_dir(src).map_err(|e| format!("read_dir {src:?}: {e}"))?;
    for entry in rd.flatten() {
        let p = entry.path();
        if p.is_file() {
            fs::copy(&p, dst.join(entry.file_name())).map_err(|e| format!("copy {p:?}: {e}"))?;
        }
    }
    Ok(())
}

/// Snapshot the project's text sources (poster yaml, content/, styles/,
/// references.bib) into backups/<timestamp>/ and prune old generations.
/// Figure binaries are not copied (they are large and rarely corrupted by the
/// app). Returns the backup directory name.
#[tauri::command]
fn backup_project(dir: String, poster_file: String, keep: usize) -> Result<String, String> {
    let root = Path::new(&dir);
    if !root.join(&poster_file).is_file() {
        return Err(format!("{poster_file} がありません: {dir}"));
    }
    let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S").to_string();
    let backups = root.join("backups");
    let dest = backups.join(&stamp);
    fs::create_dir_all(&dest).map_err(|e| format!("create backup dir: {e}"))?;

    copy_if_exists(&root.join(&poster_file), &dest)?;
    copy_if_exists(&root.join("references.bib"), &dest)?;
    copy_dir_files(&root.join("content"), &dest.join("content"))?;
    copy_dir_files(&root.join("styles"), &dest.join("styles"))?;

    // prune: keep the newest `keep` generations (timestamp names sort correctly)
    let mut gens: Vec<String> = Vec::new();
    if let Ok(rd) = fs::read_dir(&backups) {
        for entry in rd.flatten() {
            if entry.path().is_dir() {
                gens.push(entry.file_name().to_string_lossy().to_string());
            }
        }
    }
    gens.sort();
    while gens.len() > keep.max(1) {
        let old = gens.remove(0);
        let _ = fs::remove_dir_all(backups.join(&old));
    }
    Ok(stamp)
}

/// List installed font family names on this machine (sorted, de-duplicated).
#[tauri::command]
fn list_fonts() -> Vec<String> {
    let mut db = fontdb::Database::new();
    db.load_system_fonts();
    let mut set = std::collections::BTreeSet::new();
    for face in db.faces() {
        for (name, _lang) in &face.families {
            let n = name.trim();
            if !n.is_empty() {
                set.insert(n.to_string());
            }
        }
    }
    set.into_iter().collect()
}

/// N12: rasterize an EMF/WMF vector image to PNG. Windows-only (uses GDI+ via
/// System.Drawing through PowerShell); returns an error on other platforms.
#[tauri::command]
fn convert_emf_to_png(src: String, dst: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let s = src.replace('\'', "''");
        let d = dst.replace('\'', "''");
        let ps = format!(
            "Add-Type -AssemblyName System.Drawing; \
             $img=[System.Drawing.Image]::FromFile('{s}'); \
             $sc=4; \
             $bmp=New-Object System.Drawing.Bitmap([int]($img.Width*$sc)),([int]($img.Height*$sc)); \
             $g=[System.Drawing.Graphics]::FromImage($bmp); \
             $g.Clear([System.Drawing.Color]::White); \
             $g.DrawImage($img,0,0,$bmp.Width,$bmp.Height); \
             $bmp.Save('{d}',[System.Drawing.Imaging.ImageFormat]::Png); \
             $g.Dispose(); $bmp.Dispose(); $img.Dispose()"
        );
        let out = std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &ps])
            .output()
            .map_err(|e| e.to_string())?;
        if !out.status.success() {
            return Err(String::from_utf8_lossy(&out.stderr).to_string());
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (src, dst);
        Err("EMF/WMF conversion is only supported on Windows".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_text,
            write_text,
            read_file_as_data_uri,
            write_file_from_base64,
            list_dir,
            load_figures,
            path_exists,
            ensure_dir,
            join_path,
            sample_project_dir,
            paste_clipboard_image,
            backup_project,
            list_fonts,
            convert_emf_to_png,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
