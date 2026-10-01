import { afterEach, describe, expect, it, vi } from 'vitest';
import { Application, View, Region, MnObject } from 'marionette';

const apps = [];
function make(properties = {}, options) {
  const app = new (Application.extend(properties))(options);
  apps.push(app);
  return app;
}
afterEach(() => { apps.splice(0).forEach(app => app.destroy()); });

describe('synchronous Application destruction', () => {
  it('stops live children before notification and destroys them in registration order', async() => {
    const calls = [];
    const options = { source: 'owner' };
    const app = make({
      onBeforeDestroy() {
        expect(first.isRunning()).toBe(false);
        expect(second.isRunning()).toBe(false);
        expect(first.isDestroyed()).toBe(false);
        calls.push('owner:before');
      },
      onDestroy() { expect(this.getChildApps()).toEqual({}); calls.push('owner:destroy'); }
    });
    const Child = Application.extend({
      onStop(owner, supplied) { expect(supplied).toBe(options); calls.push(`${this.getName()}:stop`); },
      onDestroy(owner, supplied) { expect(supplied).toBe(options); expect(this.getName()).toBeUndefined(); }
    });
    const first = app.addChildApp('10', new Child());
    const second = app.addChildApp('2', new Child());
    first.on('destroy', () => calls.push('first:destroy'));
    second.on('destroy', () => calls.push('second:destroy'));
    await app.start();
    await first.start();
    await second.start();
    expect(app.destroy(options)).toBe(true);
    expect(calls).toEqual(['10:stop', '2:stop', 'owner:before', 'first:destroy', 'second:destroy', 'owner:destroy']);
    expect(first.isDestroyed()).toBe(true);
    expect(second.isDestroyed()).toBe(true);
    expect(app.isDestroyed()).toBe(true);
    expect(app.destroy()).toBe(true);
    expect(calls).toHaveLength(6);
  });

  for (const operation of ['start', 'restart']) {
    it(`cancels pending ${operation} and destroys UI before returning`, async() => {
      const ready = Promise.withResolvers();
      let signal;
      const completion = vi.fn();
      const app = make({
        prepareStart(options, context) { if (options?.hold) { signal = context.signal; return ready.promise; } },
        onStart: completion
      }, { region: { el: document.createElement('main') } });
      if (operation === 'restart') { await app.start(); }
      const root = app.showView(new View({ template: false }));
      const pending = app[operation]({ hold: true });
      expect(app.destroy()).toBe(true);
      expect(signal.aborted).toBe(true);
      expect(root.isDestroyed()).toBe(true);
      expect(app.isDestroyed()).toBe(true);
      expect(await pending).toBe(false);
      const completed = completion.mock.calls.length;
      ready.resolve();
      await ready.promise;
      expect(completion).toHaveBeenCalledTimes(completed);
    });
  }

  it('preserves terminal ownership during notification reentry', async() => {
    const lateView = new View({ template: false });
    const lateChild = new Application();
    const attempts = [];
    const app = make({ onBeforeDestroy() {
      expect(this.destroy()).toBe(true);
      expect(this.stop()).toBe(true);
      attempts.push(this.start(), this.restart());
      expect(this.setView(lateView)).toBe(lateView);
      expect(this.addChildApp('late', lateChild)).toBe(lateChild);
      expect(this.hasChildApp('late')).toBe(false);
    } });
    expect(app.destroy()).toBe(true);
    expect(await Promise.all(attempts)).toEqual([false, false]);
    expect(lateView.isDestroyed()).toBe(false);
    expect(lateChild.getName()).toBeUndefined();
    lateView.destroy();
    lateChild.destroy();
  });

  it('does not register a child while that child is destroying', () => {
    const owner = make();
    const child = make({ onBeforeDestroy() {
      expect(owner.addChildApp('child', this)).toBe(this);
      expect(owner.hasChildApp('child')).toBe(false);
    } });
    expect(child.destroy()).toBe(true);
    expect(owner.addChildApp('child', child)).toBe(child);
    expect(owner.hasChildApp('child')).toBe(false);
  });


  it('blocks child activation throughout terminal destruction', async() => {
    const attempts = [];
    const app = make({
      onBeforeDestroy() { attempts.push(child.start(), child.restart()); },
      onDestroy() { attempts.push(child.start(), child.restart()); }
    });
    const child = app.addChildApp('child', new Application());
    await child.start();
    expect(app.destroy()).toBe(true);
    expect(await Promise.all(attempts)).toEqual([false, false, false, false]);
    expect(child.isRunning()).toBe(false);
    expect(child.isDestroyed()).toBe(true);
  });

  it('retains completed startup success when its notification destroys the Application', async() => {
    const app = make({ onStart() { expect(this.destroy()).toBe(true); } });
    expect(await app.start()).toBe(true);
    expect(app.isDestroyed()).toBe(true);
    expect(app.isRunning()).toBe(false);
  });

  it('ignores obsolete preparation rejection after destruction', async() => {
    const ready = Promise.withResolvers();
    const completed = vi.fn();
    const app = make({ prepareStart() { return ready.promise; }, onStart: completed });
    const pending = app.start();
    expect(app.destroy()).toBe(true);
    ready.reject(new Error('obsolete readiness'));
    expect(await pending).toBe(false);
    await Promise.resolve();
    expect(app.isDestroyed()).toBe(true);
    expect(completed).not.toHaveBeenCalled();
  });

  for (const hook of ['onBeforeStop', 'onStop']) {
    it(`completes destruction requested from ${hook}`, async() => {
      const calls = [];
      let destroyed = false;
      const app = make({
        onBeforeStop() { calls.push('before:stop'); if (hook === 'onBeforeStop') {finish(this);} },
        onStop() { calls.push('stop'); if (hook === 'onStop') {finish(this);} },
        onBeforeDestroy() {
          expect(child.isRunning()).toBe(false);
          expect(child.isDestroyed()).toBe(false);
          expect(root.isDestroyed()).toBe(true);
          expect(this.getRegion().hasView()).toBe(false);
          calls.push('before:destroy');
        },
        onDestroy() { calls.push('destroy'); }
      }, { region: { el: document.createElement('main') } });
      const child = app.addChildApp('child', make());
      const root = app.showView(new View({ template: false }));
      function finish(owner) { if (!destroyed) { destroyed = true; expect(owner.destroy()).toBe(true); } }
      await app.start();
      await child.start();
      expect(app.stop()).toBe(true);
      expect(calls).toEqual(hook === 'onBeforeStop' ?
        ['before:stop', 'before:destroy', 'destroy'] :
        ['before:stop', 'stop', 'before:destroy', 'destroy']);
      expect(app.isDestroyed()).toBe(true);
      expect(child.isDestroyed()).toBe(true);
    });
  }

  it('destroys an already stopped owner without repeating stop notifications', () => {
    const stopped = vi.fn();
    const destroyed = vi.fn();
    const app = make({ onBeforeStop: stopped, onStop: stopped, onBeforeDestroy: destroyed, onDestroy: destroyed });
    expect(app.destroy()).toBe(true);
    expect(stopped).not.toHaveBeenCalled();
    expect(destroyed).toHaveBeenCalledTimes(2);
  });

  it('returns a removed child synchronously and clears its ownership', () => {
    const owner = make();
    const child = owner.addChildApp('child', new Application());
    expect(owner.removeChildApp('child')).toBe(child);
    expect(child.isDestroyed()).toBe(true);
    expect(child.getName()).toBeUndefined();
    expect(owner.getChildApps()).toEqual({});
    expect(owner.removeChildApp('missing')).toBeUndefined();
  });

  it('destroys owned Regions and releases borrowed Regions synchronously', () => {
    const owned = make({}, { region: { el: document.createElement('main') } });
    const ownedRegion = owned.getRegion();
    const ownedRoot = owned.showView(new View({ template: false }));
    const borrowedRegion = new Region({ el: document.createElement('main') });
    const borrowed = make({}, { region: borrowedRegion });
    const borrowedRoot = borrowed.showView(new View({ template: false }));
    expect(owned.destroy()).toBe(true);
    expect(borrowed.destroy()).toBe(true);
    expect(ownedRoot.isDestroyed()).toBe(true);
    expect(borrowedRoot.isDestroyed()).toBe(true);
    expect(ownedRegion.isDestroyed()).toBe(true);
    expect(borrowedRegion.isDestroyed()).toBe(false);
    expect(owned.getRegion()).toBeUndefined();
    expect(borrowed.getRegion()).toBeUndefined();
    borrowedRegion.destroy();
  });

  it('releases listener subscriptions before returning', () => {
    const app = make();
    const observer = new MnObject();
    const callback = vi.fn();
    observer.listenTo(app, 'change', callback);
    expect(app.destroy()).toBe(true);
    app.trigger('change');
    expect(callback).not.toHaveBeenCalled();
    observer.destroy();
  });

  it('ignores notification promises and throws synchronous failures', () => {
    const notification = Promise.withResolvers();
    const completed = vi.fn();
    const app = make({ onBeforeDestroy() { return notification.promise; }, onDestroy: completed });
    expect(app.destroy()).toBe(true);
    expect(completed).toHaveBeenCalledTimes(1);
    notification.resolve();
    const error = new Error('teardown failed');
    const failed = make({ onBeforeDestroy() { throw error; } });
    expect(() => failed.destroy()).toThrow(error);
  });
});
