import { afterEach, describe, expect, it } from 'vitest';
import { Application, Region, View } from 'marionette';
import { createGallery } from '@mnjs/test/playwright';
import { mountView } from '@mnjs/test';

const Card = View.extend({ template: () => '<input value="initial">' });
const galleries = [];
const roots = [];
function gallery(stories, options = {}) {
  const container = document.body.appendChild(document.createElement('section'));
  roots.push(container);
  const result = createGallery(stories, { container, ...options });
  galleries.push(result);
  return { gallery: result, container };
}
afterEach(async() => {
  try { await Promise.all(galleries.splice(0).map(item => item.unmount())); } finally {
    roots.splice(0).forEach(root => root.remove());
  }
});

describe('Playwright browser gallery lifecycle', () => {
  it('preserves absent props for optional story parameters and updates', async() => {
    const received = [];
    const capture = props => { received.push(props); if (props) { props.title.toUpperCase(); } };
    const { gallery: app } = gallery({ optional(props) { capture(props); return { update: capture }; } });
    await app.mount({ story: 'optional' });
    await app.mount({ story: 'optional', props: undefined });
    await app.mount({ story: 'optional', props: { title: 'Editor' } });
    expect(received).toEqual([undefined, undefined, { title: 'Editor' }]);
  });

  it.each(['context', 'gallery'])('publishes %s cleanup before reentrant destruction callbacks', async(target) => {
    const disposal = Promise.withResolvers();
    let context;
    let nested;
    const cleanup = () => target === 'context' ? context.cleanup() : app.unmount();
    const Reentrant = Card.extend({ onDestroy() { nested = cleanup(); } });
    const { gallery: app } = gallery({ editor(props, mounts) {
      context = mounts;
      mounts.mountView(new Reentrant());
      mounts.scope.defer(() => disposal.promise);
    } });
    await app.mount({ story: 'editor' });
    const outer = cleanup();
    try {
      expect(nested).toBe(outer);
      let settled = false;
      nested.then(() => { settled = true; });
      await Promise.resolve();
      await Promise.resolve();
      expect(settled).toBe(false);
    } finally {
      disposal.resolve();
      await outer;
    }
  });

  it('updates the existing instance and unmounts without destroying borrowed siblings', async() => {
    let mounted;
    const { gallery: app, container } = gallery({
      editor(props, mounts) {
        mounted = mounts.mountView(new Card(props));
        return { update(next) { mounted.el.dataset.title = next.title; } };
      }
    });
    const sibling = container.appendChild(document.createElement('p'));
    await app.mount({ story: 'editor', props: { title: 'first' } });
    const input = mounted.el.firstElementChild;
    input.value = 'draft';
    expect(mounted.el.parentElement).toBe(container);
    await app.mount({ story: 'editor', props: { title: 'next' } });
    expect(mounted.el.dataset.title).toBe('next');
    expect(mounted.el.firstElementChild).toBe(input);
    expect(input.value).toBe('draft');
    await app.unmount();
    await app.unmount();
    expect(mounted.view.isDestroyed()).toBe(true);
    expect([...container.children]).toEqual([sibling]);
  });

  it('awaits project disposal before another story factory runs', async() => {
    const disposal = Promise.withResolvers();
    const disposing = Promise.withResolvers();
    let second;
    let first;
    const { gallery: app } = gallery({
      first(props, mounts) {
        first = mounts.mountView(new Card());
        mounts.scope.defer(() => { disposing.resolve(); return disposal.promise; });
      },
      second(props, mounts) { second = mounts.mountView(new Card()); }
    });
    await app.mount({ story: 'first' });
    const replacing = app.mount({ story: 'second' });
    await disposing.promise;
    expect(first.view.isDestroyed()).toBe(true);
    expect(second).toBeUndefined();
    disposal.resolve();
    await replacing;
    expect(second.view.isAttached()).toBe(true);
  });

  it('starts a fresh story after replacement fails in project disposal without retrying that disposer', async() => {
    const failure = new Error('project close failed');
    const views = [];
    let attempts = 0;
    let updates = 0;
    let nextSetups = 0;
    const { gallery: app } = gallery({
      initial(props, mounts) {
        views.push(mounts.mountView(new Card()).view);
        if (views.length === 1) { mounts.scope.defer(() => { attempts++; throw failure; }); }
        return { update() { updates++; } };
      },
      next() { nextSetups++; }
    });
    await app.mount({ story: 'initial' });
    const error = await app.mount({ story: 'next' }).catch(value => value);
    expect(error.errors[0].errors[0]).toBe(failure);
    expect(views[0].isDestroyed()).toBe(true);
    expect(attempts).toBe(1);
    expect(nextSetups).toBe(0);
    await app.mount({ story: 'initial' });
    expect(views).toHaveLength(2);
    expect(views[1].isDestroyed()).toBe(false);
    expect(updates).toBe(0);
    expect(attempts).toBe(1);
  });

  it('treats the previous story as a fresh replacement while its disposal is pending', async() => {
    const disposal = Promise.withResolvers();
    const disposing = Promise.withResolvers();
    const views = [];
    let updates = 0;
    let nextSetups = 0;
    const { gallery: app } = gallery({
      initial(props, mounts) {
        views.push(mounts.mountView(new Card()).view);
        if (views.length === 1) { mounts.scope.defer(() => { disposing.resolve(); return disposal.promise; }); }
        return { update() { updates++; } };
      },
      next() { nextSetups++; }
    });
    await app.mount({ story: 'initial' });
    const replacing = app.mount({ story: 'next' }).catch(error => error);
    await disposing.promise;
    const remounting = app.mount({ story: 'initial' }).catch(error => error);
    try {
      expect(views[0].isDestroyed()).toBe(true);
      expect(views).toHaveLength(1);
      expect(nextSetups).toBe(0);
    } finally { disposal.resolve(); }
    const [obsolete, remounted] = await Promise.all([replacing, remounting]);
    expect(obsolete).toMatchObject({ message: 'Mount was replaced or cleaned up before setup completed.' });
    expect(remounted).toBeUndefined();
    expect(views).toHaveLength(2);
    expect(views[1].isDestroyed()).toBe(false);
    expect(updates).toBe(0);
    expect(nextSetups).toBe(0);
  });

  it('diagnoses unknown stories and missing updaters without losing the current mount', async() => {
    let mounted;
    const { gallery: app } = gallery({ static(props, mounts) { mounted = mounts.mountView(new Card()); } });
    await app.mount({ story: 'static' });
    await expect(app.mount({ story: 'toString' })).rejects.toThrow('Unknown story: toString');
    await expect(app.mount({ story: 'static' })).rejects.toThrow('Story has no update callback: static');
    expect(mounted.view.isDestroyed()).toBe(false);
  });

  it('propagates updater failures and retains ownership for teardown', async() => {
    const error = new Error('update failed');
    let view;
    const { gallery: app } = gallery({ editor(props, mounts) {
      view = mounts.mountView(new Card()).view;
      return { async update() { throw error; } };
    } });
    await app.mount({ story: 'editor' });
    await expect(app.mount({ story: 'editor', props: {} })).rejects.toBe(error);
    await app.unmount();
    expect(view.isDestroyed()).toBe(true);
  });

  it('rejects an update whose mount was destroyed while the updater awaited', async() => {
    const updating = Promise.withResolvers();
    const continued = Promise.withResolvers();
    const { gallery: app } = gallery({
      editor(props, mounts) {
        mounts.mountView(new Card());
        return { async update() { updating.resolve(); await continued.promise; } };
      }
    });
    await app.mount({ story: 'editor' });
    const update = app.mount({ story: 'editor', props: {} });
    await updating.promise;
    await app.unmount();
    continued.resolve();
    await expect(update).rejects.toThrow('Story was unmounted during update: editor');
  });

  it('cleans acquired resources on failed setup and preserves both setup and disposal errors', async() => {
    const failure = new Error('setup');
    const cleanupFailure = new Error('cleanup');
    let view;
    const { gallery: app, container } = gallery({
      broken(props, mounts) {
        view = mounts.mountView(new Card()).view;
        mounts.scope.defer(() => { throw cleanupFailure; });
        throw failure;
      }
    });
    const error = await app.mount({ story: 'broken' }).catch(value => value);
    expect(error).toBeInstanceOf(AggregateError);
    expect(error.message).toContain('setup');
    expect(error.message).toContain('cleanup');
    expect(error.errors[0]).toBe(failure);
    expect(error.errors[1].errors[0].errors).toEqual([cleanupFailure]);
    expect(view.isDestroyed()).toBe(true);
    expect(container.children).toHaveLength(0);
  });

  it('preserves a setup error when cleanup succeeds', async() => {
    const failure = new Error('setup');
    const { gallery: app } = gallery({ broken() { throw failure; } });
    await expect(app.mount({ story: 'broken' })).rejects.toBe(failure);
  });

  it('cancels pending startup immediately before a later asynchronous project disposer', async() => {
    const preparing = Promise.withResolvers();
    const started = Promise.withResolvers();
    const disposer = Promise.withResolvers();
    let signal;
    let mounts;
    let mounted;
    const Feature = Application.extend({ prepareStart(options, context) { signal = context.signal; return preparing.promise; } });
    const { gallery: app } = gallery({
      async pending(props, context) {
        mounts = context;
        mounted = context.mountApplication(region => new Feature({ region }));
        context.scope.defer(() => disposer.promise);
        started.resolve();
        await mounted.ready;
      }
    });
    const mounting = app.mount({ story: 'pending' });
    const failed = mounting.catch(error => error);
    await started.promise;
    const cleanup = app.unmount();
    expect(signal.aborted).toBe(true);
    expect(mounted.app.isDestroyed()).toBe(true);
    expect(() => mounts.mountView(new Card())).toThrow('Cannot mount after test cleanup begins');
    expect(() => mounts.mountApplication(() => new Application())).toThrow('Cannot mount after test cleanup begins');
    disposer.resolve();
    await cleanup;
    expect(await failed).toMatchObject({ message: 'Story was unmounted during setup: pending' });
    preparing.resolve();
    await expect(mounted.ready).resolves.toBe(false);
  });

  it('invalidates pending initial setup and its concurrent update on unmount', async() => {
    const setup = Promise.withResolvers();
    const began = Promise.withResolvers();
    const { gallery: app } = gallery({ async pending() { began.resolve(); return setup.promise; } });
    const mounting = app.mount({ story: 'pending' });
    await began.promise;
    const updating = app.mount({ story: 'pending' });
    const checked = Promise.all([mounting.catch(error => error), updating.catch(error => error)]);
    await app.unmount();
    setup.resolve({ update() { throw new Error('must not update'); } });
    for (const error of await checked) { expect(error).toMatchObject({ message: 'Story was unmounted during setup: pending' }); }
  });

  it('does not create an obsolete replacement while prior disposal is pending', async() => {
    const disposal = Promise.withResolvers();
    const began = Promise.withResolvers();
    let count = 0;
    const { gallery: app } = gallery({
      initial(props, mounts) { mounts.scope.defer(() => { began.resolve(); return disposal.promise; }); },
      next() { count++; }
    });
    await app.mount({ story: 'initial' });
    const next = app.mount({ story: 'next' });
    await began.promise;
    const canceled = next.catch(error => error);
    const cleanup = app.unmount();
    disposal.resolve();
    await cleanup;
    expect(await canceled).toMatchObject({ message: 'Mount was replaced or cleaned up before setup completed.' });
    expect(count).toBe(0);
  });

  it('reports mounted teardown errors while still releasing project resources', async() => {
    const failure = new Error('destroy');
    const actions = [];
    const Broken = Card.extend({ onBeforeDestroy() { throw failure; } });
    const { gallery: app, container } = gallery({
      broken(props, mounts) {
        mounts.mountView(new Broken());
        mounts.scope.defer(() => actions.push('project cleanup'));
      }
    });
    await app.mount({ story: 'broken' });
    const error = await app.unmount().catch(value => value);
    expect(error.message).toContain('destroy');
    expect(error.errors[0].errors).toEqual([failure]);
    expect(actions).toEqual(['project cleanup']);
    expect(container.children).toHaveLength(0);
  });

  it('awaits resources from a failed mount factory before rejecting story setup', async() => {
    const disposal = Promise.withResolvers();
    const began = Promise.withResolvers();
    const failure = new Error('mount factory');
    let released = false;
    let settled = false;
    const { gallery: app, container } = gallery({ broken(props, mounts) {
      mounts.mountView(scope => {
        scope.defer(async() => { began.resolve(); await disposal.promise; released = true; });
        throw failure;
      });
    } });
    const mounting = app.mount({ story: 'broken' }).catch(error => error);
    mounting.then(() => { settled = true; });
    await began.promise;
    await Promise.resolve();
    expect(settled).toBe(false);
    disposal.resolve();
    expect(await mounting).toBe(failure);
    expect(released).toBe(true);
    expect(container.children).toHaveLength(0);
  });

  it('combines a failed mount factory and its failed resource cleanup once', async() => {
    const failure = new Error('factory');
    const disposal = new Error('disposal');
    let attempts = 0;
    const { gallery: app, container } = gallery({ broken(props, mounts) {
      mounts.mountApplication((region, scope) => {
        scope.defer(async() => { attempts++; throw disposal; });
        throw failure;
      });
    } });
    const error = await app.mount({ story: 'broken' }).catch(value => value);
    expect(error.errors[0]).toBe(failure);
    expect(error.errors[1].errors[0].errors).toEqual([disposal]);
    expect(attempts).toBe(1);
    expect(container.children).toHaveLength(0);
  });


  it.each([false, true])('awaits direct neutral setup failure cleanup (disposal fails: %s)', async fails => {
    const failure = new Error('neutral factory');
    const disposal = new Error('neutral disposal');
    let released = false;
    const { gallery: app, container } = gallery({ broken() {
      mountView(scope => {
        scope.defer(async() => {
          await Promise.resolve();
          released = true;
          if (fails) { throw disposal; }
        });
        throw failure;
      });
    } });
    const error = await app.mount({ story: 'broken' }).catch(value => value);
    expect(released).toBe(true);
    expect(container.children).toHaveLength(0);
    if (fails) {
      expect(error.errors[0]).toBe(failure);
      expect(error.errors[1].errors).toEqual([disposal]);
    } else { expect(error).toBe(failure); }
  });


  it('preserves a throwing Region constructor and releases the surrounding story fixtures', async() => {
    const failure = new Error('Region constructor');
    let released = false;
    const BrokenRegion = Region.extend({ initialize() { throw failure; } });
    const { gallery: app, container } = gallery({ broken(props, mounts) {
      mounts.scope.defer(() => { released = true; });
      mounts.mountRegion({ regionClass: BrokenRegion });
    } });
    await expect(app.mount({ story: 'broken' })).rejects.toBe(failure);
    expect(released).toBe(true);
    expect(container.children).toHaveLength(0);
  });

  it('preserves a revoked Proxy rejection and releases acquired story fixtures', async() => {
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    let released = false;
    const { gallery: app } = gallery({ broken(props, mounts) {
      mounts.scope.defer(async() => { await Promise.resolve(); released = true; });
      throw proxy;
    } });
    const { error } = await app.mount({ story: 'broken' }).catch(value => ({ error: value }));
    expect(Object.is(error, proxy)).toBe(true);
    expect(released).toBe(true);
  });

});
