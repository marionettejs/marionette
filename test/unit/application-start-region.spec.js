import { afterEach, describe, expect, it, vi } from 'vitest';
import { Application, Region, View, createMarionette } from 'marionette';

const applications = [];
const regions = [];

function makeRegion() {
  const region = new Region({ el: document.createElement('div') });
  regions.push(region);
  return region;
}

function makeApplication(methods, options) {
  const application = new (Application.extend(methods))(options);
  applications.push(application);
  return application;
}

afterEach(async() => {
  for (const application of applications.splice(0)) { await application.destroy(); }
  for (const region of regions.splice(0)) {
    if (!region.isDestroyed()) { region.destroy(); }
  }
});

describe('Application start Region binding', () => {
  it('binds before startup notifications and forwards the complete options object', async() => {
    const region = makeRegion();
    const options = { region, source: 'layout' };
    const calls = [];
    const application = makeApplication({
      onBeforeStart(app, received) {
        calls.push(['before', app.getRegion(), received]);
      },
      prepareStart(received) {
        calls.push(['prepare', this.getRegion(), received]);
      }
    });

    await application.start(options);

    expect(application.getRegion()).toBe(region);
    expect(calls).toEqual([
      ['before', application.getRegion(), options],
      ['prepare', application.getRegion(), options]
    ]);
  });

  it('lets a registered child bind the newly created Region on each parent start', async() => {
    const childRegions = [];
    const child = makeApplication();
    const parent = makeApplication({
      onBeforeStart() {
        childRegions.push(makeRegion());
      },
      prepareStart() {
        return child.start({ region: childRegions.at(-1) });
      }
    });
    parent.addChildApp('child', child);

    await parent.start();
    const first = child.getRegion();
    await parent.stop();
    await parent.start();

    expect(child.getRegion()).not.toBe(first);
    expect(child.getRegion()).toBe(childRegions[1]);
    expect(child.isRunning()).toBe(true);
  });

  it('ignores new start options while running and preserves the current host', async() => {
    const first = makeRegion();
    const second = makeRegion();
    const application = makeApplication({ region: first });
    await application.start();

    expect(await application.start({ region: second })).toBe(true);
    expect(application.getRegion()).toBe(first);
  });

  it('joins pending startup regardless of later options', async() => {
    const first = makeRegion();
    const second = makeRegion();
    const ready = Promise.withResolvers();
    const application = makeApplication({ prepareStart: () => ready.promise });
    const started = application.start({ region: first, source: 'first' });
    const joined = application.start({ region: first, source: 'same-region' });

    expect(joined).toBe(started);
    expect(application.start({ region: second })).toBe(started);
    expect(application.getRegion()).toBe(first);
    ready.resolve();
    await expect(started).resolves.toBe(true);
  });

  it('retains the current host for missing or undefined Region options', async() => {
    const definition = { el: document.createElement('div') };
    const application = makeApplication({ region: definition });
    const current = application.getRegion();

    await application.start({ region: undefined });
    expect(application.getRegion()).toBe(current);
    await application.stop();
    await application.start();
    expect(application.getRegion()).toBe(current);
  });

  it('does not destroy a borrowed Region and destroys a constructed Region', async() => {
    const borrowed = makeRegion();
    const borrowedDestroy = vi.spyOn(borrowed, 'destroy');
    const application = makeApplication();
    await application.start({ region: borrowed });
    await application.destroy();
    expect(borrowedDestroy).not.toHaveBeenCalled();
    expect(borrowed.isDestroyed()).toBe(false);

    const owned = makeRegion();
    const ownedApplication = makeApplication({ region: { el: owned.el } });
    await ownedApplication.start();
    const constructed = ownedApplication.getRegion();
    const constructedDestroy = vi.spyOn(constructed, 'destroy');
    await ownedApplication.destroy();
    expect(constructedDestroy).toHaveBeenCalledTimes(1);
  });

  it('leaves the new host bound when startup readiness rejects', async() => {
    const next = makeRegion();
    const error = new Error('not ready');
    const application = makeApplication({ prepareStart: () => Promise.reject(error) });

    await expect(application.start({ region: next })).rejects.toBe(error);
    expect(application.getRegion()).toBe(next);
    expect(application.isRunning()).toBe(false);
  });

  it('keeps a prepared root while rebinding a stopped displayed root', async() => {
    const first = makeRegion();
    const second = makeRegion();
    const application = makeApplication({ region: first });
    const displayed = new View({ template: () => '<p>Displayed</p>' });
    const prepared = new View({ template: () => '<p>Prepared</p>' });
    application.showView(displayed);
    application.setView(prepared);

    await application.start({ region: second });

    expect(displayed.isDestroyed()).toBe(true);
    expect(prepared.isDestroyed()).toBe(false);
    expect(application.getRegion()).toBe(second);
    expect(application.getView()).toBe(prepared);
    application.showView();
    expect(second.currentView).toBe(prepared);
    expect(first.currentView).toBeUndefined();
  });

  it('preserves unrelated content in the previous borrowed host while rebinding', async() => {
    const first = makeRegion();
    const second = makeRegion();
    const application = makeApplication({ region: first });
    const other = makeApplication({ region: first });
    const replacement = new View({ template: () => '<p>Other feature</p>' });
    other.showView(replacement);

    await application.start({ region: second });

    expect(first.currentView).toBe(replacement);
    expect(replacement.isDestroyed()).toBe(false);
    expect(other.getView()).toBe(replacement);
  });

  it('disposes a constructor-owned host when replacing it with a borrowed host', async() => {
    const borrowed = makeRegion();
    const configuration = { el: document.createElement('div') };
    const application = makeApplication({ region: configuration });
    await application.start();
    const owned = application.getRegion();
    const ownedDestroy = vi.spyOn(owned, 'destroy');
    const borrowedDestroy = vi.spyOn(borrowed, 'destroy');

    await application.stop();
    await application.start({ region: borrowed });
    expect(ownedDestroy).toHaveBeenCalledTimes(1);
    expect(application.region).toBe(configuration);
    expect(borrowedDestroy).not.toHaveBeenCalled();

    await application.stop();
    await application.start({ region: makeRegion() });
    expect(borrowedDestroy).not.toHaveBeenCalled();
    await application.destroy();
  });

  it('reuses the same instance for running and in-flight starts', async() => {
    const region = makeRegion();
    const application = makeApplication({ prepareStart: () => Promise.resolve() });
    await application.start({ region });
    const host = application.getRegion();

    expect(await application.start({ region })).toBe(true);
    expect(application.getRegion()).toBe(host);
    await application.stop();

    const ready = Promise.withResolvers();
    application.prepareStart = () => ready.promise;
    const first = application.start({ region });
    const joined = application.start({ region });
    expect(joined).toBe(first);
    ready.resolve();
    await first;
    expect(application.getRegion()).toBe(host);
  });

  it('retains the host when restart supersedes an unfinished start', async() => {
    const first = makeRegion();
    const pending = Promise.withResolvers();
    let firstSignal;
    const application = makeApplication({
      prepareStart({ source }, { signal }) {
        if (source === 'retry') { return; }
        firstSignal = signal;
        return pending.promise;
      }
    });
    const started = application.start({ region: first });
    const other = makeRegion();
    const restarted = application.restart({ region: other, source: 'retry' });
    expect(other.hasView()).toBe(false);

    await expect(started).resolves.toBe(false);
    await expect(restarted).resolves.toBe(true);
    expect(firstSignal.aborted).toBe(true);
    expect(application.getRegion()).toBe(first);
    pending.resolve();
  });

  it('does not revive an Application destroyed during old root teardown', async() => {
    const application = makeApplication({ region: { el: document.createElement('div') } });
    const next = makeRegion();
    const view = new View({ template: false });
    let destroyed;
    view.once('before:destroy', () => { destroyed = application.destroy(); });
    application.showView(view);

    await expect(application.start({ region: next })).resolves.toBe(false);
    expect(destroyed).toBe(true);
    expect(application.isDestroyed()).toBe(true);
    expect(application.getRegion()).toBeUndefined();
    expect(next.isDestroyed()).toBe(false);
  });

  it('keeps start idempotent during retained restart readiness', async() => {
    const first = makeRegion();
    const third = makeRegion();
    const entered = Promise.withResolvers();
    const ready = Promise.withResolvers();
    const application = makeApplication({ region: first });
    await application.start();
    application.prepareStart = () => {
      entered.resolve();
      return ready.promise;
    };

    const restarted = application.restart();
    await entered.promise;
    expect(await application.start({ region: third })).toBe(true);
    expect(application.getRegion()).toBe(first);
    ready.resolve();
    await expect(restarted).resolves.toBe(true);
  });

  it('accepts the constructor-owned host instance during startup', async() => {
    const ready = Promise.withResolvers();
    const application = makeApplication({ region: { el: document.createElement('div') }, prepareStart: () => ready.promise });
    const started = application.start();

    const host = application.getRegion();
    expect(application.start({ region: host })).toBe(started);
    ready.resolve();
    await expect(started).resolves.toBe(true);
    await application.destroy();
    expect(host.isDestroyed()).toBe(true);
  });

  it('rejects a Region from another Marionette runtime', async() => {
    const otherRuntime = createMarionette();
    const foreign = new otherRuntime.Region({ el: document.createElement('div') });
    const application = makeApplication({ region: { el: document.createElement('div') } });
    const current = application.getRegion();
    const displayed = new View({ template: false });
    application.showView(displayed);

    await expect(application.start({ region: foreign })).rejects.toMatchObject({ code: 'MN0030' });
    expect(application.getRegion()).toBe(current);
    expect(current.currentView).toBe(displayed);
    expect(displayed.isDestroyed()).toBe(false);
    foreign.destroy();
  });
});
