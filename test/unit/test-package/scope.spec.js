import { describe, expect, it } from 'vitest';
import { createTestScope, mountApplication, mountView } from '@mnjs/test';
import { Application, Region, View } from 'marionette';

describe('explicit owned-resource scope', () => {
  it('preserves the resource receiver for owned cleanup methods', async() => {
    const scope = createTestScope();
    const resource = {
      connected: true,
      cleanup() { this.connected = false; }
    };
    expect(scope.own(resource)).toBe(resource);
    await scope.cleanup();
    expect(resource.connected).toBe(false);
  });
  it('does not retry a Region teardown aborted by Application destruction', async() => {
    const error = new Error('empty failed');
    let attempts = 0;
    const BrokenRegion = Region.extend({ onBeforeEmpty() { attempts++; throw error; } });
    const Feature = Application.extend({ onStart() { this.showView(new View({ template: () => 'content' })); } });
    const mounted = mountApplication(() => new Feature(), { regionClass: BrokenRegion });
    await mounted.ready;
    await expect(mounted.cleanup()).rejects.toMatchObject({ errors: [error] });
    expect(attempts).toBe(1);
    expect(mounted.container.isConnected).toBe(false);
    expect(mounted.app.isDestroyed()).toBe(false);
  });
  it('cleans an empty scope once', async() => {
    const scope = createTestScope();
    const cleanup = scope.cleanup();
    expect(scope.cleanup()).toBe(cleanup);
    await expect(cleanup).resolves.toBeUndefined();
    expect(() => scope.defer(() => {})).toThrow('Cannot register');
    expect(() => scope.own({ cleanup() {} })).toThrow('Cannot register');
  });
  it('awaits each disposer in reverse registration order', async() => {
    const scope = createTestScope();
    const events = [];
    const pending = Promise.withResolvers();
    scope.defer(() => { events.push('first'); });
    const resource = { async cleanup() { events.push('begin'); await pending.promise; events.push('end'); } };
    expect(scope.own(resource)).toBe(resource);
    const cleanup = scope.cleanup();
    await Promise.resolve();
    expect(events).toEqual(['begin']);
    pending.resolve();
    await cleanup;
    expect(events).toEqual(['begin', 'end', 'first']);
  });
  it('rejects reentrant registration and shares completion during cleanup', async() => {
    const scope = createTestScope();
    let nested;
    scope.defer(() => {
      nested = scope.cleanup();
      expect(() => scope.defer(() => {})).toThrow('Cannot register');
    });
    const cleanup = scope.cleanup();
    await cleanup;
    expect(nested).toBe(cleanup);
  });
  it('reports every failed registered disposer without retrying partial resources', async() => {
    const scope = createTestScope();
    const events = [];
    const first = new TypeError('first');
    const second = Object.freeze({ failure: 'second' });
    scope.defer(() => { events.push(1); throw first; });
    scope.defer(async() => { events.push(2); throw second; });
    const cleanup = scope.cleanup();
    const reported = await cleanup.catch(error => error);
    expect(reported).toBeInstanceOf(AggregateError);
    expect(reported.errors).toHaveLength(2);
    expect(reported.errors[0]).toBe(second);
    expect(reported.errors[1]).toBe(first);
    await expect(scope.cleanup()).rejects.toBe(reported);
    expect(events).toEqual([2, 1]);
  });
  it('surfaces core teardown failure while removing the helper-owned host', async() => {
    const error = new Error('consumer teardown');
    const Broken = View.extend({ template: () => 'content', onBeforeDestroy() { throw error; } });
    const mounted = mountView(new Broken());
    const cleanup = mounted.cleanup();
    await expect(cleanup).rejects.toMatchObject({ errors: [error] });
    expect(mounted.container.isConnected).toBe(false);
    expect(mounted.view.isDestroyed()).toBe(false);
    await expect(mounted.cleanup()).rejects.toMatchObject({ errors: [error] });
  });
});
