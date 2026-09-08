import { describe, expect, it, vi } from 'vitest';
import { Behavior, CollectionView, MnObject, View } from 'marionette';
import { Events } from '@marionette/utils';

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

  it('releases earlier subscriptions when a later adapter subscription fails', () => {
    const cleanup = vi.fn();
    const error = new Error('collection subscription failed');
    const subscribe = vi.fn().mockReturnValueOnce(cleanup).mockImplementationOnce(() => { throw error; });
    const Custom = View.extend();
    Custom.setDataApi({ subscribe });
    expect(() => new Custom({ model: {}, collection: {}, modelEvents: { change() {} }, collectionEvents: { update() {} } })).toThrow(error);
    expect(cleanup).toHaveBeenCalledExactlyOnceWith();
  });

  it('supports empty resolved maps and missing sources', () => {
    const view = new View({ modelEvents() { return null; }, collectionEvents() { return undefined; } });
    expect(view.delegateEntityEvents()).toBe(view);
    expect(view.undelegateEntityEvents()).toBe(view);
    view.destroy();
  });
  it.each([View, CollectionView])('rolls back a partially subscribed map for %s without masking the setup error', OwnerClass => {
    const setupError = new Error('third subscription failed');
    const cleanupError = new Error('first cleanup failed');
    const first = vi.fn(() => { throw cleanupError; });
    const second = vi.fn(() => { throw new Error('second cleanup failed'); });
    const subscribe = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second)
      .mockImplementationOnce(() => { throw setupError; });
    let owner;
    const Custom = OwnerClass.extend({ initialize() { owner = this; } });
    Custom.setDataApi({ subscribe });

    expect(() => new Custom({ model: {}, modelEvents: { 'first second third': vi.fn() } })).toThrow(setupError);
    expect(first).toHaveBeenCalledExactlyOnceWith();
    expect(second).toHaveBeenCalledExactlyOnceWith();
    owner.undelegateEntityEvents();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    owner.destroy();
  });

  it('preserves a collection setup error when rolling back its model cleanup also throws', () => {
    const setupError = new Error('collection failed');
    const cleanup = vi.fn(() => { throw new Error('model cleanup failed'); });
    const subscribe = vi.fn().mockReturnValueOnce(cleanup).mockImplementationOnce(() => { throw setupError; });
    const Custom = View.extend();
    Custom.setDataApi({ subscribe });
    expect(() => new Custom({ model: {}, collection: {}, modelEvents: { change() {} }, collectionEvents: { update() {} } })).toThrow(setupError);
    expect(cleanup).toHaveBeenCalledExactlyOnceWith();
  });

  it('rolls back the host and earlier Behaviors when a later Behavior cannot subscribe', () => {
    const setupError = new Error('Behavior subscription failed');
    const hostCleanup = vi.fn(() => { throw new Error('host cleanup failed'); });
    const behaviorCleanup = vi.fn(() => { throw new Error('Behavior cleanup failed'); });
    const subscribe = vi.fn((model, name) => {
      if (name === 'host') { return hostCleanup; }
      if (name === 'first') { return behaviorCleanup; }
      throw setupError;
    });
    let owner;
    const First = Behavior.extend({ modelEvents: { first() {} } });
    const Second = Behavior.extend({ modelEvents: { failing() {} } });
    const Custom = View.extend({ initialize() { owner = this; }, behaviors: [First, Second] });
    Custom.setDataApi({ subscribe });
    expect(() => new Custom({ model: {}, modelEvents: { host() {} } })).toThrow(setupError);
    expect(hostCleanup).toHaveBeenCalledExactlyOnceWith();
    expect(behaviorCleanup).toHaveBeenCalledExactlyOnceWith();
    owner.undelegateEntityEvents();
    expect(hostCleanup).toHaveBeenCalledTimes(1);
    expect(behaviorCleanup).toHaveBeenCalledTimes(1);
    owner.destroy();
  });

  it('attempts every cleanup exactly once when public undelegation fails', () => {
    const error = new Error('first cleanup failed');
    const first = vi.fn(() => { throw error; });
    const second = vi.fn();
    const third = vi.fn();
    const fourth = vi.fn();
    const subscribe = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second)
      .mockReturnValueOnce(third).mockReturnValueOnce(fourth);
    const CustomBehavior = Behavior.extend({ modelEvents: { behavior() {} } });
    const Custom = View.extend({ behaviors: [CustomBehavior] });
    Custom.setDataApi({ subscribe });
    const owner = new Custom({ model: {}, collection: {}, modelEvents: { 'first second': vi.fn() }, collectionEvents: { third() {} } });
    expect(() => owner.undelegateEntityEvents()).toThrow(error);
    for (const cleanup of [first, second, third, fourth]) {
      expect(cleanup).toHaveBeenCalledExactlyOnceWith();
    }
    owner.undelegateEntityEvents();
    owner.destroy();
    for (const cleanup of [first, second, third, fourth]) {
      expect(cleanup).toHaveBeenCalledTimes(1);
    }
  });

  it('rolls back StateApi registrations when a later state event fails', () => {
    const error = new Error('state subscription failed');
    const cleanup = vi.fn();
    const subscribe = vi.fn().mockReturnValueOnce(cleanup).mockImplementationOnce(() => { throw error; });
    const Owner = MnObject.extend({ stateEvents: { 'first second': vi.fn() } });
    Owner.setStateApi({ subscribe });
    expect(() => new Owner({ state: {} })).toThrow(error);
    expect(cleanup).toHaveBeenCalledExactlyOnceWith();
  });

});
