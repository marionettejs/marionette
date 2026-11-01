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
  it('owns destroy methods with their receiver and awaits them before earlier resources', async() => {
    const scope = createTestScope();
    const pending = Promise.withResolvers();
    const events = [];
    scope.defer(() => events.push('earlier'));
    const resource = { state: 'connected', async destroy() {
      events.push(this.state);
      await pending.promise;
      this.state = 'destroyed';
    } };
    expect(scope.own(resource)).toBe(resource);
    const closing = scope.cleanup();
    expect(events).toEqual(['connected']);
    expect(resource.state).toBe('connected');
    pending.resolve();
    await closing;
    expect(resource.state).toBe('destroyed');
    expect(events).toEqual(['connected', 'earlier']);
  });
  it('prefers cleanup over destroy when a resource offers both', async() => {
    const scope = createTestScope();
    const resource = {
      cleaned: false,
      cleanup() { this.cleaned = true; },
      destroy() { throw new Error('destroy must not run'); }
    };
    scope.own(resource);
    await scope.cleanup();
    expect(resource.cleaned).toBe(true);
  });
  it('destroys a resource with an undefined optional cleanup property', async() => {
    const scope = createTestScope();
    const resource = { cleanup: undefined, alive: true, destroy() { this.alive = false; } };
    scope.own(resource);
    await scope.cleanup();
    expect(resource.alive).toBe(false);
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
    scope.defer(() => events.push('first'));
    const resource = { async cleanup() { events.push('begin'); await pending.promise; return events.push('end'); } };
    expect(scope.own(resource)).toBe(resource);
    const cleanup = scope.cleanup();
    await Promise.resolve();
    expect(events).toEqual(['begin']);
    pending.resolve();
    await expect(cleanup).resolves.toBeUndefined();
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
    expect(reported.message).toBe('Test scope cleanup failed. [object Object]; first');
    expect(reported.errors).toHaveLength(2);
    expect(reported.errors[0]).toBe(second);
    expect(reported.errors[1]).toBe(first);
    await expect(scope.cleanup()).rejects.toBe(reported);
    expect(events).toEqual([2, 1]);
  });
  it('preserves user aggregates without flattening and tolerates unprintable thrown values', async() => {
    const scope = createTestScope();
    const nested = new AggregateError([new Error('private detail')], 'user summary');
    const opaque = { toString() { throw new Error('cannot stringify'); } };
    scope.defer(() => { throw opaque; });
    scope.defer(() => { throw nested; });
    const reported = await scope.cleanup().catch(error => error);
    expect(reported.message).toBe('Test scope cleanup failed. user summary; Unprintable thrown value');
    expect(reported.errors[0]).toBe(nested);
    expect(reported.errors[1]).toBe(opaque);
    expect(nested.errors[0].message).toBe('private detail');
  });
  it('retains disposer failures when an Error message cannot be converted to text', async() => {
    const scope = createTestScope();
    const first = new Error('other disposer');
    const second = new Error('original disposer');
    second.message = { toString() { throw new Error('message conversion failed'); } };
    scope.defer(() => { throw first; });
    scope.defer(() => { throw second; });
    const cleanup = scope.cleanup();
    const reported = await cleanup.catch(error => error);
    expect(reported).toBeInstanceOf(AggregateError);
    expect(reported.message).toBe('Test scope cleanup failed. Unprintable thrown value; other disposer');
    expect(reported.errors).toHaveLength(2);
    expect(reported.errors[0]).toBe(second);
    expect(reported.errors[1]).toBe(first);
    expect(scope.cleanup()).toBe(cleanup);
    await expect(scope.cleanup()).rejects.toBe(reported);
  });
  it('surfaces core teardown failure while removing the helper-owned host', async() => {
    const error = new Error('consumer teardown');
    const Broken = View.extend({ template: () => 'content', onBeforeDestroy() { throw error; } });
    const mounted = mountView(new Broken());
    const cleanup = mounted.cleanup();
    const reported = await cleanup.catch(value => value);
    expect(reported.errors).toHaveLength(1);
    expect(reported.errors[0]).toBe(error);
    expect(mounted.container.isConnected).toBe(false);
    expect(mounted.view.isDestroyed()).toBe(false);
    await expect(mounted.cleanup()).rejects.toBe(reported);
  });
});
