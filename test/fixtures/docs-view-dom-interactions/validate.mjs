import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { View } from 'marionette';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsDir = resolve(__dirname, '../../../docs');
const docsPath = resolve(docsDir, 'dom.interactions.md');
const viewMarker = '<!-- executable-example: view-dom-interactions -->';
const adapterMarker = '<!-- executable-example: event-delegator-adapter -->';
const markdown = await readFile(docsPath, 'utf8');

const targetAnchors = new Set(
  [...markdown.matchAll(/^#{1,6}\s+(.+)$/gm)]
    .map(([, heading]) => heading
      .toLowerCase()
      .replace(/[`*_~]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')),
);
const docsFiles = (await readdir(docsDir)).filter(fileName => fileName.endsWith('.md'));

function assertDomInteractionReferences(contents, sourceName) {
  const references = contents.matchAll(/(dom\.interactions?\.md)#([a-z0-9-]+)/g);

  for (const [, targetName, anchor] of references) {
    assert.equal(targetName, 'dom.interactions.md', `${sourceName} references missing ${targetName}`);
    assert.ok(targetAnchors.has(anchor), `${sourceName} references missing DOM interactions anchor #${anchor}`);
  }
}

for (const fileName of docsFiles) {
  const contents = await readFile(resolve(docsDir, fileName), 'utf8');
  assertDomInteractionReferences(contents, fileName);
}

assert.throws(
  () => assertDomInteractionReferences('[broken](./dom.interaction.md#view-triggers)', 'probe.md'),
  /probe\.md references missing dom\.interaction\.md/,
  'the source-link guard must reject the known singular filename typo',
);

function getExample(marker) {
  assert.equal(markdown.split(marker).length - 1, 1, `expected one ${ marker } marker`);

  const markedContent = markdown.slice(markdown.indexOf(marker) + marker.length);
  const codeFence = markedContent.match(/^\s*```javascript\n([\s\S]*?)\n```/);

  assert.ok(codeFence, `expected a JavaScript fence immediately after ${ marker }`);
  return codeFence[1];
}

const distDir = resolve(__dirname, 'dist');
const examplePath = resolve(distDir, 'example.mjs');
const adapterPath = resolve(distDir, 'adapter.mjs');

await mkdir(distDir, { recursive: true });
await Promise.all([
  writeFile(examplePath, `${ getExample(viewMarker) }\n`, 'utf8'),
  writeFile(adapterPath, `${ getExample(adapterMarker) }\n`, 'utf8'),
]);

const dom = new JSDOM(`<!doctype html>
  <html>
    <body>
      <main id="form-host"></main>
      <button class="save shared-action" id="outside-save" type="button">Outside</button>
    </body>
  </html>`);

globalThis.window = dom.window;
globalThis.document = dom.window.document;

function runFormContract(FormView) {
  const view = new FormView();
  const host = document.querySelector('#form-host');
  let saveDeliveryCount = 0;
  let closeDeliveryCount = 0;
  let saveEvent;
  let closeEvent;
  let wrongCloseDeliveryCount = 0;
  let bodyClickCount = 0;

  const countBodyClick = () => { bodyClickCount += 1; };
  document.body.addEventListener('click', countBodyClick);
  view.on('form:save', (triggeringView, event) => {
    saveDeliveryCount += 1;
    saveEvent = event;
    assert.equal(triggeringView, view, 'the events handler must emit its View as the first argument');
  });
  view.on('form:close', (triggeringView, event) => {
    closeDeliveryCount += 1;
    closeEvent = event;
    assert.equal(triggeringView, view, 'the trigger must emit its View as the first argument');
  });
  view.on('close:view', () => { wrongCloseDeliveryCount += 1; });

  view.render();
  host.append(view.el);

  const firstSaveUI = view.getUI('save');
  const firstCloseUI = view.getUI('close');
  const [firstSave] = firstSaveUI;
  const [firstClose] = firstCloseUI;

  assert.ok(firstSaveUI instanceof dom.window.NodeList, 'getUI must use the native DomApi by default');
  assert.ok(view.$('.save') instanceof dom.window.NodeList, 'View#$ must use the native DomApi by default');
  assert.equal(firstSaveUI.length, 1, 'ui must bind the matching element inside the View root');
  assert.equal(view.$('.save').length, 1, 'View#$ must exclude a matching element outside the View root');
  assert.equal(firstSave.disabled, false);

  firstSave.click();

  assert.equal(saveDeliveryCount, 1, 'the events handler must run once with the View as its context');
  assert.ok(saveEvent instanceof dom.window.MouseEvent, 'the events handler must receive the native DOM event');
  assert.equal(firstSave.disabled, true, 'the example must use the native DOM element from getUI');
  assert.equal(bodyClickCount, 1, 'a standard events handler must not stop propagation');

  firstClose.click();

  assert.equal(view.el.dataset.closed, 'true', 'the matching trigger method must receive the triggering View');
  assert.equal(closeDeliveryCount, 1, 'the exact trigger event must be emitted once');
  assert.equal(wrongCloseDeliveryCount, 0, 'the trigger must not emit the stale close:view event name');
  assert.equal(closeEvent.defaultPrevented, true, 'triggers must prevent default by default');
  assert.equal(bodyClickCount, 1, 'triggers must stop propagation by default');

  view.render();

  const [secondSave] = view.getUI('save');
  const [secondClose] = view.getUI('close');

  assert.notEqual(view.getUI('save'), firstSaveUI, 'render must replace the cached native collection');
  assert.notEqual(secondSave, firstSave, 'render must bind the replacement DOM node');
  assert.equal(firstSave.isConnected, false, 'render must detach the previous DOM node');
  delete view.el.dataset.closed;

  secondSave.click();
  secondClose.click();

  assert.equal(saveDeliveryCount, 2, 'rerender must delegate the events handler exactly once');
  assert.equal(closeDeliveryCount, 2, 'rerender must emit one trigger event per click');
  assert.equal(view.el.dataset.closed, 'true', 'rerender must retain the matching trigger method');

  view.destroy();
  secondSave.click();
  secondClose.click();

  assert.equal(saveDeliveryCount, 2, 'destroy must undelegate the final events handler');
  assert.equal(closeDeliveryCount, 2, 'destroy must stop final trigger delivery');

  document.body.removeEventListener('click', countBodyClick);
  return view;
}

function assertStructuralBoundary() {
  const ChildView = View.extend({
    template() {
      return '<button class="shared-action" type="button">Child action</button>';
    },
  });

  const ParentView = View.extend({
    template() {
      return `
        <button class="shared-action" type="button">Owner action</button>
        <div class="child-region"></div>
      `;
    },

    regions: {
      child: '.child-region',
    },

    ui: {
      sharedActions: '.shared-action',
    },

    events: {
      'click .shared-action': 'onSharedAction',
    },

    initialize() {
      this.deliveryCount = 0;
    },

    onSharedAction() {
      this.deliveryCount += 1;
    },
  });

  const parentView = new ParentView();
  const childView = new ChildView();

  parentView.render();
  document.body.append(parentView.el);
  parentView.showChildView('child', childView);
  parentView.bindUIElements();

  const childAction = childView.el.querySelector('.shared-action');

  assert.equal(parentView.getUI('sharedActions').length, 2, 'ui binding must be structural, not ownership-aware');
  assert.equal(parentView.$('.shared-action').length, 2, 'View#$ must include every matching descendant');

  childAction.click();
  assert.equal(parentView.deliveryCount, 1, 'delegation must see a matching child-owned descendant');

  document.querySelector('#outside-save').click();
  assert.equal(parentView.deliveryCount, 1, 'delegation must exclude matching elements outside the View root');

  parentView.destroy();
  assert.equal(childView.isDestroyed(), true, 'fixture cleanup must follow parent-owned child lifecycle');
}

async function assertEventDelegatorExample() {
  const { CustomEventDelegator } = await import(pathToFileURL(adapterPath));
  const root = document.createElement('div');
  root.innerHTML = '<button class="action">Click text</button>';
  const button = root.querySelector('.action');
  let deliveryCount = 0;
  let delegateTarget;
  const AdaptedView = View.extend({
    events: {
      'click .action'(event) {
        deliveryCount += 1;
        delegateTarget = event.delegateTarget;
      },
    },
  });
  AdaptedView.setEventDelegator(CustomEventDelegator);
  const view = new AdaptedView({ el: root });

  button.firstChild.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(deliveryCount, 1, 'the adapter example must handle a text-node target');
  assert.equal(delegateTarget, button, 'the adapter example must expose the closest match');

  view.destroy();
  button.click();
  assert.equal(deliveryCount, 1, 'the adapter example cleanup must remove its registration');
}

try {
  const { FormView } = await import(pathToFileURL(examplePath));

  assert.equal(typeof FormView, 'function', 'the example must export FormView');

  const firstView = runFormContract(FormView);
  const secondView = runFormContract(FormView);

  assert.notEqual(firstView, secondView, 'each example run must create a fresh View');
  assertStructuralBoundary();
  await assertEventDelegatorExample();
} finally {
  dom.window.close();
  delete globalThis.document;
  delete globalThis.window;
}
