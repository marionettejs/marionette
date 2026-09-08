import { describe, expect, it, vi } from 'vitest';
import { Behavior, DataApi, Events, MnObject, View } from 'marionette';

function observable() { return Object.assign({}, Events); }

function captureFailure(action) {
  try { action(); } catch (error) { return error; }
  throw new Error('Expected the public cleanup operation to throw.');
}

describe('ordinary owner cleanup failures', () => {
  it.each([false, true])('disposes owned state after unsubscribe fails, disposal also fails=%s', disposalFails => {
    const source = observable();
    const unsubscribeError = new Error('unsubscribe failed');
    const disposalError = new Error('owned disposal failed');
    const handler = vi.fn();
    const unsubscribe = vi.fn();
    const disposeOwned = vi.fn(() => { if (disposalFails) { throw disposalError; } });
    const Owner = MnObject.extend({
      createState() { return source; },
      stateEvents: { changed: handler }
    });
    Owner.setStateApi({
      subscribe(state, name, callback, context) {
        const release = DataApi.subscribe(state, name, callback, context);
        return () => {
          release();
          unsubscribe();
          throw unsubscribeError;
        };
      },
      disposeOwned
    });
    const owner = new Owner();
    source.trigger('changed', 'before');
    expect(handler).toHaveBeenCalledExactlyOnceWith('before');

    expect(captureFailure(() => owner.destroy())).toBe(unsubscribeError);
    expect(disposeOwned).toHaveBeenCalledExactlyOnceWith(source);
    expect(unsubscribe).toHaveBeenCalledExactlyOnceWith();
    expect(owner.isDestroyed()).toBe(true);
    source.trigger('changed', 'after');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(owner.destroy()).toBe(owner);
    expect(disposeOwned).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('attempts every DOM registration once when multiple undelegation callbacks throw', () => {
    const attempts = [];
    const failures = new Map([['first', new Error('first callback failed')], ['third', new Error('third callback failed')]]);
    const handler = vi.fn();
    const Owner = View.extend({ events: { first: handler, second: handler, third: handler } });
    Owner.setEventDelegator({
      delegate({ rootEl, eventName, handler: callback }) {
        rootEl.addEventListener(eventName, callback);
        return () => {
          attempts.push(eventName);
          rootEl.removeEventListener(eventName, callback);
          if (failures.has(eventName)) { throw failures.get(eventName); }
        };
      }
    });
    const owner = new Owner();
    const dispatch = () => {
      for (const name of ['first', 'second', 'third']) { owner.el.dispatchEvent(new Event(name)); }
    };
    dispatch();
    expect(handler).toHaveBeenCalledTimes(3);

    const error = captureFailure(() => owner.undelegateEvents());
    expect(attempts).toHaveLength(3);
    expect(new Set(attempts)).toEqual(new Set(['first', 'second', 'third']));
    expect(error).toBe(failures.get(attempts.find(name => failures.has(name))));
    dispatch();
    expect(handler).toHaveBeenCalledTimes(3);
    expect(owner.undelegateEvents()).toBe(owner);
    expect(owner.destroy()).toBe(owner);
    expect(attempts).toHaveLength(3);
  });

  for (const failingStages of [['dom'], ['state'], ['entity'], ['dom', 'state', 'entity']]) {
    it(`completes Behavior resource cleanup after ${failingStages.join(', ')} failure`, () => {
      const state = observable();
      const model = observable();
      const external = observable();
      const errors = Object.fromEntries(['dom', 'state', 'entity'].map(stage => [stage, new Error(`${stage} cleanup failed`)]));
      const attempts = [];
      const onState = vi.fn();
      const onEntity = vi.fn();
      const onExternal = vi.fn();
      const onHost = vi.fn();
      const onDom = vi.fn();
      const disposeOwned = vi.fn();
      let behavior;
      function finish(stage) {
        attempts.push(stage);
        if (failingStages.includes(stage)) { throw errors[stage]; }
      }
      const OwnedBehavior = Behavior.extend({
        initialize() {
          behavior = this;
          this.listenTo(external, 'ping', onExternal);
        },
        createState() { return state; },
        stateEvents: { changed: onState },
        modelEvents: { changed: onEntity },
        events: { signal: onDom },
        onNotify: onHost
      });
      OwnedBehavior.setStateApi({
        subscribe(source, name, callback, context) {
          const release = DataApi.subscribe(source, name, callback, context);
          return () => { release(); finish('state'); };
        },
        disposeOwned
      });
      OwnedBehavior.setEventDelegator({
        delegate({ rootEl, eventName, handler }) {
          rootEl.addEventListener(eventName, handler);
          return () => { rootEl.removeEventListener(eventName, handler); finish('dom'); };
        }
      });
      const Host = View.extend({ behaviors: [OwnedBehavior], template: false });
      Host.setDataApi({
        subscribe(source, name, callback, context) {
          const release = DataApi.subscribe(source, name, callback, context);
          return () => { release(); finish('entity'); };
        }
      });
      const host = new Host({ model });
      const deliver = () => {
        state.trigger('changed');
        model.trigger('changed');
        external.trigger('ping');
        host.triggerMethod('notify');
        host.el.dispatchEvent(new Event('signal'));
      };
      deliver();
      for (const handler of [onState, onEntity, onExternal, onHost, onDom]) { expect(handler).toHaveBeenCalledTimes(1); }

      const error = captureFailure(() => behavior.destroy());
      expect(error).toBe(errors[attempts.find(stage => failingStages.includes(stage))]);
      expect(attempts).toHaveLength(3);
      expect(new Set(attempts)).toEqual(new Set(['dom', 'state', 'entity']));
      expect(disposeOwned).toHaveBeenCalledExactlyOnceWith(state);
      deliver();
      expect(behavior.destroy()).toBe(behavior);
      host.render();
      host.delegateEntityEvents();
      deliver();
      for (const handler of [onState, onEntity, onExternal, onHost, onDom]) { expect(handler).toHaveBeenCalledTimes(1); }
      expect(host.destroy()).toBe(host);
      expect(attempts).toHaveLength(3);
      expect(disposeOwned).toHaveBeenCalledTimes(1);
    });
  }
});
