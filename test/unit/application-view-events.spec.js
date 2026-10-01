import { afterEach, describe, expect, it, vi } from 'vitest';
import { Application, Region, View } from 'marionette';

const apps = [];
const regions = [];
const views = [];
function app(properties = {}, options = {}) {
  const instance = new (Application.extend(properties))({ region: { el: document.createElement('main') }, ...options });
  apps.push(instance);
  return instance;
}
function view() { const root = new View({ template: () => '' }); views.push(root); return root; }
afterEach(async() => {
  for (const instance of apps.splice(0)) { await instance.destroy(); }
  regions.splice(0).forEach(region => region.destroy());
  views.splice(0).forEach(root => root.destroy());
});

describe('Application viewEvents', () => {
  it('uses declaration context, arguments, options and inheritance before render and after failed startup', async() => {
    const handler = vi.fn();
    const Base = Application.extend({ receive: handler, viewEvents() { return { ready: 'receive' }; } });
    const App = Base.extend({ prepareStart() { return Promise.reject(new Error('loading')); } });
    const instance = new App({ region: { el: document.createElement('main') } });
    apps.push(instance);
    const root = view();
    root.on('render', () => root.trigger('ready', 7, 'render'));
    instance.setView(root);
    instance.setView(root);
    instance.showView();
    instance.showView();
    expect(handler.mock.calls).toEqual([[7, 'render']]);
    expect(handler.mock.contexts).toEqual([instance]);
    await expect(instance.start()).rejects.toThrow('loading');
    root.trigger('ready', 'retry');
    expect(handler).toHaveBeenCalledTimes(2);
    const optionHandler = vi.fn();
    const other = app({}, { viewEvents: { ready: optionHandler } });
    other.setView(view()).trigger('ready', 8);
    expect(optionHandler).toHaveBeenCalledWith(8);
    expect(optionHandler.mock.contexts).toEqual([other]);
  });

  it('keeps displayed and staged sources bound, drops discarded candidates and preserves manual listeners', () => {
    const handler = vi.fn();
    const instance = app({ viewEvents: { intent: 'receive' }, receive: handler });
    const displayed = view();
    instance.showView(displayed);
    instance.listenTo(displayed, 'intent', instance.receive);
    const staged = instance.setView(view());
    displayed.trigger('intent', 'old');
    staged.trigger('intent', 'candidate');
    expect(handler.mock.calls).toEqual([['old'], ['old'], ['candidate']]);
    instance.setView(displayed);
    expect(staged.isDestroyed()).toBe(true);
    const replacement = instance.setView(view());
    displayed.trigger('intent', 'still visible');
    expect(handler.mock.calls.slice(-2)).toEqual([['still visible'], ['still visible']]);
    replacement.trigger('intent', 'next');
    instance.showView();
    expect(displayed.isDestroyed()).toBe(true);
    replacement.trigger('intent', 'shown');
    expect(handler.mock.calls.at(-1)).toEqual(['shown']);
    expect(handler).toHaveBeenCalledTimes(7);
  });

  it('preserves ordinary listeners on detach and avoids duplicate binding on reselection', () => {
    const handler = vi.fn();
    const instance = app({ viewEvents: { intent: 'receive' }, receive: handler });
    const root = instance.showView(view());
    instance.listenTo(root, 'intent', instance.receive);
    instance.getRegion().on('empty', () => root.trigger('intent', 'detach'));
    instance.getRegion().detachView();
    root.trigger('intent', 'detached');
    expect(handler.mock.calls).toEqual([['detach'], ['detach'], ['detached'], ['detached']]);
    instance.showView(root);
    root.trigger('intent', 'reselected');
    expect(handler.mock.calls.slice(4)).toEqual([['reselected'], ['reselected']]);
    instance.getRegion().empty();
    expect(instance.getView()).toBeUndefined();
  });

  it('preserves displayed ownership timing for an Application without viewEvents', () => {
    const instance = app();
    const root = instance.showView(view());
    let duringTeardown;
    root.on('before:destroy', () => { duringTeardown = instance.getView(); });
    instance.getRegion().empty();
    expect(duringTeardown).toBe(root);
    expect(instance.getView()).toBeUndefined();
  });

  it('cleans ordinary listeners when the View or Application is destroyed', async() => {
    const handler = vi.fn();
    const instance = app({ viewEvents: { intent: handler } });
    const displayed = instance.showView(view());
    displayed.destroy();
    displayed.trigger('intent', 'destroyed view');
    const detached = instance.showView(view());
    instance.getRegion().detachView();
    await instance.destroy();
    detached.trigger('intent', 'destroyed application');
    expect(handler).not.toHaveBeenCalled();
    expect(detached.isDestroyed()).toBe(false);
  });

  it('rejects invalid handler names before adopting or subscribing to a candidate', () => {
    const receive = vi.fn();
    const instance = app({ viewEvents: { intent: 'receive' }, receive });
    const prepared = instance.setView(view());
    instance.viewEvents = { valid: 'receive', intent: 'missing' };
    const candidate = view();
    const subscribe = vi.spyOn(candidate, 'on');
    expect(() => instance.setView(candidate)).toThrow(/missing/);
    expect(instance.getView()).toBe(prepared);
    expect(prepared.isDestroyed()).toBe(false);
    expect(subscribe).not.toHaveBeenCalled();
    candidate.trigger('valid', 'rejected');
    expect(receive).not.toHaveBeenCalled();
    const other = app();
    expect(other.setView(candidate)).toBe(candidate);
    other.showView();
    other.getRegion().detachView();
    instance.viewEvents = { intent: 'receive' };
    instance.setView(candidate);
    candidate.trigger('intent', 'valid retry');
    expect(receive).toHaveBeenCalledExactlyOnceWith('valid retry');
    expect(prepared.isDestroyed()).toBe(true);
  });

  it('preserves explicit stopListening without rebinding on reselection', () => {
    const receive = vi.fn();
    const instance = app({ viewEvents: { intent: receive } });
    const root = instance.showView(view());
    instance.stopListening(root);
    instance.getRegion().detachView();
    instance.showView(root);
    root.trigger('intent');
    expect(receive).not.toHaveBeenCalled();
  });

  for (const selection of ['prepared', 'displayed']) {
    it(`binds a ${selection} root once after its declaration becomes available`, () => {
      const receive = vi.fn();
      const replacement = vi.fn();
      const instance = app({ viewEvents() {} });
      const root = selection === 'prepared' ? instance.setView(view()) : instance.showView(view());
      instance.viewEvents = { intent: receive };
      instance.setView(root);
      instance.viewEvents = { intent: replacement };
      instance.setView(root);
      root.trigger('intent', 'selected');
      expect(receive).toHaveBeenCalledExactlyOnceWith('selected');
      expect(replacement).not.toHaveBeenCalled();
    });
  }

  it('preserves one registration when reselecting the retained root across restart', async() => {
    const receive = vi.fn();
    const instance = app({ viewEvents: { intent: receive } });
    const root = instance.showView(view());
    await instance.start();
    await instance.restart();
    instance.setView(root);
    instance.showView(root);
    root.trigger('intent', 'retained');
    expect(receive).toHaveBeenCalledExactlyOnceWith('retained');
    expect(root.isDestroyed()).toBe(false);
  });

  it('does not subscribe a candidate when the previous prepared View teardown fails', () => {
    const receive = vi.fn();
    const instance = app({ viewEvents: { intent: receive } });
    const prepared = instance.setView(view());
    const fail = () => { throw new Error('teardown'); };
    prepared.on('before:destroy', fail);
    const candidate = view();
    expect(() => instance.setView(candidate)).toThrow('teardown');
    candidate.trigger('intent');
    expect(receive).not.toHaveBeenCalled();
    prepared.off('before:destroy', fail);
    prepared.destroy();
  });

  it('adds no declaration subscriptions when viewEvents is unused', () => {
    const instance = app();
    const root = view();
    const subscribe = vi.spyOn(instance, 'listenTo');
    instance.setView(root);
    instance.showView();
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('never binds unrelated content in a shared borrowed Region', async() => {
    const region = new Region({ el: document.createElement('main') });
    regions.push(region);
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
    const first = app({ viewEvents: { intent: firstHandler } }, { region });
    const second = app({ viewEvents: { intent: secondHandler } }, { region });
    const unrelated = view();
    region.show(unrelated);
    unrelated.trigger('intent');
    expect(firstHandler).not.toHaveBeenCalled();
    expect(secondHandler).not.toHaveBeenCalled();
    first.showView(view()).trigger('intent', 'first');
    const secondRoot = second.showView(view());
    secondRoot.trigger('intent', 'second');
    await first.stop();
    secondRoot.trigger('intent', 'still second');
    expect(firstHandler.mock.calls).toEqual([['first']]);
    expect(secondHandler.mock.calls).toEqual([['second'], ['still second']]);
    expect(secondRoot.isDestroyed()).toBe(false);
  });

  it('releases prepared destruction and host replacement while keeping staged bindings', async() => {
    const handler = vi.fn();
    const instance = app({ viewEvents: { intent: handler } });
    const discarded = instance.setView(view());
    discarded.destroy();
    expect(instance.getView()).toBeUndefined();
    const displayed = instance.showView(view());
    const next = instance.setView(view());
    const region = new Region({ el: document.createElement('main') });
    regions.push(region);
    await instance.start({ region });
    expect(displayed.isDestroyed()).toBe(true);
    next.trigger('intent', 'prepared');
    instance.showView();
    next.trigger('intent', 'displayed');
    expect(handler.mock.calls).toEqual([['prepared'], ['displayed']]);
  });
});
