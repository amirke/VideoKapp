// Capture real click listeners before UI modules load. This does not click controls.
(() => {
  window.appRuntimeErrors = [];
  window.addEventListener('error', event => {
    window.appRuntimeErrors.push(event.message || 'A UI resource failed to load.');
    if (window.appRuntimeErrors.length > 50) window.appRuntimeErrors.shift();
  });
  window.addEventListener('unhandledrejection', event => {
    window.appRuntimeErrors.push(String(event.reason?.message || 'Unhandled UI promise rejection.'));
    if (window.appRuntimeErrors.length > 50) window.appRuntimeErrors.shift();
  });
  const listeners = new WeakMap();
  const original = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (type === 'click' && listener) {
      let entries = listeners.get(this); if (!entries) listeners.set(this, entries = new Set());
      entries.add(listener);
    }
    return original.call(this, type, listener, options);
  };
  EventTarget.prototype.removeEventListener = function(type, listener, options) {
    if (type === 'click') listeners.get(this)?.delete(listener);
    return remove.call(this, type, listener, options);
  };
  window.auditControls = () => [...document.querySelectorAll('button')].map((button, index) => ({
    id: button.id || `dynamic-${index + 1}`,
    tab: button.closest('[role="tabpanel"]')?.id.replace('page-', '') || 'Global / navigation',
    label: (button.textContent.trim() || button.getAttribute('aria-label') || button.title || '(no label)').slice(0, 120),
    wired: typeof button.onclick === 'function' || !!listeners.get(button)?.size,
    disabled: button.disabled, hidden: !!button.closest('[hidden]'),
    lastAction: button.dataset.actionState === 'ok' ? 'Completed' : button.dataset.actionState === 'error' ? 'Failed' : 'Not exercised',
  }));
})();
