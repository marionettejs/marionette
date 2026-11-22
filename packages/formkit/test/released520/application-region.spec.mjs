import { afterEach, expect, it } from 'vitest';
import { Application, View } from 'marionette';
import { FormKitApplication } from '@mnjs/formkit';
const owners = [];
function own(owner) { owners.push(owner); return owner; }
function make(region, extra = {}) { return own(new FormKitApplication({ region, form: { fields: [{ name: 'word' }], values: { word: 'Ready' }, formProps: { actions: false }, instrument: true }, ...extra })); }
afterEach(() => { for (const owner of owners.splice(0).reverse()) { owner.destroy(); } document.body.replaceChildren(); });
it('matches ordinary Application ownership when an unmatched selector is allowed', async() => {
  class NativeApp extends Application { onStart() { this.showView(new View({ template: false })); } }
  const native = own(new NativeApp({ region: { el: '#native-absent', allowMissingEl: true } }));
  expect(await native.start()).toBe(true); const nativeView = native.getView(); expect(nativeView).toBeInstanceOf(View); expect(native.getRegion().hasView()).toBe(false); native.stop(); expect(nativeView.isDestroyed()).toBe(true);
  const app = make({ el: '#form-absent', allowMissingEl: true }); expect(await app.start()).toBe(true);
  const view = app.getView(); expect(view).toBeInstanceOf(View); expect(app.getRegion().hasView()).toBe(false); expect(view.el.querySelector('input')).toBe(null); expect(app.getFormKitScope()).toBeDefined();
  app.stop(); expect(view.isDestroyed()).toBe(true); expect(view.metrics.coreNodesCreated).toBe(view.metrics.coreNodesDestroyed);
});
it('preserves Region error identity, activation and explicit-stop cleanup after an onStart error', async() => {
  const app = make({ el: '#strict-absent' }); let prepared;
  const create = app.createFormView; app.createFormView = function(options) { prepared = create.call(this, options); return prepared; };
  await expect(app.start()).rejects.toMatchObject({ code: 'MN0005', name: 'RegionError' }); expect(app.isRunning()).toBe(true); expect(app.getView()).toBe(prepared); expect(app.getFormKitScope()).toBeDefined();
  app.stop(); expect(app.isRunning()).toBe(false); expect(app.getView()).toBeUndefined(); expect(app.getFormKitScope()).toBeUndefined(); expect(prepared.isDestroyed()).toBe(true); expect(prepared.metrics.coreNodesCreated).toBe(prepared.metrics.coreNodesDestroyed);
});
it.each([true, false])('keeps an omitted Region el invalid even with allowMissingEl=%s', async allowMissingEl => {
  const app = make({ allowMissingEl }); await expect(app.start()).rejects.toMatchObject({ code: 'MN0004', name: 'RegionError' }); expect(app.isRunning()).toBe(true); const prepared = app.getView();
  // Repair deliberately invalid test configuration before ordinary explicit cleanup.
  app.getRegion().el = document.createElement('main'); app.stop(); expect(prepared.isDestroyed()).toBe(true); expect(prepared.metrics.coreNodesCreated).toBe(prepared.metrics.coreNodesDestroyed);
});
it('keeps a prepared form owned while missing, then adopts it after a later explicit show in the same Document', async() => {
  const app = make({ el: '#later-host', allowMissingEl: true }); expect(await app.start()).toBe(true); const view = app.getView(); const root = view.node;
  const target = document.createElement('main'); target.id = 'later-host'; document.body.append(target); app.showView(view);
  expect(app.getView()).toBe(view); expect(app.getRegion().currentView).toBe(view); expect(view.node).toBe(root); expect(target.querySelector('input').value).toBe('Ready'); expect(root.props.__root).toBe(document);
  const input = target.querySelector('input'); input.value = 'Edited'; input.dispatchEvent(new Event('input', { bubbles: true })); await view.whenPendingEditsSettled(); expect(view.getValues()).toEqual({ word: 'Edited' });
  app.stop(); expect(view.isDestroyed()).toBe(true); expect(target.children).toHaveLength(0); expect(view.metrics.coreNodesCreated).toBe(view.metrics.coreNodesDestroyed);
});
it('delegates functional allowMissingEl to the Region receiver', async() => {
  let receiver, calls = 0; const app = make({ el: '#callback-absent', allowMissingEl() { receiver = this; calls++; return true; } });
  expect(await app.start()).toBe(true); expect(receiver).toBe(app.getRegion()); expect(calls).toBeGreaterThan(0);
});
it.each(['Document', 'ShadowRoot'])('retains the actual %s root for a present Element Region', async kind => {
  const shell = document.createElement('section'); document.body.append(shell); const root = kind === 'ShadowRoot' ? shell.attachShadow({ mode: 'open' }) : document;
  const target = document.createElement('main'); (kind === 'ShadowRoot' ? root : shell).append(target); const app = make({ el: target }); expect(await app.start()).toBe(true);
  const view = app.getView(); expect(view.node.props.__root).toBe(root); expect(view.node.at('word').props.__root).toBe(root); expect(target.querySelector('input').value).toBe('Ready'); app.stop(); expect(target.children).toHaveLength(0);
});
it('honors a supplied Document parent for selector lookup', async() => {
  const other = document.implementation.createHTMLDocument('Other'); const target = other.createElement('main'); target.id = 'other-host'; other.body.append(target);
  const app = make({ el: '#other-host', parentEl: other }); expect(await app.start()).toBe(true); expect(app.getView().node.props.__root).toBe(other); expect(target.querySelector('input').value).toBe('Ready');
});
it('restarts a skipped mount into a new ShadowRoot with a new correctly rooted form', async() => {
  const app = make({ el: '#restart-host', allowMissingEl: true }); await app.start(); const before = app.getView(); app.stop(); expect(before.isDestroyed()).toBe(true);
  const shell = document.createElement('section'); document.body.append(shell); const shadow = shell.attachShadow({ mode: 'open' }); const target = document.createElement('main'); target.id = 'restart-host'; shadow.append(target);
  // Configure the next Region explicitly; a cached boundary never migrates roots.
  app.getRegion().el = target; expect(await app.start()).toBe(true); const after = app.getView(); expect(after).not.toBe(before); expect(after.node.props.__root).toBe(shadow); expect(after.node.at('word').props.__root).toBe(shadow);
});
it('preserves custom form-factory error identity even when the missing mount is allowed', async() => {
  const failure = new Error('factory failed'); const app = make({ el: '#factory-absent', allowMissingEl: true }); app.createFormView = () => { throw failure; }; await expect(app.start()).rejects.toBe(failure);
});
it('keeps a nonvisual configuration-only Application working', async() => {
  const app = make(undefined); expect(await app.start()).toBe(true); expect(app.getView()).toBeUndefined(); expect(app.getFormKitScope()).toBeDefined();
});
