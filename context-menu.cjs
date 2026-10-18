function menuItems(params) {
  const flags = params.editFlags || {};
  const items = [{label: 'Copy', role: 'copy', enabled: !!params.selectionText && flags.canCopy !== false}];
  if (params.isEditable) items.push(
    {label: 'Cut', role: 'cut', enabled: !!flags.canCut},
    {label: 'Paste', role: 'paste', enabled: !!flags.canPaste},
  );
  items.push({type: 'separator'}, {label: 'Select all', role: 'selectAll'});
  return items;
}
function attachContextMenu(window, Menu) {
  window.webContents.on('context-menu', (_event, params) => {
    Menu.buildFromTemplate(menuItems(params)).popup({window});
  });
}
module.exports = {menuItems, attachContextMenu};
