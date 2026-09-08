import { describe, expect, it, vi } from 'vitest';
import { DataApi, Events, MnObject } from 'marionette';

describe('owner state subscriptions', () => {
  it('binds named and direct handlers and releases every subscription', () => {
    const source = Object.assign({}, Events);
    const named = vi.fn();
    const direct = vi.fn();
    const Owner = MnObject.extend({
      createState() { return source; },
      onChange: named,
      stateEvents: { 'change reset': 'onChange', custom: direct }
    });
    Owner.setStateApi({ subscribe: DataApi.subscribe });
    const owner = new Owner();
    source.trigger('change', 1);
    source.trigger('reset', 2);
    source.trigger('custom', 3);
    expect(named.mock.calls).toEqual([[1], [2]]);
    expect(named.mock.contexts.every(context => context === owner)).toBe(true);
    expect(direct).toHaveBeenCalledExactlyOnceWith(3);
    expect(direct.mock.contexts[0] === owner).toBe(true);
    owner.destroy();
    source.trigger('change');
    source.trigger('reset');
    source.trigger('custom');
    expect(named).toHaveBeenCalledTimes(2);
    expect(direct).toHaveBeenCalledTimes(1);
  });
});
