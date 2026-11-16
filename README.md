# VideoKapp — ChronoMerge 3.12.5

Windows desktop video merging, conversion, GPS ride playback and AI-assisted editing.
The application window and executable currently use the name ChronoMerge.
This version targets **Windows x64**. It is not a web app and has not been ported or tested on macOS or Linux.

## Website launch and full installation

Open [VideoKapp](https://amirke.github.io/VideoKapp/) for download and installation instructions. Download the release ZIP, Extract All, and run `Install.cmd`. This installs the bundled application for your Windows user, creates shortcuts and registers `videokapp://open` so the website can open the app. It does not convert the editor to a web app or upload your media. No administrator rights, Node.js or Git required. The unsigned installer may be restricted by Windows or organizational policy.

The website requests an app launch but cannot verify that the app opened. Accept the browser confirmation if prompted. In the application, Tests → Check & download update downloads changed components only. Install & restart switches to the verified new version. Previous application folders and user data remain unchanged.

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

## Copying text

Select text, right-click and choose Copy (or Ctrl+C). Editable fields also offer Cut and Paste. Tests includes Copy test report for the complete diagnostic report.

## Diagnostics and updates

The Tests tab runs named component checks with progress and STOP, using a one-second synthetic clip. It lists every current button and backend action, and distinguishes wiring from end-to-end execution. File dialogs, uploads, AI inference and actual map rendering still require the relevant files/accounts and a real workflow. Optional online checks read service status without uploading video. Copy test report provides readable results.

The installed version appears in the header. Check for updates queries GitHub and compares it numerically with the installed version. Check & download update compares the installed release with GitHub and automatically downloads only changed components (application code, maps, FFmpeg, Electron). Files are SHA-256 verified; unchanged components are copied locally, so a full second application folder temporarily requires disk space. STOP cancels preparation without changing the current installation. After download and verification, the app asks "Restart the program now?". Later keeps the app open and the prepared update available for this session. Install & restart asks again and, only after Restart now is selected, closes the app, updates existing shortcuts and launches the new version. The previous folder is retained; launch it directly if recovery is needed. A launched process is not proof that every startup workflow succeeds.

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

### CesiumJS and map layers
In Ride Player, choose Map view > CesiumJS for a 3D globe using free Re:Earth terrain (no API key). Base map selects the background; Overlay selects any existing provider with adjustable opacity. None removes the overlay. Re:Earth as an overlay supplies satellite imagery, not a second terrain surface. OpenFreeMap layers are rasterized locally and may load more slowly. GPS timestamps, full route, progress trail, Follow and PiP capture use the same timeline. Map view and layer selection can be saved in CFG. Internet is needed for map data.

## Ride Player: synchronized GPS and live PiP

Video and GPS have separate seek bars. Video Play uses the displayed video frame time; GPS Play explores the whole activity, including intervals without video. Both use the original timeline and configured clock corrections. Follow location and Align with ride default to on. Live map PiP moves the same map over the video, with a draggable header and width slider; no encoding is involved.

Optional Auto zoom targets a chosen count of app-added markers within 500 metres of the route: POIs and road junctions from OpenStreetMap, plus turns calculated locally. Search radius limits zoom-out; it does not count labels baked into map images. Nearby coordinates/radius are sent to the public [Overpass service](https://overpass.private.coffee/), never the video or GPX file. Lookup is cancellable, capped at 8 MB, cached for one hour and throttled to one request per 45 seconds. Service failures are shown; local turns still work. Public service availability and POI completeness are not guaranteed.

Ride Player 3.12.5 adds optional map camera smoothing (default 1.5 seconds), a North up lock, and an explicit breakdown of applied video timestamp interpretation, recording-end adjustment, manual correction and GPS correction. Smoothing changes the camera only, not the GPS marker or synchronization. No clock correction is inferred or automatically applied.

## Live timing calibration and Hebrew vector labels (3.12.5)

The Video → GPS offset field above the video is the same manual correction used by Ride Player, not an additional offset. Positive values select later GPS timestamps. The video clock and selected GPS clock are shown separately; the blue reference marker is the GPS coordinate before manual correction, and red is after correction. Neither a camera watermark nor a zero calculated clock difference proves synchronization to the GPS device. No offset is inferred or automatically applied.

Labels layer is independent of Base map and Overlay. OpenFreeMap Liberty and Bright use native MapLibre symbol layers, prefer name:he when present, and fall back to the local name. They use Standard view (selecting them switches from Cesium); Re:Earth provides terrain in this view. Text stays screen-aligned. EOX labels/roads is also selectable, as a raster layer with provider-defined language. Native vector labels are supported in Ride Player and the AI preview. These are two styles of OpenFreeMap, not two independent map datasets. Hebrew availability varies by feature.

Video → GPS offset accepts numeric minutes and seconds, including negative and fractional values (combined limit: one year). ±15 minute and ±1 second buttons remain available. The total is saved in seconds. Live PiP width ranges from 10–95%; drag its border or corners to resize while retaining the map aspect ratio. Map zoom can reach level 0. Video and GPS play buttons show their current play/pause state.

## Ride Player layout (3.12.5)

The page follows the working sequence: file loading, paired video/GPS viewing, synchronization, map appearance, and export. File buttons and their paths share three cards. Advanced timing/map controls and diagnostics are collapsible. The before-offset marker is hidden at zero offset and repositions when the map or PiP is resized. Existing control IDs, CFG operations, draggable split and PiP behavior are preserved.

The GPS target clock shows milliseconds and the selected zone offset. A separate line reports original file sample timestamps (before GPS clock correction), or the two source timestamps used for interpolation. Millisecond display is not a claim of millisecond GPS measurement accuracy.

Auto recording-time interpretation checks original metadata against source duration and a strict timestamped filename. Only end-time agreement within two seconds triggers an inferred camera-wall start; explicit capture dates and ambiguous quarter-hour timezone differences are not overridden. New timelines retain raw metadata and evidence, leaving UTC unknown for inferred camera-wall times until a video zone is selected. Auto also reads legacy timelines without rewriting them. Manual offsets stay active: reset an old compensating offset when changing interpretation. Merge reports list the decisions; they are not synchronization inputs. Watermark accuracy and GPS alignment are not proven by this inference.

Save offset stores the current combined minute/second correction in ride-offset.cfg under the application user-data folder. It restores on startup; edits are not saved until the button is pressed. This is a global remembered offset, not linked to media filenames. Loading a ride CFG can override the current value without overwriting the saved offset.

Live map PiP is constrained to the displayed video image, excluding letterbox bars, including dragging, resizing, and viewport changes. Full screen expands the video pane with its map and playback controls; Exit full screen or Esc restores the normal view.
