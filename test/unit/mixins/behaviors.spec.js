import { describe, expect, it, vi } from 'vitest';
import { Behavior, View } from 'marionette';
import { Events } from '@marionette/utils';

describe('View-owned Behaviors', () => {
  it.each(['class', 'definition', 'map'])('constructs the %s declaration with options and its host', kind => {
    const initialize = vi.fn();
    const onDestroy = vi.fn();
    const Custom = Behavior.extend({ initialize, onDestroy });
    const definition = { behaviorClass: Custom, label: 'custom' };
    const behaviors = kind === 'class' ? [Custom] : kind === 'definition' ? [definition] : { custom: definition };
    const view = new View({ behaviors });
    expect(initialize).toHaveBeenCalledTimes(1);
    const behavior = initialize.mock.contexts[0];
    expect(behavior).toBeInstanceOf(Custom);
    expect(behavior.view).toBe(view);
    if (kind !== 'class') { expect(behavior.getOption('label')).toBe('custom'); }
    view.destroy();
    expect(onDestroy).toHaveBeenCalledTimes(1);
  });

  it('delegates model events and removes only the destroyed Behavior subscription', () => {
    const model = Object.assign({}, Events);
    const first = vi.fn();
    const second = vi.fn();
    let firstBehavior;
    const First = Behavior.extend({ initialize() { firstBehavior = this; }, modelEvents: { change: first } });
    const Second = Behavior.extend({ modelEvents: { change: second } });
    const view = new View({ model, behaviors: [First, Second] });
    model.trigger('change', 'before');
    expect(first).toHaveBeenCalledExactlyOnceWith('before');
    expect(second).toHaveBeenCalledExactlyOnceWith('before');
    firstBehavior.destroy();
    model.trigger('change', 'after');
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    view.undelegateEntityEvents();
    model.trigger('change');
    expect(second).toHaveBeenCalledTimes(2);
    view.delegateEntityEvents();
    model.trigger('change');
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(3);
    view.destroy();
    model.trigger('change');
    expect(second).toHaveBeenCalledTimes(3);
  });

  it('binds Behavior UI on render, restores selectors on unbind, and propagates lifecycle options', () => {
    let behavior;
    const onDestroy = vi.fn();
    const Custom = Behavior.extend({ initialize() { behavior = this; }, ui: { action: 'button' }, onDestroy });
    const view = new View({ template: () => '<button>Run</button>', behaviors: [Custom] });
    view.render();
    expect(behavior.getUI('action')[0]).toBe(view.el.firstChild);
    behavior.unbindUIElements();
    expect(behavior.ui).toEqual({ action: 'button' });
    view.destroy({ reason: 'closed' });
    expect(onDestroy).toHaveBeenCalledExactlyOnceWith(view, { reason: 'closed' });
  });

  it('dispatches public host events to live Behaviors', () => {
    const onChanged = vi.fn();
    const Custom = Behavior.extend({ onChanged });
    const view = new View({ behaviors: [Custom] });
    const payload = {};
    view.triggerMethod('changed', view, payload);
    expect(onChanged).toHaveBeenCalledExactlyOnceWith(view, payload);
    view.destroy();
  });
});
