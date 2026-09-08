import { afterEach, describe, expect, it, vi } from 'vitest';
import { Application, Behavior, CollectionView, MnObject, Radio, Region, View } from 'marionette';

afterEach(() => {
  Radio.reset('constructor-rollback');
  document.body.replaceChildren();
});

for (const [name, Base] of Object.entries({ MnObject, Application, Behavior, View, CollectionView })) {
  describe(`${name} construction rollback`, () => {
    it('releases owned state and listeners without dispatching failed-instance destroy lifecycle', async() => {
      const channel = Radio.channel('constructor-rollback');
      const callback = vi.fn();
      const disposeOwned = vi.fn();
      const destroy = vi.fn();
      const failure = new Error('initialization failed');
      const state = {};
      const root = document.createElement('section');
      root.innerHTML = '<button>Borrowed content</button>';
      document.body.append(root);
      const host = name === 'Behavior' ? new View({ el: root }) : undefined;
      let failed;
      const Failed = Base.extend({
        State: { disposeOwned },
        createState() { return state; },
        onBeforeDestroy: destroy,
        onDestroy: destroy,
        initialize() {
          failed = this;
          this.listenTo(channel, 'ping', callback);
          this.getState();
          throw failure;
        }
      });
      let thrown;
      try { new Failed({ el: root }, host); } catch (error) { thrown = error; }
      expect(thrown).toBe(failure);
      channel.trigger('ping');
      expect(callback).not.toHaveBeenCalled();
      expect(disposeOwned).toHaveBeenCalledExactlyOnceWith(state);
      expect(root.isConnected).toBe(true);
      expect(root.textContent).toBe('Borrowed content');
      await failed.destroy();
      expect(destroy).not.toHaveBeenCalled();
      expect(disposeOwned).toHaveBeenCalledTimes(1);
      host?.destroy();
    });

    it('keeps borrowed state alive when initialization fails', () => {
      const disposeOwned = vi.fn();
      const state = {};
      const failure = new Error('borrowed state initialization failed');
      const host = name === 'Behavior' ? new View() : undefined;
      const Failed = Base.extend({
        State: { disposeOwned },
        initialize() { this.getState(); throw failure; }
      });
      expect(() => new Failed({ state }, host)).toThrow(failure);
      expect(disposeOwned).not.toHaveBeenCalled();
      host?.destroy();
    });
  });
}

for (const [name, Base] of Object.entries({ MnObject, Application })) {
  it(`${name} removes Radio events and replies when a later initialization step fails`, () => {
    const channel = Radio.channel('constructor-rollback');
    const event = vi.fn();
    const failure = new Error('initialization failed');
    const Failed = Base.extend({
      channelName: 'constructor-rollback', radioEvents: { ping: event }, radioRequests: { answer: () => 'orphaned' },
      initialize() { throw failure; }
    });
    expect(() => new Failed()).toThrow(failure);
    channel.trigger('ping');
    expect(event).not.toHaveBeenCalled();
    expect(channel.request('answer')).toBeUndefined();
  });

  it(`${name} releases earlier Radio bindings if request configuration throws`, () => {
    const channel = Radio.channel('constructor-rollback');
    const event = vi.fn();
    const failure = new Error('request configuration failed');
    const Failed = Base.extend({
      channelName: 'constructor-rollback', radioEvents: { ping: event },
      radioRequests() { throw failure; }
    });
    expect(() => new Failed()).toThrow(failure);
    channel.trigger('ping');
    expect(event).not.toHaveBeenCalled();
  });

  it(`${name} preserves its construction error and releases listeners when owned disposal throws`, () => {
    const channel = Radio.channel('constructor-rollback');
    const event = vi.fn();
    const disposeOwned = vi.fn(() => { throw new Error('disposal failed'); });
    const failure = new Error('initialization failed');
    const Failed = Base.extend({
      State: { disposeOwned }, createState() { return {}; },
      initialize() { this.getState(); this.listenTo(channel, 'ping', event); throw failure; }
    });
    let thrown;
    try { new Failed(); } catch (error) { thrown = error; }
    expect(thrown).toBe(failure);
    expect(disposeOwned).toHaveBeenCalledTimes(1);
    channel.trigger('ping');
    expect(event).not.toHaveBeenCalled();
  });
}

it('Application leaves a borrowed Region and its existing content intact', () => {
  const root = document.createElement('section');
  root.innerHTML = '<p>Borrowed content</p>';
  document.body.append(root);
  const region = new Region({ el: root });
  const Failed = Application.extend({ initialize() { throw new Error('initialization failed'); } });
  expect(() => new Failed({ region })).toThrow('initialization failed');
  expect(region.isDestroyed()).toBe(false);
  expect(root.isConnected).toBe(true);
  expect(root.textContent).toBe('Borrowed content');
  region.destroy();
});

for (const showChild of [false, true]) {
  it(`Region restores its borrowed root on failure${showChild ? ' after showing an owned child' : ''}`, () => {
    const channel = Radio.channel('constructor-rollback');
    const callback = vi.fn();
    const destroy = vi.fn();
    const root = document.createElement('section');
    root.innerHTML = '<p>Borrowed content</p>';
    document.body.append(root);
    const child = showChild ? new View({ template: () => '<p>Owned child</p>' }) : undefined;
    const failure = new Error('region initialization failed');
    let failed;
    const Failed = Region.extend({
      replaceElement: true,
      onBeforeDestroy: destroy, onDestroy: destroy,
      initialize() {
        failed = this;
        this.listenTo(channel, 'ping', callback);
        if (child) { this.show(child); }
        throw failure;
      }
    });
    expect(() => new Failed({ el: root })).toThrow(failure);
    channel.trigger('ping');
    expect(callback).not.toHaveBeenCalled();
    expect(root.isConnected).toBe(true);
    // show() has already emptied the root; failure cleanup restores its identity.
    expect(root.textContent).toBe(showChild ? '' : 'Borrowed content');
    expect(failed.isDestroyed()).toBe(true);
    if (child) { expect(child.isDestroyed()).toBe(true); }
    failed.destroy();
    expect(destroy).not.toHaveBeenCalled();
  });
}

it('Application releases its constructed Region without clearing unowned root content', () => {
  const channel = Radio.channel('constructor-rollback');
  const callback = vi.fn();
  const root = document.createElement('section');
  root.innerHTML = '<p>Borrowed content</p>';
  document.body.append(root);
  let owned;
  const Owned = Region.extend({ initialize() { owned = this; this.listenTo(channel, 'ping', callback); } });
  const Failed = Application.extend({
    regionClass: Owned, region: { el: root },
    initialize() { throw new Error('application initialization failed'); }
  });
  expect(() => new Failed()).toThrow('application initialization failed');
  expect(owned.isDestroyed()).toBe(true);
  channel.trigger('ping');
  expect(callback).not.toHaveBeenCalled();
  expect(root.isConnected).toBe(true);
  expect(root.textContent).toBe('Borrowed content');
});

it('View releases a borrowed Region registration while retaining its existing child', () => {
  const root = document.createElement('section');
  document.body.append(root);
  const borrowed = new Region({ el: root });
  const child = new View({ template: () => '<p>Borrowed child</p>' });
  borrowed.show(child);
  const Failed = View.extend({
    regions: { borrowed },
    initialize() { throw new Error('view initialization failed'); }
  });
  expect(() => new Failed()).toThrow('view initialization failed');
  expect(borrowed.isDestroyed()).toBe(false);
  expect(borrowed.getOwner()).toBeUndefined();
  expect(borrowed.getName()).toBeUndefined();
  expect(borrowed.hasView()).toBe(true);
  expect(child.isDestroyed()).toBe(false);
  expect(root.textContent).toBe('Borrowed child');
  borrowed.destroy();
});

it('View releases a constructed Region even if registration fails before ownership is attached', () => {
  const channel = Radio.channel('constructor-rollback');
  const callback = vi.fn();
  let owned;
  const Owned = Region.extend({ initialize() { owned = this; this.listenTo(channel, 'ping', callback); } });
  const Failed = View.extend({
    regions: { child: { el: document.createElement('section'), regionClass: Owned } },
    onBeforeAddRegion() { throw new Error('registration failed'); }
  });
  expect(() => new Failed()).toThrow('registration failed');
  expect(owned.isDestroyed()).toBe(true);
  channel.trigger('ping');
  expect(callback).not.toHaveBeenCalled();
});

for (const [name, Base] of Object.entries({ View, CollectionView, Behavior })) {
  it(`${name} releases every acquired DOM handler when delegation and one cleanup both throw`, () => {
    const root = document.createElement('button');
    root.textContent = 'Borrowed content';
    document.body.append(root);
    const host = name === 'Behavior' ? new View({ el: root }) : undefined;
    const callback = vi.fn();
    const cleanups = [];
    const failure = new Error('delegation failed');
    const Failed = Base.extend({
      events: { click: callback, focus: callback, blur: callback },
      EventDelegator: {
        delegate({ eventName, handler }) {
          if (eventName === 'blur') { throw failure; }
          root.addEventListener(eventName, handler);
          return () => {
            cleanups.push(eventName);
            root.removeEventListener(eventName, handler);
            if (eventName === 'focus') { throw new Error('cleanup failed'); }
          };
        }
      }
    });
    let thrown;
    try { new Failed({ el: root }, host); } catch (error) { thrown = error; }
    expect(thrown).toBe(failure);
    expect(cleanups).toEqual(['focus', 'click']);
    root.dispatchEvent(new Event('click'));
    root.dispatchEvent(new Event('focus'));
    expect(callback).not.toHaveBeenCalled();
    expect(root.isConnected).toBe(true);
    host?.destroy();
  });
}

for (const [name, Base] of Object.entries({ View, CollectionView })) {
  it(`${name} disposes owned state after a later entity-binding error even when unsubscription throws`, () => {
    const state = {};
    const unsubscribe = vi.fn(() => { throw new Error('unsubscribe failed'); });
    const disposeOwned = vi.fn();
    const failure = new Error('entity binding failed');
    const Failed = Base.extend({
      State: { subscribe: () => unsubscribe, disposeOwned },
      createState() { return state; },
      stateEvents: { change() {} },
      modelEvents() { throw failure; }
    });
    let thrown;
    try { new Failed({ model: {} }); } catch (error) { thrown = error; }
    expect(thrown).toBe(failure);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(disposeOwned).toHaveBeenCalledExactlyOnceWith(state);
  });

  it(`${name} releases earlier Behaviors after a later Behavior constructor fails`, () => {
    const firstState = {};
    const secondState = {};
    const disposeFirst = vi.fn();
    const disposeSecond = vi.fn();
    const unsubscribe = vi.fn(() => { throw new Error('first Behavior unsubscribe failed'); });
    const ping = vi.fn();
    const failure = new Error('second Behavior initialization failed');
    let failedHost;
    const First = Behavior.extend({
      State: { subscribe: () => unsubscribe, disposeOwned: disposeFirst },
      createState() { return firstState; }, stateEvents: { change() {} }, onPing: ping,
      initialize() { failedHost = this.view; }
    });
    const Second = Behavior.extend({
      State: { disposeOwned: disposeSecond }, createState() { return secondState; },
      initialize() { this.getState(); throw failure; }
    });
    const Failed = Base.extend({ behaviors: [First, Second] });
    let thrown;
    try { new Failed(); } catch (error) { thrown = error; }
    expect(thrown).toBe(failure);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(disposeFirst).toHaveBeenCalledExactlyOnceWith(firstState);
    expect(disposeSecond).toHaveBeenCalledExactlyOnceWith(secondState);
    failedHost.trigger('ping');
    expect(ping).not.toHaveBeenCalled();
  });
}

it('CollectionView releases child Views added during initialization without removing its root', () => {
  const root = document.createElement('section');
  document.body.append(root);
  const first = new View({ template: () => '<p>First</p>' });
  const second = new View({ template: () => '<p>Second</p>' });
  const destroy = vi.fn();
  const Failed = CollectionView.extend({
    onBeforeDestroy: destroy, onDestroy: destroy,
    initialize() {
      this.addChildView(first);
      this.addChildView(second);
      throw new Error('collection initialization failed');
    }
  });
  expect(() => new Failed({ el: root })).toThrow('collection initialization failed');
  expect(first.isDestroyed()).toBe(true);
  expect(second.isDestroyed()).toBe(true);
  expect(root.isConnected).toBe(true);
  expect(root.childElementCount).toBe(0);
  expect(destroy).not.toHaveBeenCalled();
});

for (const [name, Base] of Object.entries({ Behavior, View, CollectionView })) {
  it(`${name} releases listeners acquired before DOM initialization when option defaults fail`, () => {
    const channel = Radio.channel('constructor-rollback');
    const callback = vi.fn();
    const failure = new Error('option defaults failed');
    const host = name === 'Behavior' ? new View() : undefined;
    const Failed = Base.extend({
      options() { this.listenTo(channel, 'ping', callback); throw failure; }
    });
    expect(() => new Failed({}, host)).toThrow(failure);
    channel.trigger('ping');
    expect(callback).not.toHaveBeenCalled();
    host?.destroy();
  });
}

it('Region does not repeat destruction explicitly completed by its initializer', () => {
  const destroy = vi.fn();
  const Failed = Region.extend({
    onDestroy: destroy,
    initialize() { this.destroy(); throw new Error('already destroyed'); }
  });
  expect(() => new Failed({ el: document.createElement('section') })).toThrow('already destroyed');
  expect(destroy).toHaveBeenCalledTimes(1);
});

for (const destroyBorrowed of [false, true]) {
  it(`View cleans its constructed Region and child${destroyBorrowed ? ' while a child cleanup destroys a borrowed Region' : ''}`, () => {
    const root = document.createElement('section');
    document.body.append(root);
    const borrowed = new Region({ el: document.createElement('aside') });
    const child = new View({ template: () => '<p>Owned child</p>' });
    if (destroyBorrowed) { child.on('destroy', () => borrowed.destroy()); }
    let owned;
    const failure = new Error('view initialization failed');
    const Failed = View.extend({
      regions: { owned: { el: root }, borrowed },
      initialize() { owned = this.getRegion('owned'); owned.show(child); throw failure; }
    });
    expect(() => new Failed()).toThrow(failure);
    expect(owned.isDestroyed()).toBe(true);
    expect(child.isDestroyed()).toBe(true);
    expect(root.isConnected).toBe(true);
    expect(borrowed.isDestroyed()).toBe(destroyBorrowed);
    expect(borrowed.getOwner()).toBeUndefined();
    borrowed.destroy();
  });
}

for (const [name, Base] of Object.entries({ View, CollectionView })) {
  it(`${name} releases host and Behavior entity subscriptions after a late initialization hook fails`, () => {
    const observers = new Set();
    const cleanup = vi.fn();
    const callback = vi.fn();
    const model = {};
    const subscribe = vi.fn((source, eventName, handler) => {
      expect(source).toBe(model);
      expect(eventName).toBe('change');
      observers.add(handler);
      return () => { observers.delete(handler); cleanup(); };
    });
    const failure = new Error('late Behavior initialization failed');
    const LateFailure = Behavior.extend({
      modelEvents: { change: callback },
      onInitialize() { throw failure; }
    });
    const Failed = Base.extend({
      Data: { subscribe }, modelEvents: { change: callback }, behaviors: [LateFailure]
    });
    expect(() => new Failed({ model })).toThrow(failure);
    expect(subscribe).toHaveBeenCalledTimes(2);
    expect(cleanup).toHaveBeenCalledTimes(2);
    for (const observer of observers) { observer(); }
    expect(callback).not.toHaveBeenCalled();
    expect(observers.size).toBe(0);
  });
}

it('Application releases child-App registrations without destroying borrowed child instances', async() => {
  const disposeOwned = vi.fn();
  const Borrowed = Application.extend({ State: { disposeOwned }, createState() { return {}; } });
  const first = new Borrowed();
  const second = new Borrowed();
  first.getState();
  second.getState();
  const failure = new Error('parent initialization failed');
  let failed;
  const Failed = Application.extend({
    initialize() {
      failed = this;
      this.addChildApp('first', first);
      this.addChildApp('second', second);
      throw failure;
    }
  });
  expect(() => new Failed()).toThrow(failure);
  expect(failed.getChildApps()).toEqual({});
  expect(first.isDestroyed()).toBe(false);
  expect(second.isDestroyed()).toBe(false);
  expect(disposeOwned).not.toHaveBeenCalled();
  const newOwner = new Application();
  expect(() => newOwner.addChildApp('first', first)).not.toThrow();
  expect(() => newOwner.addChildApp('second', second)).not.toThrow();
  await newOwner.destroy();
});
