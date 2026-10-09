import { describe, it, expect, vi } from 'vitest';
import { Events } from '@mnjs/utils';

for (const method of ['trigger', 'triggerMethod']) {
  describe(`${method} single-event contract`, function() {
    it('keeps payload identity, all-listener arguments, and per-call return values', function() {
      const payload = { foo: 1, bar: 2 };
      const calls = [];
      const emitter = Object.assign({}, Events, {
        onFoo() { calls.push(['hook']); return 'result'; }
      });
      emitter.on('foo', (...args) => calls.push(['foo', ...args]));
      emitter.on('all', (...args) => calls.push(['all', ...args]));

      const result = emitter[method]('foo', payload, 2);

      expect(result).toBe(method === 'trigger' ? emitter : 'result');
      expect(calls).toEqual([
        ...(method === 'triggerMethod' ? [['hook']] : []),
        ['foo', payload, 2], ['all', 'foo', payload, 2]
      ]);
      expect(calls.at(-1)[2]).toBe(payload);
      emitter.off();
    });
  });
}

for (const method of ['trigger', 'triggerMethod']) {
  it.each(['foo bar', 'foo\tbar', 'foo\nbar', ' foo', 'foo ', ''])(`${method} dispatches %j as one literal name`, function(name) {
    const splitHandler = vi.fn();
    const literalHandler = vi.fn();
    const splitHook = vi.fn();
    const allHandler = vi.fn();
    const emitter = Object.assign({}, Events, { onFoo: splitHook, onBar: splitHook });
    emitter.on({ foo: splitHandler, bar: splitHandler });
    emitter.on(name, literalHandler);
    emitter.on('all', allHandler);

    emitter[method](name, 'payload');

    expect(literalHandler).toHaveBeenCalledExactlyOnceWith('payload');
    expect(splitHandler).not.toHaveBeenCalled();
    expect(splitHook).not.toHaveBeenCalled();
    expect(allHandler).toHaveBeenCalledExactlyOnceWith(name, 'payload');
    emitter.off();
  });
}
