# Getting started (from installation to PDF)

This guide walks a first-time user through installing Research Poster Studio (RPS) and turning a poster into a PDF.
Follow the screenshots and click the places marked with a red box, one step at a time.

日本語版: [getting-started.ja.md](getting-started.ja.md)

- [1. Which file to download](#1-which-file-to-download)
- [2. Windows (.exe)](#2-windows-exe)
- [3. Windows (.msi)](#3-windows-msi)
- [4. Mac (.dmg)](#4-mac-dmg)
- [5. Ubuntu (.deb)](#5-ubuntu-deb)
- [6. Ubuntu (.AppImage)](#6-ubuntu-appimage)
- [7. Build and run from source](#7-build-and-run-from-source)
- [8. Using the app](#8-using-the-app)

## 1. Which file to download

Downloads are on the [Releases](https://github.com/YukiInoueNakata/research_poster_studio/releases) page.
Open the newest release and pick one file from its "Assets" list.

| Computer | Recommended | Example file name |
|---|---|---|
| Windows | `.exe` (no administrator rights needed) | `Research.Poster.Studio_0.1.2_x64-setup.exe` |
| Windows (managed PCs, or if you want a standard uninstall) | `.msi` | `Research.Poster.Studio_0.1.2_x64_en-US.msi` |
| Mac (Intel or Apple silicon) | `.dmg` | `Research.Poster.Studio_0.1.2_universal.dmg` |
| Ubuntu | `.deb` | `Research.Poster.Studio_0.1.2_amd64.deb` |
| Ubuntu (run without installing) | `.AppImage` | `Research.Poster.Studio_0.1.2_amd64.AppImage` |

`0.1.2` is the version number; it changes with each release.

<!-- img: win-01-releases.png / win-02-assets.png -->

## 2. Windows (.exe)

### Install

1. On the Releases page, click `…_x64-setup.exe` to download it.
   <!-- img: win-03-downloaded.png -->
2. Double-click the downloaded file.
   <!-- img: win-04-open-installer.png -->
3. If "Windows protected your PC" appears, click "More info".
   This screen appears because the app is not digitally signed.
   <!-- img: win-05-smartscreen.png -->
4. Click "Run anyway".
   <!-- img: win-06-smartscreen-run.png -->
5. In the installer, click "Next" and "Install".
   <!-- img: win-07a… -->
6. Click "Finish". If "Run Research Poster Studio" is checked, the app starts.
   <!-- img: win-09-setup-finish.png -->

### Start

Open the Start menu, type "Research", and click "Research Poster Studio".

<!-- img: win-10-start-menu.png -->

### Uninstall

1. Open Settings → Apps → Installed apps, find "Research Poster Studio", and click "…".
   <!-- img: win-20-apps-list.png -->
2. Click "Uninstall" and follow the prompts.
   <!-- img: win-21-uninstall-menu.png / win-22… -->

Your posters (for example in `Documents\Research Poster Studio`) are not removed. Delete them yourself if you no longer need them.

> **If the uninstall is blocked**
> The `.exe` uninstaller (`uninstall.exe`) is not digitally signed. On PCs with **Smart App Control** turned on,
> it may be blocked and stop before it finishes, leaving `uninstall.exe` and the install folder behind.
> Close the app and delete this folder yourself:
>
> ```
> %LocalAppData%\Research Poster Studio
> ```
>
> Type `%LocalAppData%` in the File Explorer address bar and press Enter to get there.
> With Smart App Control off, or with the `.msi` build, the normal uninstall removes everything.

## 3. Windows (.msi)

### Install

1. On the Releases page, click `…_x64_en-US.msi` to download it.
2. Double-click the downloaded file.
   If "Windows protected your PC" appears, click "More info" → "Run anyway" (as in [section 2, steps 3–4](#install)).
3. Click "Next" through the installer.
   When asked "Do you want to allow this app to make changes to your device?", click "Yes".
   The `.msi` build installs for the whole PC, so Windows asks for administrator approval.
   <!-- img: co-author's screenshots (msi install) -->
4. Click "Finish".

Start the app the same way as the `.exe` build (type "Research" in the Start menu).

### Uninstall

Settings → Apps → Installed apps → "Research Poster Studio" → "…" → "Uninstall".
The `.msi` build uninstalls normally even when Smart App Control is on.

<!-- img: co-author's screenshots (msi uninstall) -->

## 4. Mac (.dmg)

### Install

1. On the Releases page, click `…_universal.dmg` to download it.
   The file goes into your Downloads folder. Double-click it.

   ![The dmg in the Downloads folder](images/getting-started/mac-01-downloads.png)

2. In the window that opens, drag the "Research Poster Studio.app" icon (1) onto the "Applications" folder (2) and let go.
   This copies the app into your Applications folder.

   ![The dmg window: drag 1 onto 2](images/getting-started/mac-02-dmg-window.png)

3. Open the Applications folder in Finder and double-click "Research Poster Studio".

   ![The Applications folder](images/getting-started/mac-03-applications.png)

4. macOS says the app "can't be opened because the developer cannot be verified". This is because the app is not digitally signed.
   Click "Cancel". **Do not click "Move to Trash".**

   ![The developer cannot be verified](images/getting-started/mac-04-gatekeeper.png)

5. In the Applications folder, **right-click** "Research Poster Studio" (two-finger click on a trackpad, or Control-click) and choose "Open".

   ![Open in the right-click menu](images/getting-started/mac-05-right-click.png)

6. When asked "Are you sure you want to open it?", click "Open".

   ![Open in the confirmation dialog](images/getting-started/mac-06-confirm-open.png)

7. The app starts. From now on, a normal double-click opens it; the right-click is needed only the first time.

   ![The app after starting](images/getting-started/mac-07-started.png)

On macOS 13 or later, if steps 5–6 do not open the app, go to System Settings → Privacy & Security and click "Open Anyway" near the bottom.

The screenshots are from a Japanese-language Mac (macOS 12).

> **If macOS says the app "is damaged and can't be opened"**
> Open Terminal (Applications → Utilities), paste this line, press Return, and open the app again:
>
> ```bash
> xattr -dr com.apple.quarantine "/Applications/Research Poster Studio.app"
> ```

### Uninstall

Move "Research Poster Studio" from the Applications folder to the Trash.

## 5. Ubuntu (.deb)

### Install

1. On the Releases page, click `…_amd64.deb` to download it.
2. Open a terminal and go to the download folder:

   ```bash
   cd ~/Downloads      # on a Japanese desktop: cd ~/ダウンロード
   ```

3. Run the following, replacing `0.1.2` with the version of the file you downloaded:

   ```bash
   sudo apt install ./Research.Poster.Studio_0.1.2_amd64.deb
   ```

   Enter your login password when asked (nothing is shown while you type).
   `sudo dpkg -i Research.Poster.Studio_0.1.2_amd64.deb` also works, but it fails if a required library
   (such as WebKitGTK) is missing; `apt install` installs missing libraries for you.

### Start

Click "Show Apps" at the bottom left and choose "Research Poster Studio".

### Uninstall

```bash
sudo apt remove research-poster-studio
```

To confirm, run the following; if it prints nothing, the app is gone:

```bash
dpkg -l | grep -i poster
```

## 6. Ubuntu (.AppImage)

This runs the app from a single file, without installing it.

### Setup (first time only)

1. On the Releases page, click `…_amd64.AppImage` to download it.
2. Open a terminal, go to the download folder, and make the file executable (replace `0.1.2` with your version):

   ```bash
   cd ~/Downloads      # on a Japanese desktop: cd ~/ダウンロード
   chmod +x ./Research.Poster.Studio_0.1.2_amd64.AppImage
   ```

### Start

```bash
./Research.Poster.Studio_0.1.2_amd64.AppImage
```

Messages such as `canberra-gtk-module` or `libgvfscommon.so: undefined symbol` may appear in the terminal.
If the app starts, they are harmless.
If the app does not start and reports that `libfuse.so.2` is missing, run `sudo apt install libfuse2t64` and try again (Ubuntu 24.04).

### Remove

Delete the downloaded `.AppImage` file.

## 7. Build and run from source

Use this to try the newest fixes or to contribute.
For installing Node.js, Rust, Git, and so on, see
[Windows setup from scratch](../README.md#windows-でゼロからセットアップする--windows-setup-from-scratch) in the README.
The steps below assume that setup is done and the repository has been cloned with `git clone`.

### Start

1. Open PowerShell (Terminal on Mac and Ubuntu).
2. Go to the repository folder, `research_poster_studio`, inside the folder where you ran `git clone`:

   ```powershell
   cd "C:\Users\<name>\research_poster_studio"
   ```

3. Run the following. The app window opens:

   ```powershell
   npm run dev
   ```

   Closing the app also ends the command.

### Update to a newer version

```powershell
cd "C:\Users\<name>\research_poster_studio"
git pull
npm install
npm run dev
```

- `npm install` is needed when the libraries the app uses have changed. If nothing changed it finishes quickly, so running it every time is fine.
  To check first, run `git diff --name-only HEAD@{1} HEAD` after `git pull`, and run `npm install` only if
  `package.json` or `package-lock.json` is listed.
- `npm run dev` also builds the shared libraries (core, renderer, exporter; `npm run build:libs`) before starting,
  so you do not need to run `npm run build:libs` separately.

## 8. Using the app

<!-- Screenshots are from Windows. The Mac app works the same way (read Ctrl as ⌘). -->

### Open the sample

1. When the app starts, a small "Research Poster Studio" window appears. Click "Open sample (English)".
   The sample is copied to `Documents\Research Poster Studio\samples`, where you can edit it freely.
   <!-- img: app-01-start-en.png -->
2. The sample poster opens. The parts of the screen are:
   <!-- img: app-02-overview-en.png (with numbered labels) -->

### Edit text

1. In the poster in the middle, click the text you want to change.
   <!-- img: app-10-click-block-en.png -->
2. An editor for that text appears on the right.
   <!-- img: app-11-editor-en.png -->
3. Edit the text; the poster updates right away.
   <!-- img: app-12-typed-en.png -->
4. To undo a mistake, click "Undo" (or press Ctrl+Z).
   <!-- img: app-13-undo-en.png -->
5. Click "Save" (or press Ctrl+S).
   <!-- img: app-14-save-en.png -->

### Make a PDF

1. Click "PDF" at the top right.
   <!-- img: app-30-export-buttons-en.png -->
2. The print dialog opens. Set:
   - Destination: "Save as PDF"
   - Paper size: the poster's size (A0 for an A0 poster)
   - Margins: None
   - Scale: 100%
   <!-- img: app-31〜36 -->
3. Click "Save" and choose where to save the file and its name.
   <!-- img: app-37-save-dialog-en.png -->
4. Open the PDF and check that the whole poster fits on one page.
   <!-- img: app-38-pdf-result-en.png -->

On a Mac, A0 is not in the print dialog's paper sizes: use "Manage Custom Sizes" to create 841 × 1189 mm (zero margins) and select it.
See [PDF from the desktop app](../README.md#デスクトップアプリから-pdf-を書き出す--pdf-from-the-desktop-app) in the README.

### Save as an image (PNG) and other formats

Click "PNG", "PPTX", "Markdown", and so on to save the poster in that format.

<!-- img: app-40〜42 -->

### Make a new poster

1. Click "New".
   <!-- img: app-50-new-button-en.png -->
2. Answer the setup wizard's questions, clicking "Next" each time, and click "Create" at the end.
   <!-- img: app-51… -->
3. The new poster opens. Write your text the same way as in "Edit text".
   <!-- img: app-52-created-en.png -->

### If something goes wrong

- If text overflows the poster, it is listed under the "Warnings" tab at the bottom. Shorten the text, or change the font size or column balance in "Settings".
- If the app does not work, please open an [issue](https://github.com/YukiInoueNakata/research_poster_studio/issues) and tell us your computer (Windows, Mac, or Ubuntu, and its version) and what happened.
