//! macOS: save the poster as a PDF without the print panel.
//!
//! On a Mac without printers the print panel offers no paper size, so the
//! poster was split over the default paper (A4) and the README's "set the
//! paper to A0" step could not be done (macOS 26, 2026-10-19).
//!
//! WebKit's createPDF captures the page content as one PDF page whose size in
//! points equals the content size in CSS px. The frontend shows only the poster,
//! zoomed so that its CSS px equal PDF points (mm * 72 / 25.4), and calls this;
//! the page is therefore exactly the poster's size. (A panel-less
//! NSPrintOperation was tried first: WebKit had not drawn yet, so it wrote an
//! endless run of blank A0 pages.)

use std::sync::mpsc::Sender;
use std::sync::Mutex;

use block2::RcBlock;
use objc2::MainThreadMarker;
use objc2_core_foundation::{CGPoint, CGRect, CGSize};
use objc2_foundation::{NSData, NSError};
use objc2_web_kit::{WKPDFConfiguration, WKWebView};

/// Starts the capture; `done` receives the result when WebKit has finished.
/// `rect` (CSS px from the top-left) limits the capture to the poster when it
/// is smaller than the window; `None` captures the whole page content.
/// Must run on the main thread (from `Webview::with_webview`).
///
/// # Safety
/// `webview` must be the `WKWebView` pointer handed out by wry/Tauri.
pub unsafe fn save_pdf(webview: *mut std::ffi::c_void, path: String, rect: Option<(f64, f64)>, done: Sender<Result<(), String>>) {
    if webview.is_null() {
        let _ = done.send(Err("no webview".into()));
        return;
    }
    let wv: &WKWebView = unsafe { &*(webview as *const WKWebView) };
    let done = Mutex::new(Some(done));
    let handler = RcBlock::new(move |data: *mut NSData, err: *mut NSError| {
        let result = if !data.is_null() {
            let bytes = unsafe { &*data }.to_vec();
            std::fs::write(&path, bytes).map_err(|e| format!("{path}: {e}"))
        } else if !err.is_null() {
            Err(unsafe { &*err }.localizedDescription().to_string())
        } else {
            Err("WebKit returned no PDF data".into())
        };
        if let Some(tx) = done.lock().ok().and_then(|mut g| g.take()) {
            let _ = tx.send(result);
        }
    });
    let config = match (rect, MainThreadMarker::new()) {
        (Some((w, h)), Some(mtm)) => {
            let c = unsafe { WKPDFConfiguration::new(mtm) };
            unsafe { c.setRect(CGRect::new(CGPoint::new(0.0, 0.0), CGSize::new(w, h))) };
            Some(c)
        }
        _ => None, // no configuration = capture the whole page content
    };
    unsafe { wv.createPDFWithConfiguration_completionHandler(config.as_deref(), &handler) };
}
