import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createResourceSelection } from './dist/resource-selection.js';

const dom = new JSDOM('<!doctype html><main id="selected"></main>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const loads = new Map();
const starts = [];
const selector = createResourceSelection({
  el: document.querySelector('#selected'),
  loadResource(id, { signal }) {
    const load = { signal, ...Promise.withResolvers() };
    loads.set(id, load);
    return load.promise;
  }
});
selector.selected.on('start', (app, options) => starts.push(options.id));
async function expectLoad(id) {
  for (let attempt = 0; attempt < 20 && !loads.has(id); attempt++) {
    await Promise.resolve();
  }
  assert.ok(loads.has(id), `expected ${id} readiness to begin`);
}

try {
  assert.equal(await selector.application.start(), true);
  assert.equal(selector.application.getChildApp('selected'), selector.selected);
  const shell = selector.application.getView();
  const a = selector.select('A');
  await expectLoad('A');
  const b = selector.select('B');
  assert.equal(loads.get('A').signal.aborted, true);
  await expectLoad('B');
  loads.get('B').resolve({ name: 'Selected B' });
  assert.equal(await b, true);
  loads.get('A').resolve({ name: 'Obsolete A' });
  assert.equal(await a, false);
  assert.deepEqual(starts, ['B'], 'obsolete readiness never activates A');
  assert.equal(selector.application.getView(), shell);
  assert.equal(document.querySelector('#selected').textContent, 'Selected B');

  const c = selector.select('C');
  await expectLoad('C');
  const d = selector.select('D');
  assert.equal(loads.get('C').signal.aborted, true);
  await expectLoad('D');
  loads.get('C').reject(new Error('Obsolete failure'));
  loads.get('D').resolve({ name: 'Selected D' });
  assert.equal(await c, false);
  assert.equal(await d, true);
  assert.deepEqual(starts, ['B', 'D']);
  assert.equal(document.querySelector('#selected').textContent, 'Selected D');

  const failed = selector.select('failed');
  await expectLoad('failed');
  const error = new Error('Current resource failed');
  loads.get('failed').reject(error);
  await assert.rejects(failed, reason => reason === error);
  assert.deepEqual(starts, ['B', 'D']);

  const stoppedSelection = selector.select('stopped');
  assert.equal(await selector.application.stop(), true);
  assert.equal(await stoppedSelection, false);
  assert.equal(loads.has('stopped'), false, 'stopped owner cannot start a new selection');

  assert.equal(await selector.application.start(), true);
  const releasedSelection = selector.select('released');
  assert.equal(await selector.application.destroy(), true);
  assert.equal(await releasedSelection, false);
  assert.equal(loads.has('released'), false, 'destroyed owner cannot start a new selection');
  console.log('Selection example passed: latest A/B and C/D, obsolete readiness and failure, current failure.');
} finally {
  loads.forEach(load => load.resolve({ name: 'Finished' }));
  await selector.application.destroy();
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
}
