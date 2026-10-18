const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cpuSnapshot, cpuPercent, createSampler } = require('../metrics.cjs');
test('system CPU percentages aggregate all cores, not just a single core', () => {
  const previous = cpuSnapshot([{ times: { idle: 100, user: 0 } }, { times: { idle: 100, user: 0 } }]);
  const current = cpuSnapshot([{ times: { idle: 100, user: 100 } }, { times: { idle: 200, user: 0 } }]);
  assert.equal(cpuPercent(previous, current), 50);
  assert.equal(cpuPercent(previous, previous), null);
});
test('sampler reports memory, elapsed time, weighted CPU average and peaks', () => {
  let time = 0, idle = 100, user = 0, free = 600;
  const sample = createSampler({
    now: () => time,
    system: { cpus: () => [{ times: { idle, user } }], totalmem: () => 1000, freemem: () => free },
  });
  assert.equal(sample().cpu, null);
  time = 1000; idle += 20; user += 80; free = 500;
  const active = sample();
  assert.equal(active.cpu, 80); assert.equal(active.memoryUsed, 500); assert.equal(active.elapsedSeconds, 1);
  time = 3000; idle += 180; user += 20; free = 700;
  const end = sample();
  assert.ok(Math.abs(end.cpu - 10) < 1e-8);
  assert.ok(Math.abs(end.averageCpu - 100 / 3) < 1e-8);
  assert.equal(end.peakCpu, 80); assert.equal(end.peakMemory, 500); assert.equal(end.elapsedSeconds, 3);
});
