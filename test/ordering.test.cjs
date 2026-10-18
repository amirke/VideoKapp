const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sortFiles, reason } = require('../ordering.cjs');
const { recordingDate } = require('../engine.cjs');
const sample = (name, created, recorded) => ({ name, path: `C:/clips/${name}`, created, recorded });
test('creation time wins by default even when recording date/name disagree', () => {
  const older = sample('clip10.mp4', 1000, 9000), newer = sample('clip2.mp4', 2000, 1000);
  assert.deepEqual(sortFiles([newer, older], ['created', 'recorded', 'name']), [older, newer]);
  assert.deepEqual(sortFiles([older, newer], ['recorded', 'created', 'name']), [newer, older]);
});
test('name sorting is natural, stable and does not mutate its input', () => {
  const input = [sample('clip10.mp4', 1), sample('clip2.mp4', 2)];
  assert.deepEqual(sortFiles(input, ['name']).map(f => f.name), ['clip2.mp4', 'clip10.mp4']);
  assert.equal(input[0].name, 'clip10.mp4');
});
test('missing primary date uses fallback on same timeline; undated files go last', () => {
  const input = [sample('a', null, null), sample('b', 3000, null), sample('c', null, 1000)];
  assert.deepEqual(sortFiles(input, ['created', 'recorded', 'name']).map(f => f.name), ['c', 'b', 'a']);
  assert.equal(reason(input[2], ['created', 'recorded', 'name']), 'recorded');
});
test('equal primary timestamps use the configured secondary priority', () => {
  assert.deepEqual(sortFiles([sample('a', 1000, 3000), sample('b', 1000, 2000)], ['created', 'recorded', 'name']).map(f => f.name), ['b', 'a']);
});
test('metadata date parser skips invalid metadata and preserves timezone', () => {
  assert.equal(recordingDate({ format: { tags: { creation_time: 'bad' } }, streams: [{ tags: { creation_time: '2024-01-01T12:00:00+02:00' } }] }), Date.parse('2024-01-01T10:00:00Z'));
  assert.equal(recordingDate({ format: {}, streams: [] }), null);
});
