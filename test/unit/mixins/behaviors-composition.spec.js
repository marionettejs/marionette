import { describe, expect, it } from 'vitest';
import { Behavior, View } from 'marionette';

describe('nested Behavior declarations', () => {
  it('resolves declarations on their owners and constructs depth first', () => {
    const calls = [];
    const Nested = Behavior.extend({ initialize(options) { calls.push(['nested', this.view, options.nested]); } });
    const Parent = Behavior.extend({
      initialize(options) { calls.push(['parent', this.view, options.parent]); },
      behaviors() {
        calls.push(['nested declaration', this.view]);
        return { nested: { behaviorClass: Nested, nested: true } };
      }
    });
    const Sibling = Behavior.extend({ initialize() { calls.push(['sibling', this.view]); } });
    const Host = View.extend({ behaviors() {
      calls.push(['host declaration', this]);
      return [{ behaviorClass: Parent, parent: true }, Sibling];
    } });
    const host = new Host();
    expect(calls).toEqual([
      ['host declaration', host], ['parent', host, true], ['nested declaration', host],
      ['nested', host, true], ['sibling', host]
    ]);
    host.destroy();
  });

  it('snapshots own enumerable declaration keys before reading definitions', () => {
    const calls = [];
    const First = Behavior.extend({ initialize() { calls.push('first'); } });
    const Second = Behavior.extend({ initialize() { calls.push('second'); } });
    const Late = Behavior.extend({ initialize() { calls.push('late'); } });
    const inherited = Object.defineProperty({}, 'inherited', { enumerable: true, get() { throw new Error('inherited'); } });
    const declarations = Object.create(inherited);
    Object.defineProperties(declarations, {
      first: { enumerable: true, get() { calls.push('read first'); declarations.late = Late; return First; } },
      second: { enumerable: true, get() { calls.push('read second'); return Second; } },
      hidden: { get() { throw new Error('hidden'); } }
    });
    Object.defineProperty(declarations, Symbol('ignored'), { enumerable: true, get() { throw new Error('symbol'); } });
    const host = new View({ behaviors: declarations });
    expect(calls).toEqual(['read first', 'first', 'read second', 'second']);
    host.destroy();
  });

  it('stops delivering host events to a Behavior after it destroys itself', () => {
    const calls = [];
    const First = Behavior.extend({ onAction() { calls.push('first'); this.destroy(); } });
    const Second = Behavior.extend({ onAction() { calls.push('second'); } });
    const host = new View({ behaviors: [First, Second] });
    host.triggerMethod('action');
    host.triggerMethod('action');
    expect(calls).toEqual(['first', 'second', 'second']);
    host.destroy();
  });
});
