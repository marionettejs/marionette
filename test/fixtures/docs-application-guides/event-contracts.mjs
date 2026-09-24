import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

async function example(document, id) {
  const markdown = await readFile(new URL(`../../../docs/${document}`, import.meta.url), 'utf8');
  const marker = `<!-- executable-example: ${id} -->`;
  assert.equal(markdown.split(marker).length, 2);
  const code = markdown.slice(markdown.indexOf(marker) + marker.length)
    .match(/^\s*```javascript\n([\s\S]*?)\n```/);
  assert.ok(code);
  const output = new URL(`./dist/${id}.mjs`, import.meta.url);
  await writeFile(output, code[1]);
  return import(output);
}

const dom = new JSDOM('<!doctype html><body></body>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
let view;
let selection;
try {
  const { ActionView } = await example('dom.interactions.md', 'delegated-control-target');
  view = new ActionView();
  view.render();
  document.body.append(view.el);
  const actions = [];
  view.on('action:selected', action => actions.push(action));
  const button = view.el.querySelector('button');
  const span = button.querySelector('span');
  const targets = [];
  view.el.addEventListener('click', event => targets.push({
    target: event.target, current: event.currentTarget, delegated: event.delegateTarget
  }));
  button.click();
  span.click();
  assert.deepEqual(actions, ['save', 'save']);
  assert.deepEqual(targets, [
    { target: button, current: view.el, delegated: button },
    { target: span, current: view.el, delegated: button }
  ]);

  const { Selection } = await example('events.md', 'trigger-method-forwarding');
  selection = new Selection();
  const item = { id: 'one' };
  const events = [];
  selection.on('selection:changed', value => events.push(['changed', value]));
  selection.on('item:select', value => events.push(['selected', value]));
  selection.triggerMethod('item:select', item);
  assert.deepEqual(events, [['changed', item], ['selected', item]]);
  selection.notifyListeners(item);
  assert.deepEqual(events, [['changed', item], ['selected', item], ['selected', item]]);
} finally {
  selection?.destroy();
  view?.destroy();
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
}
