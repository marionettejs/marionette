import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const [format, jsdomPath] = process.argv.slice(2);
const require = createRequire(import.meta.url);
const { JSDOM } = await import(pathToFileURL(jsdomPath).href);
const dom = new JSDOM('<!doctype html><body></body>');
for (const name of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'Document', 'DocumentFragment']) {
  globalThis[name] = name === 'window' ? dom.window : dom.window[name];
}
const load = async specifier => format === 'esm' ? import(specifier) : require(specifier);
const adapter = async specifier => {
  const result = await load(specifier);
  return format === 'esm' ? result.default : result;
};
try {
  const core = await load('marionette');
  const utils = await load('@mnjs/utils');
  const radio = await load('@mnjs/radio');
  assert.equal(core.Events, utils.Events);
  assert.equal(core.Radio, radio.Radio);
  assert.equal(core.MarionetteError, utils.MarionetteError);
  const data = await load('@mnjs/data');
  assert.equal(data.Model.prototype.listenTo, utils.Events.listenTo);
  assert.equal(data.Collection.prototype.listenTo, utils.Events.listenTo);
  for (const provider of ['jquery', 'morphdom', 'lit-html']) {
    const DomApi = await adapter(`@mnjs/adapters/dom/${provider}`);
    let value = 'first';
    let clicks = 0;
    let template = () => `<button id="retained">${value}</button>`;
    if (provider === 'lit-html') {
      const { html } = await import('lit-html');
      template = () => html`<button id="retained">${value}</button>`;
    }
    const Panel = core.View.extend({ template, events: { 'click button': () => clicks++ } }).setDomApi(DomApi);
    const mount = document.createElement('main');
    document.body.append(mount);
    const region = new core.Region({ el: mount });
    const view = new Panel();
    region.show(view);
    view.el.querySelector('button').click();
    assert.equal(clicks, 1);
    value = 'second';
    view.render();
    const button = view.el.querySelector('button');
    assert.equal(button.textContent, 'second');
    region.detachView();
    region.show(view);
    button.click();
    assert.equal(clicks, 2);
    region.destroy();
    assert.equal(view.isDestroyed(), true);
    button.click();
    assert.equal(clicks, 2, `${provider} releases DOM events`);
    mount.remove();
    if (provider === 'lit-html') {
      const { verifyLitIntegration } = await import('./integration.mjs');
      verifyLitIntegration(core, data, DomApi);
    }
  }
  const createActorApi = await adapter('@mnjs/adapters/xstate');
  const { createActor, createMachine, assign } = await import('xstate');
  const actor = createActor(createMachine({ context: { count: 0 }, on: {
    increment: { actions: assign({ count: ({ context }) => context.count + 1 }) },
  } })).start();
  let updates = 0;
  const Owner = core.MnObject.extend({ stateEvents: { change: () => updates++ } }).setStateApi(createActorApi({ snapshotEvent: 'change' }));
  const owner = new Owner({ state: actor });
  actor.send({ type: 'increment' });
  assert.equal(updates, 1);
  owner.destroy();
  actor.send({ type: 'increment' });
  assert.equal(updates, 1, 'destroy releases actor observation');
  assert.equal(actor.getSnapshot().context.count, 2, 'borrowed actor survives');
  actor.stop();
  console.log(`Data/DOM/actor lifecycle and shared core runtime pass (${format}).`);
} finally {
  dom.window.close();
}
