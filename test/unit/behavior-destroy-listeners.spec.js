import { describe, expect, it, vi } from 'vitest';
import { Behavior, CollectionView, View } from 'marionette';
import { Events } from '@mnjs/utils';

const createEmitter = () => Object.assign({}, Events);

describe('Behavior destruction releases incoming listeners', function() {
  it('cleans direct destruction without emitting an independent destroy notification', function() {
    const host = new View();
    const behavior = new Behavior({}, host);
    const listeners = [createEmitter(), createEmitter()];
    const other = createEmitter();
    const callback = vi.fn();
    const otherCallback = vi.fn();
    const onDestroy = vi.fn();
    behavior.on('destroy', onDestroy);
    behavior.on('event', callback);
    behavior.once('event', callback);
    behavior.listenTo(behavior, 'event', callback);
    listeners.forEach(listener => {
      listener.listenTo(behavior, 'event', callback);
      listener.listenToOnce(behavior, 'once', callback);
      listener.listenTo(other, 'event', otherCallback);
    });

    expect(behavior.destroy()).toBe(behavior);
    expect(behavior.destroy()).toBe(behavior);
    behavior.trigger('event');
    behavior.trigger('once');
    expect(callback).not.toHaveBeenCalled();
    expect(onDestroy).not.toHaveBeenCalled();
    const off = vi.spyOn(behavior, 'off');
    listeners.forEach(listener => listener.stopListening(behavior));
    expect(off).not.toHaveBeenCalled();
    other.trigger('event');
    expect(otherCallback).toHaveBeenCalledTimes(2);

    off.mockRestore();
    listeners.forEach(listener => listener.stopListening());
    host.destroy();
  });

  [View, CollectionView].forEach(Host => {
    it(`preserves final host and nested Behavior delivery for ${Host === View ? 'View' : 'CollectionView'}`, function() {
      const calls = [];
      const instances = [];
      const listeners = [createEmitter(), createEmitter()];
      const lateCallback = vi.fn();
      const destroyOptions = { reason: 'complete' };
      function defineBehavior(name, properties = {}) {
        return Behavior.extend({
          ...properties,
          initialize() {
            instances.push(this);
            this.on('destroy', (host, options) => {
              calls.push([name, 'event', host, options]);
              // Reentrant destruction must retain the pending final observers.
              this.destroy();
              listeners[0].listenTo(this, 'late', lateCallback);
              this.once('late', lateCallback);
            });
            this.on('all', (event, host, options) => {
              if (event === 'destroy') { calls.push([name, 'all', host, options]); }
            });
            listeners.forEach(listener => {
              listener.listenTo(this, 'event', lateCallback);
              listener.listenToOnce(this, 'once', lateCallback);
            });
          },
          onDestroy(host, options) { calls.push([name, 'method', host, options]); }
        });
      }
      const host = new Host({
        behaviors: [defineBehavior('outer', { behaviors: [defineBehavior('nested')] }), defineBehavior('last')]
      });
      host.on('destroy', (view, options) => calls.push(['host', 'event', view, options]));
      host.on('all', (event, view, options) => {
        if (event === 'destroy') { calls.push(['host', 'all', view, options]); }
      });

      expect(host.destroy(destroyOptions)).toBe(host);
      expect(host.destroy(destroyOptions)).toBe(host);
      expect(calls).toEqual([
        ['host', 'event', host, destroyOptions],
        ['host', 'all', host, destroyOptions],
        ...['outer', 'nested', 'last'].flatMap(name => ['method', 'event', 'all'].map(kind => [name, kind, host, destroyOptions]))
      ]);
      instances.forEach(behavior => {
        behavior.trigger('event');
        behavior.trigger('once');
        behavior.trigger('late');
        const off = vi.spyOn(behavior, 'off');
        listeners.forEach(listener => listener.stopListening(behavior));
        expect(off).not.toHaveBeenCalled();
        off.mockRestore();
      });
      expect(lateCallback).not.toHaveBeenCalled();
      listeners.forEach(listener => listener.stopListening());
    });
  });
});
