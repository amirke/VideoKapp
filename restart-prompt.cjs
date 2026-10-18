async function askRestart(dialog, window) {
  const result = await dialog.showMessageBox(window, {
    type: 'question', title: 'VideoKapp - ChronoMerge',
    message: 'Restart the program now?',
    detail: 'The update is downloaded and verified. Restart to install it. Choose Later to keep working.',
    buttons: ['Restart now', 'Later'], defaultId: 1, cancelId: 1, noLink: true,
  });
  return result.response === 0;
}
module.exports = {askRestart};
