// Website links only open/focus the app. Never execute commands or open files from a URL.
function setupDesktopLaunch(app, getWindow) {
  if (!app.requestSingleInstanceLock()) { app.quit(); return false; }
  app.on('second-instance', () => {
    const window = getWindow();
    if (!window || window.isDestroyed()) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  });
  return true;
}
module.exports = { setupDesktopLaunch };
