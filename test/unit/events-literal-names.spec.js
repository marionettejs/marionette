import { describe, it, expect, vi } from 'vitest';
import { Events, bindEvents, unbindEvents } from '@mnjs/utils';
import { Model } from '@mnjs/data';

const createEmitter = () => Object.assign({}, Events);
const names = ['foo bar', 'foo\tbar', 'foo\nbar', ' foo ', ' ', '', 'foo foo'];

for (const registration of ['on', 'once', 'listenTo', 'listenToOnce']) {
  for (const form of ['string', 'map']) {
    describe(`${registration} with literal ${form} names`, function() {
      it.each(names)('registers and removes %j without splitting', function(name) {
        const emitter = createEmitter();
        const listener = createEmitter();
        const handler = vi.fn();
        const unrelated = vi.fn();
        const payload = {};
        const listening = registration.startsWith('listenTo');
        const owner = listening ? listener : emitter;
        const args = form === 'map' ? [{ [name]: handler }] : [name, handler];
        const register = () => owner[registration](...(listening ? [emitter] : []), ...args);
        emitter.on({ foo: unrelated, bar: unrelated });
        expect(register()).toBe(owner);

        emitter.trigger(name, payload);
        expect(handler).toHaveBeenCalledExactlyOnceWith(payload);
        expect(handler.mock.contexts[0]).toBe(owner);
        expect(unrelated).not.toHaveBeenCalled();
        emitter.trigger(name, payload);
        expect(handler).toHaveBeenCalledTimes(registration.toLowerCase().includes('once') ? 1 : 2);

        // Remove by the same literal name while preserving other subscriptions.
        if (registration.toLowerCase().includes('once')) { register(); }
        if (listening) {
          expect(listener.stopListening(emitter, ...args)).toBe(listener);
        } else {
          expect(emitter.off(...args)).toBe(emitter);
        }
        handler.mockClear();
        emitter.trigger(name);
        expect(handler).not.toHaveBeenCalled();
        emitter.trigger('foo');
        expect(unrelated).toHaveBeenCalledTimes(1);
        listener.stopListening();
        emitter.off();
      });
    });
  }
}

it.each(['off', 'stopListening'])('%s selects only an empty name without callback filters', function(method) {
  const emitter = createEmitter();
  const listener = createEmitter();
  const empty = vi.fn();
  const other = vi.fn();
  if (method === 'off') {
    emitter.on({ '': empty, other });
    emitter.off('');
  } else {
    listener.listenTo(emitter, { '': empty, other });
    listener.stopListening(emitter, '');
  }
  emitter.trigger('');
  emitter.trigger('other');
  expect(empty).not.toHaveBeenCalled();
  expect(other).toHaveBeenCalledTimes(1);
  listener.stopListening();
  emitter.off();
});

it('binds and selectively unbinds literal entity-event map keys', function() {
  const emitter = createEmitter();
  const handler = vi.fn();
  const listener = Object.assign(createEmitter(), { handler });
  const bindings = { 'foo bar': 'handler', other: 'handler' };
  bindEvents.call(listener, emitter, bindings);
  emitter.trigger('foo');
  expect(handler).not.toHaveBeenCalled();
  emitter.trigger('foo bar', 'literal');
  expect(handler).toHaveBeenCalledExactlyOnceWith('literal');
  unbindEvents.call(listener, emitter, { 'foo bar': 'handler' });
  emitter.trigger('foo bar');
  emitter.trigger('other', 'remaining');
  expect(handler).toHaveBeenCalledTimes(2);
  expect(handler).toHaveBeenLastCalledWith('remaining');
  listener.stopListening();
  emitter.off();
});

it('observes native Model changes for an attribute containing spaces', function() {
  const model = new Model();
  const listener = createEmitter();
  const handler = vi.fn();
  listener.listenTo(model, 'change:full name', handler);
  model.set('full name', 'Example');
  expect(handler).toHaveBeenCalledTimes(1);
  expect(handler.mock.calls[0].slice(0, 2)).toEqual([model, 'Example']);
  listener.stopListening(model, 'change:full name');
  model.set('full name', 'Updated');
  expect(handler).toHaveBeenCalledTimes(1);
  model.off();
});
