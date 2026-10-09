import { describe, it, expect, vi } from 'vitest';
import { Behavior, View } from 'marionette';

// Composition is observable through a Behavior installed on a real public host.
describe('Behavior public composition', function() {
  it('resolves UI on each receiver and lets host bindings override behavior bindings', function() {
    let behavior;
    const calls = [];
    const behaviorUI = { first: '.first', shared: '.behavior' };
    const hostUI = { shared: '.host', last: '.last' };
    const ComposedBehavior = Behavior.extend({
      ui() { calls.push(['behavior', this]); return behaviorUI; },
      initialize() { behavior = this; }
    });
    const Host = View.extend({
      behaviors: [ComposedBehavior],
      ui() { calls.push(['host', this]); return hostUI; },
      template: () => '<b class="first"></b><b class="host"></b><b class="last"></b>'
    });
    const host = new Host();
    host.render();
    expect(calls).toContainEqual(['behavior', behavior]);
    expect(calls).toContainEqual(['host', host]);
    expect(behavior.getUI('first')[0]).toBe(host.el.querySelector('.first'));
    expect(behavior.getUI('shared')[0]).toBe(host.el.querySelector('.host'));
    expect(behavior.getUI('last')[0]).toBe(host.el.querySelector('.last'));
    expect(behaviorUI).toEqual({ first: '.first', shared: '.behavior' });
    expect(hostUI).toEqual({ shared: '.host', last: '.last' });
    host.destroy();
  });

  it('combines consumer subclass behavior with host lifecycle and event delivery', function() {
    const onRender = vi.fn();
    const onDestroy = vi.fn();
    const onNotify = vi.fn();
    let behavior;
    const Parent = Behavior.extend({ onRender, onNotify });
    const Child = Parent.extend({ initialize() { behavior = this; }, onDestroy });
    const host = new View({ behaviors: [Child], template: () => '<span>ready</span>' });
    host.render();
    host.triggerMethod('notify', 'payload');
    expect(behavior).toBeInstanceOf(Parent);
    expect(behavior.view).toBe(host);
    expect(onRender).toHaveBeenCalledTimes(1);
    expect(onNotify).toHaveBeenCalledWith('payload');
    host.destroy();
    expect(onDestroy).toHaveBeenCalledTimes(1);
    host.triggerMethod('notify', 'after destroy');
    expect(onNotify).toHaveBeenCalledTimes(1);
  });

  it('ignores inherited UI bindings and safely accepts prototype-shaped own keys', function() {
    let behavior;
    const behaviorUI = Object.assign(Object.create({ inherited: '.ignored' }), { first: '.first' });
    Object.defineProperty(behaviorUI, '__proto__', { enumerable: true, value: '.safe' });
    const Composed = Behavior.extend({ ui: behaviorUI, initialize() { behavior = this; } });
    const host = new View({ behaviors: [Composed], template: () => '<b class="first"></b><b class="safe"></b>' });
    host.render();
    expect(behavior.getUI('first')[0]).toBe(host.el.querySelector('.first'));
    expect(behavior.getUI('__proto__')[0]).toBe(host.el.querySelector('.safe'));
    expect(behavior.getUI('inherited')).toBeUndefined();
    host.destroy();
  });
});
