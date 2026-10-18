# Third-party code and runtime

ChronoMerge is an independent application, not an official LosslessCut release.
Application source is distributed under GPL-2.0-only; see LICENSE.

## LosslessCut

Copyright Mikael Finstad and the LosslessCut contributors.
License: GPL-2.0-only.
Repository: https://github.com/mifi/lossless-cut
Revision inspected: aa498c38ec3dd3fd26b98d44aa86b27bbcbce333 (2026-09-08).
Source: https://github.com/mifi/lossless-cut/blob/aa498c38ec3dd3fd26b98d44aa86b27bbcbce333/src/renderer/src/hooks/useFfmpegOperations.ts

`losslesscut-concat.cjs` adapts the `concatFiles` function's concat demuxer input,
protocol whitelist, stream-copy command construction, and filename escaping.
The original function is included in `upstream/useFfmpegOperations.ts` for provenance.
Changes made on 2026-09-12: extract a standalone CommonJS module, select the first
video and all audio tracks, add machine-readable progress, reject newlines in
paths, write directly through an exclusively created output descriptor, disable
Fast Start, collect FFmpeg benchmark diagnostics, and omit chapter handling.
The surrounding GUI, priority ordering, compatibility checks, cancellation and
performance reports are new ChronoMerge code. This is not a fork of the full editor.

## FFmpeg / FFprobe

The portable package runs the external FFmpeg/FFprobe executables supplied by
the same build project used by LosslessCut. These are separate programs, not
linked into the GPL-2.0-only JavaScript application.

Build: n8.0-23-gd1f31a829d-20251022, GPL v3 or later, with shared libraries.
License: `bin/LICENSE-FFmpeg.txt`.
Binary release and corresponding build project:
https://github.com/mifi/ffmpeg-builds/releases/tag/8.0-1
https://github.com/mifi/ffmpeg-builds
FFmpeg source: https://github.com/FFmpeg/FFmpeg/tree/d1f31a829d
The original archive's documentation is included in `bin/doc`.
Build configuration is available with `bin/ffmpeg.exe -buildconf`.

## Electron / Chromium

Electron 42.3.0, MIT: https://github.com/electron/electron/tree/v42.3.0
The runtime's LICENSE and LICENSES.chromium.html are kept beside ChronoMerge.exe.
The full editable application source, npm lockfile and tests are in resources/app.
Playwright is a development-only test dependency (Apache-2.0); it is not shipped
as a runtime dependency.

MapLibre GL JS 6.9.0 is bundled under BSD-3-Clause. See vendor/LICENSE.txt. Free map services retain their own attribution and usage terms, shown beside the map.
