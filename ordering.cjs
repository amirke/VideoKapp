// SPDX-License-Identifier: GPL-2.0-only
(function (root) {
  const names = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
  function value(file, key) {
    if (key === 'name') return file.name;
    const v = file[key];
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
  }
  function reason(file, priorities) {
    for (const key of priorities) if (key && value(file, key) !== null) return key;
    return 'name';
  }
  function sortFiles(files, priorities) {
    const keys = [...new Set(priorities.filter(Boolean))];
    const dateKeys = keys.filter(k => k !== 'name');
    return [...files].sort((a, b) => {
      // When the primary date is missing, use the next enabled date on the same timeline.
      // Name-first sorting is intentionally purely alphabetical/natural.
      if (keys[0] !== 'name') {
        const aDate = dateKeys.map(k => value(a, k)).find(v => v !== null);
        const bDate = dateKeys.map(k => value(b, k)).find(v => v !== null);
        if (aDate != null && bDate != null && aDate !== bDate) return aDate - bDate;
        if (aDate == null && bDate != null) return 1;
        if (aDate != null && bDate == null) return -1;
      }
      for (const key of keys) {
        const av = value(a, key), bv = value(b, key);
        if (av == null || bv == null) continue;
        const comparison = key === 'name' ? names.compare(av, bv) : av - bv;
        if (comparison) return comparison;
      }
      return names.compare(a.name, b.name) || a.path.localeCompare(b.path);
    });
  }
  const api = { sortFiles, reason };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Ordering = api;
})(globalThis);
