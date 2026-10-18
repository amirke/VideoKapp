const {test} = require('node:test');
const assert = require('node:assert/strict');
const {askRestart} = require('../restart-prompt.cjs');
test('restart requires explicit Restart now; Later and closing defer', async () => {
  for (const response of [0, 1, -1]) {
    const answer = await askRestart({showMessageBox: async (window, options) => {
      assert.equal(window, 'parent');
      assert.equal(options.message, 'Restart the program now?');
      assert.deepEqual(options.buttons, ['Restart now', 'Later']);
      assert.equal(options.defaultId, 1); assert.equal(options.cancelId, 1);
      return {response};
    }}, 'parent');
    assert.equal(answer, response === 0);
  }
});
