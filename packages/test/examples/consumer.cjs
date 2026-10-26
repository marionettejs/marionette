const { withQueries } = require('@mnjs/test/testing-library');
const cypressAdapter = require('@mnjs/test/cypress');
const { createGallery } = require('@mnjs/test/playwright');
const assert = require('node:assert/strict');
const { View, Application } = require('marionette');
const { mountView, mountApplication } = require('@mnjs/test');

async function run() {
  const host = document.body.appendChild(document.createElement('section'));
  const sibling = host.appendChild(document.createElement('p'));
  const options = {
    container: host, showOptions: { replaceElement: true }
  };
  const mounted = withQueries(mountView(new View({ template: () => '<button>CommonJS</button>' }), options));
  assert.equal(mounted.getByRole('button', { name: 'CommonJS' }).textContent, 'CommonJS');
  options.container = undefined;
  await mounted.cleanup();
  assert.equal(host.isConnected, true);
  assert.deepEqual([...host.children], [sibling]);
  host.remove();
  const feature = mountApplication(() => new Application());
  assert.equal(await feature.ready, true);
  await feature.cleanup();
  assert.equal(feature.app.isDestroyed(), true);
  console.log('Installed CommonJS: replacement, borrowed host and readiness passed.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });

assert.deepEqual(Object.keys(cypressAdapter).sort(), ['mount', 'mountApplication', 'setupCypress', 'unmount']);
assert.equal(typeof createGallery, 'function');
assert.equal(typeof globalThis.Cypress, 'undefined');
