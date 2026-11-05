import { afterEach, describe, expect, it, vi } from 'vitest';
import { Application, MnObject, createMarionette, Radio, Region, View } from 'marionette';
import { createRadio } from '@mnjs/radio';
import { Model, StateApi } from '@mnjs/data';
import { JSDOM } from 'jsdom';
import * as routing from '@mnjs/router';

const owned = new Set();
function own(value) { owned.add(value); return value; }
afterEach(() => {
  for (const value of owned) { value.destroy?.(); }
  owned.clear();
});
const routes = [{ name: 'home', path: '/' }, { name: 'page', path: '/page' }];

function memory() { return routing.memoryDriver({ url: 'http://localhost/' }); }

describe('Marionette Router construction and lifecycle', () => {
  it('supports options, subclass initialization and extension without overriding a constructor', async() => {
    const driver = memory();
    const initialized = vi.fn();
    const Router = routing.Router.extend({
      routes,
      initialize(options) {
        initialized(options);
        expect(this.url('page')).toBe('/page');
        this.activation = this.start();
      },
    });
    const options = { driver, name: 'example' };
    const router = own(new Router(options));
    expect(router).toBeInstanceOf(Application);
    expect(initialized).toHaveBeenCalledExactlyOnceWith(options);
    expect(router.getOption('name')).toBe('example');
    expect(await router.activation).toBe(true);
    expect(router.getCurrent().name).toBe('home');
  });

  it('treats start from a route hook as an already-active Application without dispatching again', async() => {
    const Router = routing.Router.extend({ routes, onRoute() { this.joined = this.start(); } });
    const router = own(new Router({ driver: memory() }));
    const routed = vi.fn();
    router.on('route', routed);
    const initial = router.start();
    expect(await initial).toBe(true);
    expect(await router.joined).toBe(true);
    expect(router.isRunning()).toBe(true);
    expect(routed).toHaveBeenCalledTimes(1);
  });

  it('merges class options with supplied options and resolves route factories once', async() => {
    const factory = vi.fn(function() { expect(this.getOption('scope')).toBe('supplied'); return routes; });
    const Router = routing.Router.extend({ routes: factory, options: { scope: 'default', maxRedirects: 2 } });
    const router = own(new Router({ driver: memory(), scope: 'supplied' }));
    expect(router.getOption('maxRedirects')).toBe(2);
    expect(router.url('home')).toBe('/');
    expect(await router.start()).toBe(true);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('notifies route hooks before events and keeps handler readiness separate from activation', async() => {
    const gate = Promise.withResolvers();
    const notification = Promise.withResolvers();
    const called = [];
    const Router = routing.Router.extend({
      routes,
      handler(match) { called.push(`handler:${ match.name }`); return gate.promise; },
      onRoute(match) { called.push(`hook:${ match.name }`); return notification.promise; },
      onRouteReady(match) { called.push(`ready:${ match.name }`); return notification.promise; },
    });
    const router = own(new Router({ driver: memory() }));
    router.on('route', match => called.push(`event:${ match.name }`));
    router.on('route:ready', match => called.push(`ready-event:${ match.name }`));
    const routeReady = new Promise(resolve => router.once('route:ready', resolve));
    expect(await router.start()).toBe(true);
    expect(called).toEqual(['hook:home', 'event:home', 'handler:home']);
    gate.resolve();
    expect(await routeReady).toBe(router.getCurrent());
    expect(called).toEqual(['hook:home', 'event:home', 'handler:home', 'ready:home', 'ready-event:home']);
    notification.resolve();
  });

  it('does not write URLs while stopped and retains observers across stop/start', async() => {
    const driver = memory();
    const router = own(new routing.Router({ routes, driver }));
    expect(await router.navigate('/page').finished).toBe(false);
    expect(driver.currentEntry.url).toBe('http://localhost/');
    const listener = vi.fn();
    router.on('route', listener);
    await router.start();
    router.stop();
    expect(await router.navigate('/page').finished).toBe(false);
    expect(await router.refresh()).toBe(false);
    expect(await router.back()).toBe(false);
    expect(router.updateState({ tab: 'stopped' })).toBe(false);
    expect(router.canGoBack()).toBe(false);
    expect(router.url('page')).toBe('/page');
    expect(router.match('/page').name).toBe('page');
    expect(await router.start()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(driver.documentNavigations).toEqual([]);
  });

  it('blocks startup reentry from an old route abort callback during stop', async() => {
    const driver = memory();
    const router = own(new routing.Router({ routes, driver }));
    await router.start();
    const first = router.getCurrent();
    let restarted;
    first.signal.addEventListener('abort', () => { restarted = router.start(); }, { once: true });
    router.stop();
    expect(await restarted).toBe(false);
    expect(router.getCurrent().signal.aborted).toBe(true);
    expect(router.isRunning()).toBe(false);
    expect(await router.start()).toBe(true);
    const changed = vi.fn();
    router.on('route', changed);
    expect(await router.navigate('page').finished).toBe(true);
    expect(router.getCurrent().name).toBe('page');
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('notifies initial route errors independently of successful Application activation', async() => {
    const error = new Error('activation failed');
    const calls = [];
    const Router = routing.Router.extend({
      routes,
      handler(match) { expect(this.getCurrent()).toBe(match); throw error; },
      onRouteError(reason, match) { calls.push(['hook', reason, match.name]); },
    });
    const router = own(new Router({ driver: memory() }));
    router.on('route:error', (reason, match) => calls.push(['event', reason, match.name]));
    const failed = new Promise(resolve => router.once('route:error', resolve));
    expect(await router.start()).toBe(true);
    expect(await failed).toBe(error);
    expect(router.isRunning()).toBe(true);
    expect(calls).toEqual([['hook', error, 'home'], ['event', error, 'home']]);
    await expect(router.navigate('page').finished).rejects.toBe(error);
  });

  it('destroys before user hooks can restart effects and releases subscriptions', async() => {
    const driver = memory();
    const source = new MnObject();
    const observed = vi.fn();
    const destroyed = vi.fn();
    const Router = routing.Router.extend({
      routes,
      onBeforeDestroy() { this.restarted = this.start(); this.navigated = this.navigate('/page').finished; },
      onDestroy: destroyed,
    });
    const router = own(new Router({ driver }));
    router.listenTo(source, 'change', observed);
    await router.start();
    const current = router.getCurrent();
    expect(router.destroy()).toBe(true);
    expect(current.signal.aborted).toBe(true);
    expect(await router.restarted).toBe(false);
    expect(await router.navigated).toBe(false);
    source.trigger('change');
    expect(observed).not.toHaveBeenCalled();
    router.destroy();
    expect(destroyed).toHaveBeenCalledTimes(1);
    expect(router.isDestroyed()).toBe(true);
    expect(router.match('/page').name).toBe('page');
    source.destroy();
  });

  it('uses configured Radio and State providers without changing its Application family', async() => {
    const configuredRadio = createRadio();
    const channel = 'router-configured-provider-contract';
    const shared = vi.fn();
    const configured = vi.fn();
    const changed = vi.fn();
    const Router = routing.Router.extend({
      routes,
      Radio: configuredRadio,
      channelName: channel,
      radioEvents: { command: configured },
      createState() { return new Model({ value: 1 }); },
      stateEvents: { 'change:value': changed },
    });
    Router.setStateApi(StateApi);
    const owner = own(new Application());
    const router = owner.addChildApp('router', new Router({ driver: memory() }));
    Radio.on(channel, 'command', shared);
    configuredRadio.trigger(channel, 'command');
    expect(configured).toHaveBeenCalledTimes(1);
    expect(shared).not.toHaveBeenCalled();
    router.getState().set('value', 2);
    expect(changed).not.toHaveBeenCalled();
    await router.start();
    router.getState().set('value', 3);
    expect(changed).toHaveBeenCalledTimes(1);
    router.stop();
    router.getState().set('value', 4);
    expect(changed).toHaveBeenCalledTimes(1);
    await router.start();
    router.getState().set('value', 5);
    expect(changed).toHaveBeenCalledTimes(2);
    router.destroy();
    configuredRadio.trigger(channel, 'command');
    expect(configured).toHaveBeenCalledTimes(1);
    Radio.off(channel, 'command', shared);
  });

  it('does not rebase default-family classes by changing their providers', () => {
    const runtime = createMarionette();
    const isolatedOwner = own(new runtime.Application());
    const Router = routing.Router.extend({ Radio: runtime.Radio, State: runtime.Application.prototype.State });
    const router = own(new Router({ routes, driver: memory() }));
    const pages = own(new routing.ChildAppSwitcher());
    expect(() => isolatedOwner.addChildApp('router', router)).toThrow(/same Marionette runtime/);
    expect(() => isolatedOwner.addChildApp('pages', pages)).toThrow(/same Marionette runtime/);
    expect(routing).not.toHaveProperty('createRouterClass');
    expect(routing).not.toHaveProperty('createChildAppSwitcherClass');
  });
});

describe('child Application switching', () => {
  it('makes destruction terminal before hooks run and destroys its owned children', async() => {
    const owner = own(new Application());
    const Switcher = routing.ChildAppSwitcher.extend({
      onBeforeDestroy() { this.attempted = this.switchTo('page'); },
    });
    const switcher = owner.addChildApp('pages', new Switcher());
    const page = switcher.addChildApp('page', new Application());
    await switcher.start();
    await switcher.switchTo('page');
    expect(switcher.destroy()).toBe(true);
    expect(switcher.destroy()).toBe(true);
    expect(await switcher.attempted).toBeUndefined();
    expect(await switcher.switchTo('page')).toBeUndefined();
    expect(switcher.getCurrent()).toBeNull();
    expect(page.isDestroyed()).toBe(true);
    expect(owner.getChildApp('pages')).toBeUndefined();
  });

  it('exports a switcher with same-instance reconstruction semantics', async() => {
    expect(typeof routing.ChildAppSwitcher).toBe('function');
    const owner = own(new Application());
    let preparations = 0;
    const Page = Application.extend({ prepareStart() { preparations++; } });
    const switcher = owner.addChildApp('pages', new routing.ChildAppSwitcher());
    const page = switcher.addChildApp('page', new Page());
    await switcher.start();
    expect(await switcher.switchTo('page')).toBe(page);
    expect(await switcher.switchTo('page', { reconstruct: true })).toBe(page);
    expect(switcher.getChildApp('page')).toBe(page);
    expect(preparations).toBe(2);
    owner.destroy();
    expect(switcher.isDestroyed()).toBe(true);
  });
});

describe('same-instance UI reconstruction', () => {
  it('keeps editable UI on reuse and rebuilds it only on explicit reconstruction', async() => {
    const dom = new JSDOM('<main></main>');
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    const owner = new Application();
    const region = new Region({ el: dom.window.document.querySelector('main') });
    const Page = Application.extend({
      onStart() {
        if (!this.getView()) {this.setView(new View({ template: () => '<input value="initial">' }));}
        this.showView();
      },
    });
    const switcher = owner.addChildApp('pages', new routing.ChildAppSwitcher());
    const page = switcher.addChildApp('page', new Page());
    try {
      await switcher.start();
      await switcher.switchTo('page', { options: { region } });
      const first = page.getView();
      first.el.querySelector('input').value = 'draft';
      expect(await switcher.switchTo('page')).toBe(page);
      expect(page.getView()).toBe(first);
      expect(region.el.querySelector('input').value).toBe('draft');
      expect(await switcher.switchTo('page', { reconstruct: true })).toBe(page);
      expect(switcher.getChildApp('page')).toBe(page);
      expect(first.isDestroyed()).toBe(true);
      expect(page.getView()).not.toBe(first);
      expect(region.el.querySelector('input').value).toBe('initial');
    } finally {
      owner.destroy();
      region.destroy();
      vi.unstubAllGlobals();
      dom.window.close();
    }
  });
});
