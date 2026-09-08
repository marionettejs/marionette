import { vi, describe, it, expect, beforeEach } from 'vitest';
import DelegateEntityEventsMixin from '../../../src/mixins/delegate-entity-events';
import { normalizeMethods } from '@marionette/utils';

describe('delegate entity events mixin', function() {
  let obj;
  let model;
  let collection;
  let modelCleanup;
  let collectionCleanup;

  beforeEach(function() {
    model = { type: 'model' };
    collection = { type: 'collection' };
    modelCleanup = vi.fn();
    collectionCleanup = vi.fn();

    obj = Object.assign({
      normalizeMethods,
      onModel: vi.fn(),
      onCollection: vi.fn(),
      Data: {
        subscribe: vi.fn()
      }
    }, DelegateEntityEventsMixin);
    obj.Data.subscribe.mockImplementation(source => source === model ? modelCleanup : collectionCleanup);
  });

  describe('#_delegateEntityEvents', function() {
    it('subscribes resolved handlers through DataApi', function() {
      obj.modelEvents = { change: 'onModel' };
      obj.collectionEvents = { update: 'onCollection' };

      obj._delegateEntityEvents(model, collection, obj.Data);

      expect(obj.Data.subscribe.mock.calls.at(0)).toEqual([model, 'change', obj.onModel, obj]);
      expect(obj.Data.subscribe.mock.calls.at(1)).toEqual([collection, 'update', obj.onCollection, obj]);
      expect(obj._modelEvents).to.equal(obj.modelEvents);
      expect(obj._collectionEvents).to.equal(obj.collectionEvents);
    });

    it('resolves callable maps once', function() {
      const modelEvents = { change: 'onModel' };
      obj.modelEvents = vi.fn().mockReturnValue(modelEvents);

      obj._delegateEntityEvents(model, null, obj.Data);

      expect(obj.modelEvents).toHaveBeenCalledTimes(1);
      expect(obj.modelEvents.mock.contexts).toContain(obj);
      expect(obj.modelEvents).toHaveBeenCalledWith();
      expect(obj.Data.subscribe).toHaveBeenCalledTimes(1);
    });

    it('expands space-separated event names', function() {
      obj.modelEvents = { 'change reset': 'onModel' };

      obj._delegateEntityEvents(model, null, obj.Data);

      expect(obj.Data.subscribe).toHaveBeenCalledTimes(2);
      expect(obj.Data.subscribe.mock.calls.at(0)[1]).to.equal('change');
      expect(obj.Data.subscribe.mock.calls.at(1)[1]).to.equal('reset');
    });

    it('does not subscribe absent entities or event maps', function() {
      obj._delegateEntityEvents(model, collection, obj.Data);
      obj._delegateEntityEvents(null, null, obj.Data);

      expect(obj.Data.subscribe).not.toHaveBeenCalled();
      expect(obj).to.not.have.property('_modelEventCleanup');
      expect(obj).to.not.have.property('_collectionEventCleanup');
    });

    it('propagates subscription setup errors', function() {
      const error = new Error('subscribe failed');
      obj.modelEvents = { 'first second': 'onModel' };
      obj.Data.subscribe.mockReset();
      obj.Data.subscribe.mockReturnValueOnce(modelCleanup);
      obj.Data.subscribe.mockImplementationOnce(() => { throw error; });

      expect(() => obj._delegateEntityEvents(model, null, obj.Data)).to.throw(error);
      expect(modelCleanup).not.toHaveBeenCalled();
    });
  });

  describe('#_undelegateEntityEvents', function() {
    it('disposes model and collection subscriptions once', function() {
      obj.modelEvents = { change: 'onModel' };
      obj.collectionEvents = { update: 'onCollection' };
      obj._delegateEntityEvents(model, collection, obj.Data);

      obj._undelegateEntityEvents();
      obj._undelegateEntityEvents();

      expect(modelCleanup).toHaveBeenCalledTimes(1);
      expect(collectionCleanup).toHaveBeenCalledTimes(1);
      expect(obj).to.not.have.property('_modelEvents');
      expect(obj).to.not.have.property('_collectionEvents');
    });
  });
});
