import { describe, expect, it, vi } from 'vitest';
import { View } from 'marionette';
import { Events } from '@mnjs/utils';

function source() { return Object.assign({}, Events); }

describe('View entity subscriptions', () => {
  it('binds model and collection events with the View context and releases both', () => {
    const model = source();
    const collection = source();
    const onModel = vi.fn();
    const onCollection = vi.fn();
    const view = new View({ model, collection, modelEvents: { change: onModel }, collectionEvents: { update: onCollection } });
    model.trigger('change', 'model');
    collection.trigger('update', 'collection');
    expect(onModel).toHaveBeenCalledExactlyOnceWith('model');
    expect(onModel.mock.contexts[0] === view).toBe(true);
    expect(onCollection).toHaveBeenCalledExactlyOnceWith('collection');
    view.undelegateEntityEvents();
    view.undelegateEntityEvents();
    model.trigger('change');
    collection.trigger('update');
    expect(onModel).toHaveBeenCalledTimes(1);
    expect(onCollection).toHaveBeenCalledTimes(1);
    view.destroy();
  });

  it('replaces subscriptions on redelegation and resolves named/callable event maps', () => {
    const first = source();
    const second = source();
    const handler = vi.fn();
    const Custom = View.extend({ onChange: handler, modelEvents() { return { change: 'onChange' }; } });
    const view = new Custom({ model: first });
    view.undelegateEntityEvents();
    view.model = second;
    view.delegateEntityEvents();
    first.trigger('change', 'old');
    second.trigger('change', 'new');
    expect(handler).toHaveBeenCalledExactlyOnceWith('new');
    view.destroy();
    second.trigger('change');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('supports empty resolved maps and missing sources', () => {
    const view = new View({ modelEvents() { return null; }, collectionEvents() { return undefined; } });
    expect(view.delegateEntityEvents()).toBe(view);
    expect(view.undelegateEntityEvents()).toBe(view);
    view.destroy();
  });

});
