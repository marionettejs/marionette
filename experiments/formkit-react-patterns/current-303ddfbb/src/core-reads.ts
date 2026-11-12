import { error } from '@formkit/core';
import type { FormKitNode, FormKitPlugin, FormKitTrap } from '@formkit/core';
import { bindingEffect, notifyEffect } from './effects.ts';

type ValueKey = 'value' | '_value';
type Bridge = { alive: boolean; value: object; _value: object };
const bridges = new WeakMap<FormKitNode, Bridge>();

export function coreValueChanged(node: FormKitNode, key: ValueKey) {
  const bridge = bridges.get(node);
  if (bridge?.alive) { notifyEffect(bridge[key]); }
}
export function releaseCoreReads(node: FormKitNode) {
  const bridge = bridges.get(node);
  if (!bridge?.alive) { return; }
  bridge.alive = false;
  notifyEffect(bridge.value); notifyEffect(bridge._value);
}

function install(node: FormKitNode) {
  const bridge: Bridge = { alive: true, value: {}, _value: {} };
  bridges.set(node, bridge);
  // This is the original public method at the private constructor's first
  // library hook, before definition features or application plugins can run.
  const extend = node.extend;
  const traps = new WeakMap<object, Map<ValueKey, FormKitTrap>>();
  function managed(key: ValueKey, trap: FormKitTrap): FormKitTrap {
    if (!trap || !['object', 'function'].includes(typeof trap)) { return trap; }
    let known = traps.get(trap);
    if (!known) { known = new Map(); traps.set(trap, known); }
    if (known.has(key)) { return known.get(key)!; }
    const functions = new WeakMap<Function, Function>();
    function handler(part: 'get' | 'set') {
      if (part === 'get' && bridge.alive) { bindingEffect()?.read(bridge[key]); }
      // Do not inspect or copy trap fields at installation. Retained objects,
      // inherited/accessor fields and frozen traps keep their live semantics.
      const callback = Reflect.get(trap, part, trap);
      if (typeof callback !== 'function') { return callback; }
      if (!functions.has(callback)) {
        functions.set(callback, (...args: unknown[]) => Reflect.apply(callback, trap, args));
      }
      return functions.get(callback);
    }
    const wrapped = Object.defineProperties({}, {
      get: { get: () => handler('get') }, set: { get: () => handler('set') }
    }) as FormKitTrap;
    known.set(key, wrapped);
    return wrapped;
  }
  for (const key of ['value', '_value'] as const) {
    // A false trap delegates to Core's original Reflect.get(...args), including
    // an explicitly supplied receiver. Trap-field access still records reads.
    extend(key, managed(key, { get: false, set: false }));
  }
  extend('extend', {
    // Core's method getter supplies a fresh callable. Preserve that shape and
    // delegate future custom extend methods unchanged: a saved public method
    // still reaches this constructor-owned boundary with the original args.
    get: () => new Proxy(extend, {
      apply(target, receiver, args) {
        if (args[0] === 'value' || args[0] === '_value') { args[1] = managed(args[0], args[1]); }
        return Reflect.apply(target, receiver, args);
      }
    }),
    set: (actual, _context, property) => error(102, [actual, property])
  });
}

// A unique birth plugin is supplied first for each adapter createNode call.
// Inherited copies cannot claim another node. Explicit definitions which skip
// library discovery are claimed by the normal plugin phase without installing
// a bridge over their already-running definition features.
export function coreReadBridge(): FormKitPlugin {
  let claimed = false;
  const plugin: FormKitPlugin = () => { claimed = true; };
  plugin.library = node => { if (!claimed) { claimed = true; install(node); } };
  return plugin;
}
