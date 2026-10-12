import { afterEach, describe, expect, it, vi } from 'vitest';
import { Application, View, CollectionView, Region, createMarionette } from 'marionette';
import { Model, Collection, DataApi } from '@mnjs/data';
import { createTestScope, mountApplication, mountView } from '@mnjs/test';

let scope;
afterEach(async() => { await scope?.cleanup(); scope = undefined; });
function own(mount) { scope ??= createTestScope(); return scope.own(mount); }
const Card = View.extend({ template: () => '<button>Open</button>' });

describe('real Region mounting', () => {
  it('keeps a borrowed container in place when attachTo is also supplied', async() => {
    const original = document.body.appendChild(document.createElement('section'));
    const destination = document.body.appendChild(document.createElement('section'));
    const host = original.appendChild(document.createElement('div'));
    scope = createTestScope();
    scope.defer(() => { original.remove(); destination.remove(); });
    const mounted = scope.own(mountView(new Card(), { container: host, attachTo: destination }));
    expect(mounted.container).toBe(host);
    expect(host.parentNode).toBe(original);
    expect(destination.childNodes).toHaveLength(0);
    await mounted.cleanup();
    expect(host.parentNode).toBe(original);
    expect(host.children).toHaveLength(0);
  });
  it('releases a mounted View binding without destroying its borrowed observable source', async() => {
    const model = new Model({ name: 'Ada' });
    const updates = [];
    const Observed = View.extend({
      template: data => `<p>${data.name}</p>`,
      modelEvents: { 'change:name': 'recordChange' },
      recordChange() { updates.push(this.model.get('name')); }
    }).setDataApi(DataApi);
    const mounted = own(mountView(new Observed({ model })));
    expect(mounted.el.textContent).toBe('Ada');
    model.set('name', 'Grace');
    expect(updates).toEqual(['Grace']);
    await mounted.cleanup();
    model.set('name', 'Katherine');
    expect(model.get('name')).toBe('Katherine');
    expect(updates).toEqual(['Grace']);
  });
  it('forwards initial show options without turning them into persistent Region defaults', async() => {
    const calls = [];
    const ObservedRegion = Region.extend({
      onBeforeShow(region, view, options) { calls.push({ region, view, options }); }
    });
    const showOptions = { replaceElement: true, reason: 'initial' };
    const mounted = own(mountView(new Card(), { regionClass: ObservedRegion, showOptions }));
    expect(calls[0].options).toBe(showOptions);
    expect(calls[0].view).toBe(mounted.view);
    expect(calls[0].region).toBe(mounted.region);
    expect(mounted.region.isReplaced()).toBe(true);
    const replacement = new Card();
    mounted.region.show(replacement);
    expect(calls[1].options).toBeUndefined();
    expect(mounted.region.isReplaced()).toBe(false);
    expect(mounted.slot.parentNode).toBe(mounted.container);
    expect(replacement.el.parentNode).toBe(mounted.slot);
    expect(mounted.view.isDestroyed()).toBe(true);
    await mounted.cleanup();
    expect(replacement.isDestroyed()).toBe(true);
  });
  it('exposes actual instances and attaches by default', async() => {
    const view = new Card();
    const lifecycle = [];
    for (const event of ['render', 'attach', 'detach', 'destroy']) { view.on(event, () => lifecycle.push(event)); }
    const mounted = own(mountView(view));
    expect(mounted.view).toBe(view);
    expect(mounted.region.currentView).toBe(view);
    expect(mounted.el).toBe(view.el);
    expect(view.isRendered()).toBe(true);
    expect(view.isAttached()).toBe(true);
    expect(document.body.contains(view.el)).toBe(true);
    expect(lifecycle).toEqual(['render', 'attach']);
    await mounted.cleanup();
    expect(view.isDestroyed()).toBe(true);
    expect(mounted.region.isDestroyed()).toBe(true);
    expect(mounted.el).toBeUndefined();
    expect(mounted.container.isConnected).toBe(false);
    expect(lifecycle).toEqual(['render', 'attach', 'detach', 'destroy']);
  });

  it('supports detached replacement and repeated cleanup', async() => {
    const mounted = own(mountView(new Card(), { attachTo: null, showOptions: { replaceElement: true } }));
    expect(mounted.view.isAttached()).toBe(false);
    expect(mounted.slot.parentNode).toBeNull();
    expect(mounted.el.parentNode).toBe(mounted.container);
    const replacement = new Card();
    mounted.region.show(replacement, { replaceElement: true });
    expect(mounted.view.isDestroyed()).toBe(true);
    expect(mounted.el).toBe(replacement.el);
    expect(mounted.region.isReplaced()).toBe(true);
    const first = mounted.cleanup();
    expect(mounted.cleanup()).toBe(first);
    await first;
    expect(replacement.isDestroyed()).toBe(true);
    expect(mounted.container.childNodes).toHaveLength(0);
  });

  it('removes its slot and replacement while retaining a borrowed host and sibling', async() => {
    const host = document.createElement('section');
    const sibling = document.createElement('p');
    const click = vi.fn();
    sibling.addEventListener('click', click);
    host.append(sibling);
    document.body.append(host);
    scope = createTestScope();
    scope.defer(() => host.remove());
    const mounted = scope.own(mountView(new Card(), { container: host, showOptions: { replaceElement: true } }));
    await mounted.cleanup();
    expect(host.isConnected).toBe(true);
    expect([...host.children]).toEqual([sibling]);
    expect(host.firstElementChild).toBe(sibling);
    host.firstElementChild.dispatchEvent(new window.Event('click'));
    expect(click).toHaveBeenCalledOnce();
  });

  it('infers ownerDocument from a destination and preserves destination', async() => {
    const doc = document.implementation.createHTMLDocument('other');
    const mounted = own(mountView(new Card(), { attachTo: doc.body }));
    expect(mounted.container.ownerDocument).toBe(doc);
    expect(doc.body.contains(mounted.el)).toBe(true);
    await mounted.cleanup();
    expect(doc.body.isConnected).toBe(true);
    expect(doc.body.children).toHaveLength(0);
  });

  it('uses an explicit document with a detached host', () => {
    const doc = document.implementation.createHTMLDocument('detached');
    const mounted = own(mountView(new Card(), { document: doc, attachTo: null }));
    expect(mounted.slot.ownerDocument).toBe(doc);
    expect(mounted.container.parentNode).toBeNull();
  });

  it('leaves detached Views owned by their new caller', async() => {
    const mounted = own(mountView(new Card()));
    const detached = mounted.region.detachView();
    expect(detached).toBe(mounted.view);
    expect(mounted.el).toBeUndefined();
    scope.defer(() => detached.destroy());
    await mounted.cleanup();
    expect(detached.isDestroyed()).toBe(false);
  });

  it('destroys owned child Views and releases bindings to borrowed data', async() => {
    const model = new Model({ name: 'Ada' });
    const collection = new Collection([model]);
    const Item = View.extend({ template: data => `<p>${data.name}</p>` }).setDataApi(DataApi);
    const List = CollectionView.extend({ childView: Item }).setDataApi(DataApi);
    const mounted = own(mountView(new List({ collection })));
    const child = mounted.view.children.findByModel(model);
    expect(mounted.el.textContent).toBe('Ada');
    await mounted.cleanup();
    expect(child.isDestroyed()).toBe(true);
    expect(collection.length).toBe(1);
    model.set('name', 'Grace');
    expect(model.get('name')).toBe('Grace');
  });

  it('uses isolated runtime providers without modifying defaults', () => {
    const runtime = createMarionette();
    runtime.setRenderer(() => 'isolated');
    const isolated = own(mountView(new runtime.View({ template: () => 'ignored' }), { regionClass: runtime.Region }));
    const ordinary = own(mountView(new Card()));
    expect(isolated.el.textContent).toBe('isolated');
    expect(ordinary.el.textContent).toBe('Open');
  });
});

describe('Application mounting', () => {
  it('cancels immediately ready startup when cleanup is requested in the same turn', async() => {
    const commit = vi.fn();
    const Feature = Application.extend({ onStart: commit });
    const mounted = own(mountApplication(() => new Feature()));
    const cleanup = mounted.cleanup();
    await expect(mounted.ready).resolves.toBe(false);
    await cleanup;
    expect(commit).not.toHaveBeenCalled();
    expect(mounted.app.isDestroyed()).toBe(true);
  });
  it('makes initial readiness observable and forwards options to preparation', async() => {
    const preparation = Promise.withResolvers();
    let options;
    const Feature = Application.extend({
      prepareStart(input) { options = input; return preparation.promise; },
      onStart(app, input, name) { this.showView(new Card({ template: () => `<p>${name}</p>` })); }
    });
    const mounted = own(mountApplication(region => new Feature({ region }), { startOptions: { account: 7 } }));
    expect(mounted.app.getRegion()).toBe(mounted.region);
    expect(mounted.el).toBeUndefined();
    expect(mounted.app.isRunning()).toBe(false);
    expect(mounted.ready).toBe(mounted.app.start());
    expect(options.account).toBe(7);
    preparation.resolve('Ada');
    await expect(mounted.ready).resolves.toBe(true);
    expect(mounted.el.textContent).toBe('Ada');
    await mounted.cleanup();
    expect(mounted.app.isDestroyed()).toBe(true);
  });

  it('cancels ignored pending work on cleanup and never commits late results', async() => {
    const preparation = Promise.withResolvers();
    const committed = vi.fn();
    let signal;
    const Feature = Application.extend({
      prepareStart(options, context) { signal = context.signal; return preparation.promise; },
      onStart: committed
    });
    const mounted = own(mountApplication(() => new Feature()));
    await mounted.cleanup();
    await expect(mounted.ready).resolves.toBe(false);
    expect(signal.aborted).toBe(true);
    preparation.resolve('obsolete');
    await preparation.promise;
    expect(committed).not.toHaveBeenCalled();
    expect(mounted.el).toBeUndefined();
  });

  it('exposes stop cancellation and handles late preparation rejection', async() => {
    const preparation = Promise.withResolvers();
    const Feature = Application.extend({ prepareStart() { return preparation.promise; } });
    const mounted = own(mountApplication(() => new Feature()));
    mounted.app.stop();
    await expect(mounted.ready).resolves.toBe(false);
    preparation.reject(new Error('late'));
    await expect(preparation.promise).rejects.toThrow('late');
    expect(mounted.app.isRunning()).toBe(false);
  });

  it('propagates readiness rejection and allows explicit cleanup', async() => {
    const Feature = Application.extend({ prepareStart() { throw new Error('network failed'); } });
    const mounted = own(mountApplication(() => new Feature()));
    await expect(mounted.ready).rejects.toThrow('network failed');
    await mounted.cleanup();
    expect(mounted.app.isDestroyed()).toBe(true);
  });

  it('does not await promises returned by onStart or claim later work settled', async() => {
    const ongoing = Promise.withResolvers();
    const Feature = Application.extend({ onStart() { return ongoing.promise; } });
    const mounted = own(mountApplication(() => new Feature()));
    await expect(mounted.ready).resolves.toBe(true);
    expect(mounted.app.isRunning()).toBe(true);
    ongoing.resolve();
  });

  it('preserves native onStart failure after activation', async() => {
    const Feature = Application.extend({ onStart() { throw new Error('commit failed'); } });
    const mounted = own(mountApplication(() => new Feature()));
    await expect(mounted.ready).rejects.toThrow('commit failed');
    expect(mounted.app.isRunning()).toBe(true);
  });

  it('destroys descendants, but neither starts nor awaits them implicitly', async() => {
    const child = new Application();
    const Feature = Application.extend({ initialize() { this.addChildApp('child', child); } });
    const mounted = own(mountApplication(() => new Feature()));
    await expect(mounted.ready).resolves.toBe(true);
    expect(child.isRunning()).toBe(false);
    await mounted.cleanup();
    expect(child.isDestroyed()).toBe(true);
  });

  it('cancels required child preparation through parent ownership', async() => {
    const pending = Promise.withResolvers();
    let childSignal;
    const Child = Application.extend({ prepareStart(options, { signal }) { childSignal = signal; return pending.promise; } });
    const Feature = Application.extend({
      childApps: { child: Child },
      async prepareStart(options, { signal }) {
        const child = this.getChildApp('child');
        signal.addEventListener('abort', () => child.stop(), { once: true });
        await child.start();
        signal.throwIfAborted();
      }
    });
    const mounted = own(mountApplication(() => new Feature()));
    const child = mounted.app.getChildApp('child');
    await mounted.cleanup();
    await expect(mounted.ready).resolves.toBe(false);
    expect(childSignal.aborted).toBe(true);
    expect(child.isDestroyed()).toBe(true);
    pending.resolve();
  });

  it('retains initial readiness across explicit restart and root replacement', async() => {
    const Feature = Application.extend({ onStart() { this.showView(new Card()); } });
    const mounted = own(mountApplication(() => new Feature()));
    await mounted.ready;
    const root = mounted.app.getView();
    await expect(mounted.app.restart()).resolves.toBe(true);
    expect(root.isDestroyed()).toBe(true);
    expect(mounted.el).toBe(mounted.app.getView().el);
    await expect(mounted.ready).resolves.toBe(true);
  });

  it('borrows external state and leaves shared channels and Regions alive', async() => {
    const state = new Model({ count: 0 });
    const external = new Region({ el: document.createElement('div') });
    const mounted = own(mountApplication(() => new Application({ state, region: external, channelName: 'test-helper' })));
    await mounted.ready;
    const channel = mounted.app.getChannel();
    await mounted.cleanup();
    expect(external.isDestroyed()).toBe(false);
    state.set('count', 1);
    expect(state.get('count')).toBe(1);
    channel.reply('borrowed', () => 42);
    expect(channel.request('borrowed')).toBe(42);
    channel.stopReplying();
    external.destroy();
  });

  it('supports Application runtime isolation', async() => {
    const runtime = createMarionette();
    const Feature = runtime.Application.extend({ onStart() { this.showView(new runtime.View({ template: () => 'runtime' })); } });
    const mounted = own(mountApplication(() => new Feature(), { regionClass: runtime.Region, attachTo: null }));
    await expect(mounted.ready).resolves.toBe(true);
    expect(mounted.el.textContent).toBe('runtime');
  });
});
