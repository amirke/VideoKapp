// SPDX-License-Identifier: GPL-2.0-only
const os = require('node:os');
const { performance } = require('node:perf_hooks');

function cpuSnapshot(cpus) {
  return cpus.reduce((total, cpu) => ({
    idle: total.idle + cpu.times.idle,
    total: total.total + Object.values(cpu.times).reduce((sum, time) => sum + time, 0),
  }), { idle: 0, total: 0 });
}
function cpuPercent(previous, current) {
  const total = current.total - previous.total;
  if (total <= 0) return null;
  return Math.min(100, Math.max(0, 100 * (1 - (current.idle - previous.idle) / total)));
}
function createSampler({ system = os, now = () => performance.now() } = {}) {
  const start = now();
  const baseline = cpuSnapshot(system.cpus());
  let previous = baseline, peakCpu = null, peakMemory = 0;
  return () => {
    const current = cpuSnapshot(system.cpus());
    const cpu = cpuPercent(previous, current);
    previous = current;
    if (cpu !== null) peakCpu = Math.max(peakCpu ?? 0, cpu);
    const memoryTotal = system.totalmem();
    const memoryUsed = Math.max(0, memoryTotal - system.freemem());
    peakMemory = Math.max(peakMemory, memoryUsed);
    return {
      cpu, averageCpu: cpuPercent(baseline, current), peakCpu,
      memoryUsed, memoryTotal, peakMemory,
      elapsedSeconds: Math.max(0, (now() - start) / 1000),
    };
  };
}
module.exports = { cpuSnapshot, cpuPercent, createSampler };
