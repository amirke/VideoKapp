const {test} = require('node:test'), assert = require('node:assert/strict');
const {menuItems, attachContextMenu} = require('../context-menu.cjs');
test('right-click copy is available for selected report text and editing is limited to inputs', () => {
  const report = menuItems({selectionText: 'An object could not be cloned.', editFlags: {canCopy: true}});
  assert.equal(report[0].enabled, true); assert.equal(report[0].role, 'copy');
  assert.equal(report.some(item => item.role === 'paste'), false);
  assert.equal(menuItems({selectionText: ''})[0].enabled, false);
  const input = menuItems({isEditable: true, editFlags: {canPaste: true, canCut: false}});
  assert.equal(input.find(item => item.role === 'paste').enabled, true);
  assert.equal(input.find(item => item.role === 'cut').enabled, false);
});
test('context menu opens in the window that received the right click', () => {
  let listener, opened;
  const window = {webContents: {on: (event, fn) => {assert.equal(event, 'context-menu'); listener = fn;}}};
  attachContextMenu(window, {buildFromTemplate: () => ({popup: options => {opened = options.window;}})});
  listener({}, {selectionText: 'copy me'}); assert.equal(opened, window);
});
