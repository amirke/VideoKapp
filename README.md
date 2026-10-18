# VideoKapp — ChronoMerge 3.8.6

Windows desktop video merging, conversion, GPS ride playback and AI-assisted editing.
The application window and executable currently use the name ChronoMerge.
This version targets **Windows x64**. It is not a web app and has not been ported or tested on macOS or Linux.

## Website launch and full installation

Open [VideoKapp](https://amirke.github.io/VideoKapp/) for download and installation instructions. Download the release ZIP, Extract All, and run `Install.cmd`. This installs the bundled application for your Windows user, creates shortcuts and registers `videokapp://open` so the website can open the app. It does not convert the editor to a web app or upload your media. No administrator rights, Node.js or Git required. The unsigned installer may be restricted by Windows or organizational policy.

The website requests an app launch but cannot verify that the app opened. Accept the browser confirmation if prompted. From version 3.8.6, Tests → Check & download update downloads changed components only. Install & restart switches to the verified new version. Previous application folders and user data remain unchanged.

## Run without installation (portable)

1. Open [Releases](https://github.com/amirke/VideoKapp/releases).
2. Download **VideoKapp-Windows-x64.zip** from the release assets (not GitHub's Source code ZIP).
3. Extract the entire ZIP into a folder.
4. Run **ChronoMerge.exe** inside the extracted folder.

No Node.js, npm, Git or FFmpeg installation is needed for this portable download. Keep all extracted files together. Ollama and its models are optional and separate; Gemini and online maps require internet. The repository and release downloads are public.

## Run from source (for development only)

1. Install Node.js 22 or newer: https://nodejs.org/en/download
2. Clone this repository, or download its ZIP from GitHub and extract it.
3. Double-click `Setup.cmd` once. This installs locked npm dependencies and a checksum-verified FFmpeg build. Internet is required.
4. Double-click `Start.cmd`.

Your videos, GPS files and credentials stay on your computer; choose them in the app.
Git does not synchronize your media or account connections.

## Build a portable version

After setup, run `node package.cjs dist/ChronoMerge` and copy the entire resulting directory to another Windows x64 computer. Start `ChronoMerge.exe` inside it. Node.js is not required on the receiving computer. Do not copy only the EXE.

Alternatively, open GitHub **Actions → Build Windows portable ZIP → Run workflow**. After a successful run, download the artifact, extract the ZIP inside it, and run `ChronoMerge.exe`. This workflow must complete successfully before its download can be considered verified.

## Diagnostics and updates

The Tests tab runs named component checks with progress and STOP, using a one-second synthetic clip. It lists every current button and backend action, and distinguishes wiring from end-to-end execution. File dialogs, uploads, AI inference and actual map rendering still require the relevant files/accounts and a real workflow. Optional online checks read service status without uploading video. Copy test report provides readable results.

The installed version appears in the header. Check for updates queries GitHub and compares it numerically with the installed version. Check & download update compares the installed release with GitHub and automatically downloads only changed components (application code, maps, FFmpeg, Electron). Files are SHA-256 verified; unchanged components are copied locally, so a full second application folder temporarily requires disk space. STOP cancels preparation without changing the current installation. Install & restart closes the app, updates existing shortcuts and launches the new version. The previous folder is retained; launch it directly if recovery is needed. A launched process is not proof that every startup workflow succeeds.

For older versions, download VideoKapp-Update.zip from Releases, Extract All, close VideoKapp and run Update.cmd. This small bootstrap locates the installed application (or lets you choose it), then downloads changed components using the same updater. No full download is required when Electron and FFmpeg are unchanged. The full Windows ZIP remains available for first installation.

## Main features

- Merge clips in chronological order; create recording-time timeline logs.
- Convert individual videos, create reduced AI copies, or reuse a saved copy and its `.ai.json` manifest.
- Ride Player matches video time to GPX/FIT/KML and displays selectable base maps, overlays and GPS progress.
- Export a selected IN/OUT range with a draggable/resizable map PiP.
- Ollama and Gemini propose edits; review clips against the original before exporting.
- Processing controls include progress and STOP. Map services require internet when enabled.

## AI connections

**Ollama is optional.** Install and start Ollama separately on each computer using https://ollama.com/download, then use Check connection/models in the OLLAMA tab. Download a local vision model such as the app's configured `gemma3:4b` using its Download model button. Models are not included in this repository. Performance depends on the computer. The Start local engine button is for an existing portable Ollama-runtime folder; an independently installed Ollama server should already be running on 127.0.0.1:11434.

**Gemini is optional.** Supply your own API key in the GUI. Availability, quotas and billing depend on your Google project. Upload only the reduced copy; export uses the original. Keys are not stored in source or CFG.

**YouTube** requires your own OAuth app/account setup. Existing encrypted credentials are tied to the Windows account; reconnect on another computer.

## Source and licensing

Application: GPL-2.0-only, with LosslessCut-derived concatenation logic. See `LICENSE`, `THIRD_PARTY.md`, and `upstream/`. Electron and MapLibre license notices are retained. FFmpeg is downloaded separately; the installer checks the archive SHA-256 against the exact archive used during development. Public map services retain their own attribution and usage conditions.

Do not commit media, `.cfg`, API keys, OAuth client secrets, logs, model files, or generated executables. `.gitignore` excludes common examples; review any newly added files before committing.
