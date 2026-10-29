import { describe, expect, it } from 'vitest';
import { test } from '@mnjs/test/vitest';
import { Application, Region, View } from 'marionette';
import { MountError, mountApplication, mountRegion, mountView } from '@mnjs/test';

const Card = View.extend({ template: () => '<p>Owned</p>' });

describe('Region and nested mount resource ownership', () => {
  it('owns replacement Views, the Region and fixture DOM while preserving borrowed siblings', async() => {
    const host = document.body.appendChild(document.createElement('section'));
    const sibling = host.appendChild(document.createElement('p'));
    const mounted = mountRegion({ container: host, replaceElement: true });
    const first = new Card();
    const last = new Card();
    mounted.region.show(first);
    expect(mounted.el).toBe(first.el);
    mounted.region.show(last);
    expect(first.isDestroyed()).toBe(true);
    expect(mounted.el).toBe(last.el);
    expect(mounted.cleanup).toBe(mounted.scope.cleanup);
    await mounted.scope.cleanup();
    expect(last.isDestroyed()).toBe(true);
    expect(mounted.region.isDestroyed()).toBe(true);
    expect([...host.children]).toEqual([sibling]);
    expect(mounted.el).toBeUndefined();
    host.remove();
  });

  it('finishes nested services before destroying a manual shell', async() => {
    const events = [];
    const pending = Promise.withResolvers();
    const Feature = Application.extend({ onBeforeDestroy() { events.push('application'); } });
    let factoryScope;
    const mounted = mountApplication((region, scope) => {
      factoryScope = scope;
      scope.defer(() => events.push('factory service'));
      return new Feature({ region });
    }, { start: false });
    mounted.app.showView(new Card());
    mounted.scope.own({ async cleanup() {
      expect(mounted.app.isDestroyed()).toBe(false);
      expect(mounted.el.isConnected).toBe(true);
      events.push('late service begin');
      await pending.promise;
      events.push('late service end');
    } });
    expect(mounted.scope).toBe(factoryScope);
    const cleanup = mounted.cleanup();
    expect(mounted.scope.cleanup()).toBe(cleanup);
    expect(events).toEqual(['late service begin']);
    pending.resolve();
    await cleanup;
    expect(events).toEqual(['late service begin', 'late service end', 'factory service', 'application']);
    expect(mounted.region.isDestroyed()).toBe(true);
    expect(mounted.container.isConnected).toBe(false);
  });

  it('documents early cancellation destroying prepared UI before pending-start services', async() => {
    const events = [];
    let signal;
    const Prepared = Card.extend({ onDestroy() { events.push('prepared UI'); } });
    const Feature = Application.extend({
      prepareStart(options, context) {
        signal = context.signal;
        this.setView(new Prepared());
        return new Promise(() => {});
      },
      onBeforeDestroy() { events.push('application'); }
    });
    const mounted = mountApplication(() => new Feature());
    mounted.scope.defer(async() => {
      expect(signal.aborted).toBe(true);
      expect(mounted.app.isDestroyed()).toBe(false);
      events.push('service');
    });
    await mounted.cleanup();
    await expect(mounted.ready).resolves.toBe(false);
    expect(events).toEqual(['prepared UI', 'service', 'application']);
  });

  it('does not retry core teardown after pending-start stop fails', async() => {
    let stops = 0;
    let destroys = 0;
    const failure = new Error('stop callback');
    const Feature = Application.extend({
      prepareStart() { return new Promise(() => {}); },
      onBeforeStop() { stops++; throw failure; },
      onBeforeDestroy() { destroys++; }
    });
    const mounted = mountApplication(() => new Feature());
    await expect(mounted.cleanup()).rejects.toMatchObject({ errors: [failure] });
    await expect(mounted.ready).resolves.toBe(false);
    expect(stops).toBe(1);
    expect(destroys).toBe(0);
    expect(mounted.container.isConnected).toBe(false);
  });

  it('reports a factory failure and awaits cleanup of resources acquired before throwing', async() => {
    const events = [];
    const failure = new Error('factory');
    let region;
    let reported;
    try {
      mountApplication((ownedRegion, scope) => {
        region = ownedRegion;
        scope.defer(async() => { await Promise.resolve(); events.push('service'); });
        throw failure;
      });
    } catch (error) { reported = error; }
    expect(reported).toBeInstanceOf(MountError);
    expect(reported.cause).toBe(failure);
    await reported.cleanup;
    expect(events).toEqual(['service']);
    expect(region.isDestroyed()).toBe(true);
  });

  it('keeps original and asynchronous cleanup failures observable together', async() => {
    const failure = new Error('factory');
    const disposal = new Error('async disposer');
    let reported;
    try {
      mountView(scope => {
        scope.defer(async() => { await Promise.resolve(); throw disposal; });
        throw failure;
      });
    } catch (error) { reported = error; }
    const combined = await reported.cleanup.catch(error => error);
    expect(combined.errors[0]).toBe(failure);
    expect(combined.errors[1].errors).toEqual([disposal]);
  });

  it('destroys a factory View only after this Region acquires it', async() => {
    let view;
    const failure = new Error('render');
    const Broken = Card.extend({ onBeforeRender() { throw failure; } });
    let reported;
    try { mountView(() => (view = new Broken())); } catch (error) { reported = error; }
    await reported.cleanup;
    expect(view.isDestroyed()).toBe(true);
    const other = mountRegion();
    const foreign = new Card();
    other.region.show(foreign);
    try { mountView(() => foreign); } catch (error) { reported = error; }
    await reported.cleanup;
    expect(foreign.isDestroyed()).toBe(false);
    expect(other.region.currentView).toBe(foreign);
    await other.cleanup();
  });

  it('does not destroy an unknown Application whose factory never returns it', async() => {
    let caller;
    let reported;
    try { mountApplication(() => { caller = new Application(); throw new Error('before return'); }); } catch (error) { reported = error; }
    await reported.cleanup;
    expect(caller.isDestroyed()).toBe(false);
    caller.destroy();
  });

  it('keeps a failed caller View alive and reports detachment failure without destructive retry', async() => {
    const render = new Error('attach');
    const detach = new Error('detach');
    let destroys = 0;
    const Broken = Card.extend({
      onAttach() { throw render; },
      onBeforeDetach() { throw detach; },
      onBeforeDestroy() { destroys++; }
    });
    const caller = new Broken();
    let reported;
    try { mountView(caller); } catch (error) { reported = error; }
    const combined = await reported.cleanup.catch(error => error);
    expect(combined.errors[0]).toBe(render);
    expect(combined.errors[1].errors).toEqual([detach]);
    expect(destroys).toBe(0);
    expect(caller.isDestroyed()).toBe(false);
    // Unsupported lifecycle callbacks remain caller responsibility after reporting.
  });

  it('can clean a custom Region without a mounted View', async() => {
    let destroys = 0;
    const Custom = Region.extend({ onDestroy() { destroys++; } });
    const mounted = mountRegion({ attachTo: null, regionClass: Custom });
    await mounted.cleanup();
    await mounted.cleanup();
    expect(destroys).toBe(1);
    expect(mounted.slot.parentNode).toBe(null);
  });

  test('the Vitest context owns Region mounts and rejects them after teardown begins', async({ mounts }) => {
    const mounted = mounts.mountRegion();
    mounted.region.show(new Card());
    await mounts.cleanup();
    expect(mounted.region.isDestroyed()).toBe(true);
    expect(() => mounts.mountRegion()).toThrow('Cannot mount after test cleanup begins');
  });

});
