import assert from 'node:assert/strict';
import { assertions as accessibilityAssertions } from './accessibility-guide-checks.mjs';
import { assertions as widgetAssertions } from './widget-guide-checks.mjs';
import { assertions as listAssertions, preparations as listPreparations } from './list-guide-checks.mjs';
import { assertions as integrationAssertions } from './integration-guide-checks.mjs';
import { assertions as dataAssertions } from './data-reference-checks.mjs';
import { assertions as radioAssertions } from './radio-reference-checks.mjs';
import { assertions as utilsAssertions } from './utils-reference-checks.mjs';
import { assertions as adapterAssertions } from './adapters-reference-checks.mjs';
import { assertions as editingHtmlAssertions, getPreparations } from './editing-html-checks.mjs';
import { assertions as restartAssertions, preparations as restartPreparations } from './retained-restart-checks.mjs';
import { assertions as typescriptAssertions, preparations as typescriptPreparations } from './typescript-guide-checks.mjs';
import { assertions as draftSaveAssertions, preparations as draftSavePreparations } from './draft-save-checks.mjs';
import { assertions as navigationAssertions, preparations as navigationPreparations } from './async-navigation-checks.mjs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Execute the actual reference fences and check their observable results. With a
// consumer path argument, framework imports resolve from its installed packages.
// Without one, use this checkout and its built package entrypoints.
const root = resolve(import.meta.dirname, '../..');
const consumer = process.argv[2] ? resolve(process.argv[2]) : root;
const output = process.argv[2] ? join(consumer, 'reference-examples') : join(root, 'test/tmp/docs-reference');
const installed = process.argv[2] ? join(consumer, 'node_modules/marionette') : root;
const require = createRequire(join(root, 'package.json'));
const pages = ['api', 'packages', 'integrations', 'guides'].flatMap(section =>
  readdirSync(join(installed, 'docs', section), { recursive: true }).filter(name => name.endsWith('.md'))
    .sort().map(name => `docs/${section}/${name}`))
  // This multi-file Node test recipe is executed by consumer-testing.mjs in the installed check.
  .filter(path => path !== 'docs/guides/testing.md');
const preparations = {
  ...listPreparations,
  ...getPreparations(installed),
  ...restartPreparations,
  ...typescriptPreparations,
  ...draftSavePreparations,
  ...navigationPreparations,
  'api-application-1': `
const fetches = [];
globalThis.fetch = async (url, options) => {
  fetches.push({ url, signal: options.signal });
  return new Response(JSON.stringify({ title: '<Quarterly summary>' }));
};
`,
};
const assertions = {
  ...accessibilityAssertions,
  ...widgetAssertions,
  ...listAssertions,
  ...integrationAssertions,
  ...dataAssertions,
  ...radioAssertions,
  ...utilsAssertions,
  ...adapterAssertions,
  ...editingHtmlAssertions,
  ...restartAssertions,
  ...typescriptAssertions,
  ...draftSaveAssertions,
  ...navigationAssertions,
  'integrations-setup-1': `
const { View } = await import('marionette');
const { Model } = await import('@mnjs/data');
const { html } = await import('lit-html');
const model = new Model({ title: 'Configured' });
const view = new View({ model, template: ({ title }) => html\`<h1>\${title}</h1>\` }).render();
assert.equal(view.el.textContent, 'Configured');
view.destroy();
assert.equal(model.isDestroyed(), false);
model.destroy();
`,
  'integrations-setup-2': `
const { Model } = await import('@mnjs/data');
const model = new Model({ title: '<Overview>', description: 'Description' });
const view = new DetailView({ model }).render();
assert.equal(view.el.querySelector('h3').textContent, '<Overview>');
assert.equal(view.el.querySelector('p').textContent, 'Description');
assert.equal(view.el.querySelector('overview'), null);
view.destroy();
model.destroy();
`,
  'integrations-setup-3': `
assert.equal(items.get('alpha'), item);
assert.equal(item.get('title'), 'Updated item');
assert.equal(items.length, 1);
items.destroy();
item.destroy();
`,
  'api-runtime-1': `
assert.equal(heading.el.textContent, 'Overview');
heading.destroy();
`,
  'api-runtime-2': `
assert.equal(heading.el.textContent, 'Updated overview');
heading.destroy();
title.set('title', 'Still borrowed');
assert.equal(title.isDestroyed(), false);
assert.equal(heading.el.textContent, 'Updated overview');
title.destroy();
const core = await import('marionette');
core.setRenderer(() => 'default family override');
const plain = createMarionette();
assert.equal(plain.VERSION, core.VERSION);
const nativeView = new plain.View({ template: () => 'native' }).render();
assert.equal(nativeView.el.textContent, 'native');
nativeView.destroy();
const initialDelegator = plain.View.prototype.EventDelegator;
const rootDelegator = { delegate() { return () => {}; } };
core.setEventDelegator(rootDelegator);
core.View.setEventDelegator({ delegate() { return () => {}; } });
for (const Class of [plain.View, plain.CollectionView, plain.Behavior]) {
  assert.equal(Class.prototype.EventDelegator, initialDelegator);
}
const isolatedDelegator = { delegate() { return () => {}; } };
const currentRootDelegator = core.View.prototype.EventDelegator;
plain.setEventDelegator(isolatedDelegator);
assert.equal(core.View.prototype.EventDelegator, currentRootDelegator);
assert.equal(core.Behavior.prototype.EventDelegator, rootDelegator);
assert.equal(core.CollectionView.prototype.EventDelegator, rootDelegator);
plain.setEventDelegator(initialDelegator);
core.setRenderer(() => 'later default-family override');
const afterRootChange = new plain.View({ template: () => 'still isolated' }).render();
assert.equal(afterRootChange.el.textContent, 'still isolated');
afterRootChange.destroy();
assert.notEqual(plain.Radio.channel('shared'), runtime.Radio.channel('shared'));
const initialDom = plain.DomApi;
assert.equal(plain.setDomApi({ setContents(el, output) { el.textContent = output; } }), undefined);
assert.notEqual(plain.View.prototype.Dom, initialDom);
assert.equal(plain.DomApi, initialDom);
const Local = plain.View.extend();
assert.equal(Local.setDomApi({ findEl(el, selector) { return el.querySelectorAll(selector); } }), Local);
const foreignRegion = new runtime.Region({ el: document.createElement('main') });
assert.throws(() => new plain.Application({ region: foreignRegion }), error => error.code === 'MN0030');
const foreignView = new runtime.View({ template: false });
const region = new plain.Region({ el: document.createElement('aside') });
region.show(foreignView);
region.destroy();
assert.equal(foreignView.isDestroyed(), true);
foreignRegion.destroy();

// A test-only source exercises the documented normalized collection protocol.
const source = new plain.MnObject();
const first = { id: 'a', label: 'Alpha' };
const second = { id: 'b', label: 'Beta' };
source.entries = [first, second];
let observers = 0;
plain.setDataApi({
  key(model) { return model.id; },
  models(collection) { return collection.entries; },
  observeCollection(collection, callback, context) {
    observers++;
    collection.on('update', callback, context);
    return () => { observers--; collection.off('update', callback, context); };
  },
});
const Row = plain.View.extend({ template: model => model.label });
const list = new plain.CollectionView({ collection: source, childView: Row }).render();
const alpha = list.children.findByModel(first);
const beta = list.children.findByModel(second);
source.entries = [second, first];
source.trigger('update', { kind: 'reorder' });
assert.deepEqual(list.children.toArray(), [beta, alpha]);
first.label = 'Changed';
source.trigger('update', { kind: 'update', added: [], removed: [], updated: [{ previous: first, current: first }] });
assert.equal(list.children.findByModel(first), alpha);
assert.equal(alpha.el.textContent, 'Changed');
const replacement = { id: 'a', label: 'Replacement' };
source.entries = [second, replacement];
source.trigger('update', { kind: 'update', added: [], removed: [], updated: [{ previous: first, current: replacement }] });
assert.equal(alpha.isDestroyed(), true);
assert.notEqual(list.children.findByModel(replacement), alpha);
assert.equal(list.children.findByModel(second), beta);
source.entries = [replacement];
source.trigger('update', { kind: 'update', added: [], removed: [second], updated: [] });
assert.equal(beta.isDestroyed(), true);
const previousRow = list.children.first();
source.trigger('update', { kind: 'reset' });
assert.equal(previousRow.isDestroyed(), true);
assert.notEqual(list.children.first(), previousRow);
list.destroy();
assert.equal(observers, 0);
assert.equal(source.isDestroyed(), false);
source.destroy();
`,
  'api-providers-dom-1': `
assert.equal(label.el.textContent, '<Draft>');
assert.equal(label.el.querySelector('draft'), null);
assert.equal(Label.prototype.Dom.createElement, View.prototype.Dom.createElement);
const root = label.el;
label.render();
assert.equal(label.el, root);
label.destroy();
assert.equal(label.isDestroyed(), true);
const Reconfigured = View.extend({ template: () => 'next render' });
const live = new Reconfigured();
Reconfigured.setDomApi({ setContents(el, output) { el.textContent = 'changed: ' + output; } });
live.render();
assert.equal(live.el.textContent, 'changed: next render');
live.destroy();
let attachments = 0;
let detachments = 0;
const Monitored = View.extend({ template: false }).setDomApi({
  notifyAttach() { attachments++; }, notifyDetach() { detachments++; },
});
const mountedEl = document.createElement('section');
document.body.append(mountedEl);
new Monitored({ el: mountedEl }).destroy();
assert.equal(attachments, 1);
assert.equal(detachments, 1);
const Unmonitored = Monitored.extend({ monitorViewEvents: false });
const unmonitoredEl = document.createElement('section');
document.body.append(unmonitoredEl);
new Unmonitored({ el: unmonitoredEl }).destroy();
assert.equal(attachments, 1);
assert.equal(detachments, 1);
let insertion;
const Forwarded = View.extend({
  template: () => 'ignored',
  attachElContent(output) { insertion = { output }; },
}).setRenderer(() => undefined);
const forwarded = new Forwarded().render();
assert.deepEqual(insertion, { output: undefined });
forwarded.destroy();
const buttonHost = document.createElement('section');
buttonHost.innerHTML = '<button><span>Run</span></button>';
const span = buttonHost.querySelector('span');
let calls = 0;
const cleanup = View.prototype.EventDelegator.delegate({
  rootEl: buttonHost, eventName: 'click', selector: 'button',
  handler(event) { assert.equal(event.delegateTarget, buttonHost.querySelector('button')); assert.equal(event.target, span); calls++; },
});
span.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
assert.equal(calls, 1);
cleanup();
cleanup();
span.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
assert.equal(calls, 1);
`,
  'api-behavior-1': `
let dismissals = 0;
panel.on('dismiss', host => { assert.equal(host, panel); dismissals++; });
const keydown = key => new window.KeyboardEvent('keydown', { key, bubbles: true });
panel.el.querySelector('input').dispatchEvent(keydown('Enter'));
assert.equal(dismissals, 0);
panel.el.querySelector('input').dispatchEvent(keydown('Escape'));
assert.equal(dismissals, 1);
panel.render();
panel.el.querySelector('input').dispatchEvent(keydown('Escape'));
assert.equal(dismissals, 2); // No duplicate delegation after render.
const retainedInput = panel.el.querySelector('input');
panel.destroy();
retainedInput.dispatchEvent(keydown('Escape'));
assert.equal(dismissals, 2);
let managed;
let hostDestroyNotifications = 0;
let echoedDismissals = 0;
const Probe = DismissOnEscape.extend({
  ui: { field: '.fallback' },
  triggers: { 'click @ui.field': 'activate' },
  initialize() { managed = this; },
  onDestroy(host) { assert.equal(host.isDestroyed(), true); hostDestroyNotifications++; },
  onDismiss() { echoedDismissals++; },
});
const host = new SearchPanel({ behaviors: [Probe], ui: { field: 'input' } });
host.render();
assert.equal(managed.getUI('field')[0], host.el.querySelector('input'));
host.el.querySelector('input').dispatchEvent(keydown('Escape'));
assert.equal(echoedDismissals, 1); // Host forwarding includes the Behavior that emitted it.
let hostEvents = 0;
host.on('activate', source => { assert.equal(source, host); hostEvents++; });
managed.triggerMethod('activate');
assert.equal(hostEvents, 0); // Behavior events stay local.
host.el.querySelector('input').click();
assert.equal(hostEvents, 1); // DOM triggers target host.
let beforeDestroy = 0;
managed.on('before:destroy', () => { beforeDestroy++; });
managed.destroy();
assert.equal(beforeDestroy, 0);
assert.equal(host.isDestroyed(), false);
host.el.querySelector('input').click();
assert.equal(hostEvents, 1);
host.destroy();
assert.equal(hostDestroyNotifications, 0); // Directly removed Behavior receives no final host notification.
const secondHost = new SearchPanel({ behaviors: [Probe] });
secondHost.render();
secondHost.destroy();
assert.equal(hostDestroyNotifications, 1);
`,
  'api-mnobject-1': `
assert.equal(changes.isDestroyed(), true);
assert.equal(changes.getState().isDestroyed(), true);
assert.equal(draft.isDestroyed(), false);
const live = new DraftChanges({ draft });
const state = live.getState();
assert.equal(state.get('dirty'), false);
draft.set('title', 'Revised');
assert.equal(state.get('dirty'), true);
live.markSaved();
assert.equal(state.get('dirty'), false);
let notifications = 0;
live.on('destroy', (owner, options) => {
  assert.equal(owner, live);
  assert.equal(owner.isDestroyed(), true);
  assert.equal(options.reason, 'finished');
  notifications++;
});
assert.equal(live.destroy({ reason: 'finished' }), live);
assert.equal(state.isDestroyed(), true);
assert.equal(live.destroy(), live);
assert.equal(notifications, 1);
draft.set('title', 'Still available');
assert.equal(state.get('dirty'), false); // Released draft listener cannot mark disposed state.
const borrowed = new Model({ dirty: false });
const borrower = new DraftChanges({ draft, state: borrowed });
borrower.destroy();
assert.equal(borrowed.isDestroyed(), false);
const Service = MnObject.extend({
  channelName: 'reference-drafts',
  radioRequests: { title: 'readTitle' },
  readTitle() { return draft.get('title'); },
});
const service = new Service();
const channel = service.getChannel();
service.bindRequests(channel, { manual: () => 'owned' });
assert.equal(channel.request('manual'), 'owned');
const otherContext = {};
channel.reply('other', () => 'retained', otherContext);
assert.equal(channel.request('title'), 'Still available');
service.destroy();
assert.equal(channel.request('title'), undefined);
assert.equal(channel.request('manual'), undefined);
assert.equal(channel.request('other'), 'retained');
channel.stopReplying('other', undefined, otherContext);
borrowed.destroy();
draft.destroy();
`,
  'api-application-1': `
assert.equal(app.isRunning(), true);
assert.equal(fetches.length, 1);
assert.equal(fetches[0].url, '/summary.json');
assert.equal(fetches[0].signal.aborted, false);
const initialRoot = app.getView();
const destination = app.getRegion();
const state = app.getState();
assert.equal(initialRoot.el.querySelector('h1').textContent, '<Quarterly summary>');
assert.equal(initialRoot.el.querySelector('quarterly'), null);
assert.equal(await app.restart(), true);
assert.equal(fetches.length, 2);
assert.equal(initialRoot.isDestroyed(), true);
assert.notEqual(app.getView(), initialRoot);
assert.equal(app.getState(), state);
assert.equal(app.getRegion(), destination);
assert.equal(app.stop(), true);
assert.equal(app.getView(), undefined);
assert.equal(destination.isDestroyed(), false);
globalThis.fetch = async () => new Response('', { status: 503 });
await assert.rejects(app.start(), /Could not load the summary/);
assert.equal(app.isRunning(), false);
let finishFetch;
let cancelledSignal;
globalThis.fetch = (url, options) => {
  cancelledSignal = options.signal;
  return new Promise(resolve => { finishFetch = resolve; });
};
let activations = 0;
app.on('start', () => { activations++; });
const pending = app.start();
assert.equal(app.start(), pending);
assert.equal(app.stop(), true);
assert.equal(await pending, false);
assert.equal(cancelledSignal.aborted, true);
finishFetch(new Response(JSON.stringify({ title: 'Obsolete' })));
await new Promise(resolve => setImmediate(resolve));
assert.equal(activations, 0);
assert.equal(app.getView(), undefined);
assert.equal(app.destroy(), true);
assert.equal(destination.isDestroyed(), true);
assert.equal(await app.start(), false);
const adopted = document.createElement('article');
adopted.textContent = 'Existing page';
document.body.append(adopted);
const owner = new Application();
const page = owner.setView(new View({ el: adopted, template: false }));
assert.equal(page.isRendered(), true);
owner.stop();
assert.equal(page.isDestroyed(), true);
assert.equal(adopted.isConnected, false);
owner.destroy();
mount.remove();
`,
  'api-collection-view-1': `
const apricot = list.children.findByModel(items.get('a'));
const blueberry = list.children.findByModel(items.get('b'));
assert.equal(list.children.length, 2);
list.setFilter('available');
assert.equal(list.children.length, 1);
assert.equal(blueberry.isDestroyed(), false);
assert.equal(blueberry.el.isConnected, false);
items.get('b').set('available', true);
assert.equal(list.children.length, 1); // Native model change does not refilter the parent.
list.filter();
assert.equal(list.children.findByModel(items.get('b')), blueberry);
items.get('b').set('available', false);
list.removeFilter();
assert.equal(list.children.findByModel(items.get('b')), blueberry);
list.setComparator((view) => view.model.get('label'));
items.add({ id: 'c', label: 'Apple', available: true });
assert.deepEqual(list.children.map(view => view.model.id), ['c', 'a', 'b']);
assert.equal(list.children.findByModel(items.get('a')), apricot);
assert.equal(list.children.findByModel(items.get('b')), blueberry);
list.setComparator(view => view.model.id === 'b' ? -1 : 0);
assert.deepEqual(list.children.map(view => view.model.id), ['b', 'c', 'a']);
list.setComparator(view => view.model.id === 'b' ? undefined : 0);
assert.deepEqual(list.children.map(view => view.model.id), ['c', 'a', 'b']);
list.setComparator('label');
items.get('b').set('label', '<Berry>');
assert.deepEqual(list.children.map(view => view.model.id), ['c', 'a', 'b']); // No automatic resort.

assert.equal(blueberry.el.textContent, '<Berry>');
assert.equal(blueberry.el.querySelector('berry'), null);
list.setFilter(() => false);
assert.equal(list.isEmpty(), true);
const empty = list.getEmptyRegion().currentView;
assert.equal(empty.el.textContent, 'No items');
assert.equal(blueberry.isDestroyed(), false);
list.removeFilter();
assert.equal(empty.isDestroyed(), true);
const former = list.children.toArray();
items.reset([{ id: 'd', label: 'Date' }]);
assert.equal(former.every(view => view.isDestroyed()), true);
assert.equal(list.children.length, 1);
const extra = new View({ template: false });
list.addChildView(extra, 0);
assert.equal(list.children.first(), extra);
assert.equal(list.detachChildView(extra), extra);
assert.equal(extra.isDestroyed(), false);
const nextOwner = new Region({ el: document.createElement('aside') });
nextOwner.show(extra);
nextOwner.destroy();
const finalRow = list.children.first();
region.destroy();
assert.equal(finalRow.isDestroyed(), true);
assert.equal(list.isDestroyed(), true);
items.destroy();
mount.remove();
`,
  'api-view-1': 'assert.equal(page.isDestroyed(), true); assert.equal(child.isDestroyed(), true); assert.equal(document.body.contains(el), false);',
  'api-region-1': 'assert.equal(retained, view); assert.equal(first.hasView(), false); assert.equal(second.hasView(), false); assert.equal(view.isDestroyed(), true);',
  'api-shared-view-bindings-1': 'assert.equal(greeting.el.textContent, \'Hello, Sam\'); assert.equal(greeting.isDestroyed(), true);',
  'api-shared-common-1': 'assert.equal(panel.el.getAttribute(\'aria-label\'), \'Settings\'); panel.destroy();',
  'api-shared-events-1': 'assert.equal(listener.selectedView, source); assert.equal(source.isDestroyed(), true); assert.equal(listener.isDestroyed(), true);',
  'api-shared-state-1': 'assert.equal(disclosure.el.getAttribute(\'aria-expanded\'), \'true\'); assert.equal(disclosure.getState().isDestroyed(), true);',
};
const report = { passed: false, examples: [], environment: process.argv[2] ? 'Installed package with repository-supplied JSDOM and TypeScript.' : 'Local built packages with JSDOM and TypeScript.' };
const hash = value => createHash('sha256').update(value).digest('hex');
report.probeSha256 = hash(readFileSync(import.meta.filename));
report.tools = Object.fromEntries(['typescript', 'jsdom'].map(name => [name, JSON.parse(readFileSync(require.resolve(`${name}/package.json`), 'utf8')).version]));
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
if (!process.argv[2]) {
  // Keep the repository dependency graph unchanged. Local checks resolve the
  // built public exports through a disposable consumer directory.
  for (const [name, directory] of [['marionette', '.'], ['@mnjs/data', 'packages/data'], ['@mnjs/adapters', 'packages/adapters'], ['@mnjs/radio', 'packages/radio'], ['@mnjs/utils', 'packages/utils']]) {
    const target = join(output, 'node_modules', name);
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(join(root, directory), target, 'junction');
  }
}

function run(args, label) {
  const result = spawnSync(process.execPath, args, {
    cwd: consumer, encoding: 'utf8', timeout: 60_000,
    env: { ...process.env, NODE_PATH: '', NODE_OPTIONS: '--no-global-search-paths' },
  });
  writeFileSync(join(output, `${label}.log`), `${result.stdout || ''}\n${result.stderr || ''}`);
  assert.equal(result.status, 0, `${label} failed: ${result.error || result.stderr || result.stdout}`);
}

try {
  for (const path of pages) {
    const markdown = readFileSync(join(installed, path), 'utf8');
    const fences = [...markdown.matchAll(/```(js|javascript|ts|typescript)\n([\s\S]*?)```/g)];
    for (const [index, [, language, source]] of fences.entries()) {
      const typescript = language === 'ts' || language === 'typescript';
      const name = `${path.slice(5, -3).replaceAll('/', '-')}-${index + 1}`;
      const file = join(output, `${name}.${typescript ? 'mts' : 'mjs'}`);
      writeFileSync(file, source);
      if (name === 'integrations-setup-1') { writeFileSync(join(output, 'setup.js'), source); }
      report.examples.push({ path, fence: index + 1, name, sourceSha256: hash(source), file, typescript });
    }
  }
  assert(report.examples.length, 'No executable reference examples found');
  const typed = report.examples.filter(example => example.typescript);
  assert(typed.length, 'Expected at least one TypeScript reference example');
  const typeFixtures = ['application.mts', 'application.cts', 'presentation.mts', 'presentation.cts', 'lifecycle-mixins.mts', 'lifecycle-mixins.cts', 'consumer.mts', 'consumer.cts', 'fixed-root.mts', 'fixed-root.cts', 'facade.mts', 'facade.cts', 'dom.mts', 'dom.cts', 'providers.mts', 'providers.cts', 'radio.mts', 'radio.cts', 'requests.mts', 'requests.cts'].map(name => {
    const source = readFileSync(join(root, 'test/types', name), 'utf8');
    const file = join(output, `contract-${name}`);
    writeFileSync(file, source);
    return { source: `test/types/${name}`, sourceSha256: hash(source), file };
  });
  report.typeFixtures = typeFixtures.map(({ source, sourceSha256 }) => ({ source, sourceSha256 }));
  writeFileSync(join(output, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { target: 'ES2024', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, skipLibCheck: false, types: [], outDir: './compiled' },
    files: [...typed.map(example => example.file), ...typeFixtures.map(fixture => fixture.file)],
  }, null, 2));
  run([join(root, 'node_modules/typescript/bin/tsc'), '-p', join(output, 'tsconfig.json')], 'typescript');
  report.typescript = { passed: true, examples: typed.length, contractFixtures: typeFixtures.length };
  assert.deepEqual(report.examples.map(example => example.name).sort(), Object.keys(assertions).sort(), 'Reference fences changed; update their outcome checks');
  const bootstrap = join(output, 'bootstrap.mjs');
  writeFileSync(bootstrap, `import { JSDOM } from ${JSON.stringify(pathToFileURL(require.resolve('jsdom')).href)};
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'DocumentFragment', 'Event', 'CustomEvent']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
}
`);
  for (const example of report.examples) {
    const executable = example.typescript ? join(output, 'compiled', `${example.name}.mjs`) : example.file;
    const checked = executable.replace(/\.mjs$/, '.checked.mjs');
    writeFileSync(checked, `import assert from 'node:assert/strict';\n${preparations[example.name] || ''}\n${readFileSync(executable, 'utf8')}\n${assertions[example.name]}\n`);
    run(['--import', bootstrap, checked], example.name);
    example.executed = true;
    if (preparations[example.name]) { example.testPreparation = preparations[example.name]; }
    example.outcomeAssertions = assertions[example.name];
  }
  report.passed = true;
} catch (error) {
  report.error = String(error.stack || error);
  process.exitCode = 1;
} finally {
  for (const example of report.examples) { example.file = example.file.slice(dirname(output).length + 1); }
  writeFileSync(join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Reference examples: ${report.examples.filter(example => example.executed).length}/${report.examples.length} executed; ${report.typescript?.contractFixtures ?? 0} declaration fixtures; passed=${report.passed}. Report: ${join(output, 'report.json')}`);
  if (report.error) { console.error(report.error); }
}
