// SPDX-License-Identifier: GPL-2.0-only
// Adapted from mifi/lossless-cut, copyright Mikael Finstad and contributors.
// Source: src/renderer/src/hooks/useFfmpegOperations.ts, concatFiles, lines 131-248.
// See THIRD_PARTY.md for the pinned upstream revision and modifications.
const { resolve } = require('node:path');

function makeConcatText(paths) {
  if (paths.some(file => /[\r\n\0]/.test(file))) throw new Error('A file name contains an unsupported character.');
  // Upstream escaping and file: protocol prefix (required for stdin concat input).
  return paths.map(file => `file 'file:${resolve(file).replaceAll("'", String.raw`'\''`)}'`).join('\n');
}

const { encodingArgs } = require('./compression.cjs');
function makeConcatArgs({ format, compression, source }) {
  return [
    '-hide_banner', '-loglevel', 'level+info', '-benchmark', '-nostats', '-progress', 'pipe:1',
    ...(source ? ['-nostdin', ...(compression?.start ? ['-ss', String(compression.start)] : []), '-i', source] : ['-f', 'concat', '-safe', '0', '-protocol_whitelist', 'file,pipe,fd', '-i', '-']),
    '-map', '0:v:0', '-map', '0:a?', ...encodingArgs(source ? {...compression, start: 0} : compression),
    '-map_metadata', '0', '-map_chapters', '-1', '-ignore_unknown',
    ...Object.entries(compression?.metadata || {}).flatMap(([key, value]) => ['-metadata', `${key}=${value}`]),
    // The parent atomically creates the destination with wx and passes a seekable
    // descriptor. No faststart pass, temporary-file publication or second copy.
    '-f', format, '-fd', '3', 'fd:',
  ];
}
module.exports = { makeConcatText, makeConcatArgs };
