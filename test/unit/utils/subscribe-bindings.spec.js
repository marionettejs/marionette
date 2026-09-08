import { vi, describe, it, expect } from 'vitest';
import Backbone from 'backbone';
import BackboneApi from '../../../packages/adapters/src/data/backbone';
import subscribeBindings from '../../../src/utils/subscribe-bindings';

describe('subscribe bindings', function() {
  it('binds named and direct handlers and releases every subscription', function() {
    const model = new Backbone.Model();
    const context = { onChange: vi.fn() };
    const directHandler = vi.fn();
    const cleanup = subscribeBindings(context, BackboneApi, model, {
      'change reset': 'onChange',
      custom: directHandler
    });

    expect(context.onChange).not.toHaveBeenCalled();
    model.trigger('change', 1);
    model.trigger('reset', 2);
    model.trigger('custom', 3);
    expect(context.onChange).toHaveBeenCalledTimes(2);
    expect(context.onChange.mock.contexts).toContain(context);
    expect(context.onChange.mock.calls.at(0)).toEqual([1]);
    expect(context.onChange.mock.calls.at(1)).toEqual([2]);
    expect(directHandler).toHaveBeenCalledTimes(1);
    expect(directHandler.mock.contexts).toContain(context);
    expect(directHandler).toHaveBeenCalledWith(3);

    cleanup();
    model.trigger('change');
    model.trigger('reset');
    model.trigger('custom');
    expect(context.onChange).toHaveBeenCalledTimes(2);
    expect(directHandler).toHaveBeenCalledTimes(1);
  });
});
