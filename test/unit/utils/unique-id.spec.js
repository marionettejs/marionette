import _ from 'underscore';
import Application from '../../../modules/application';
import Behavior from '../../../modules/behavior';
import CollectionView from '../../../modules/collection-view';
import MnObject from '../../../modules/object';
import Region from '../../../modules/region';
import View from '../../../modules/view';
import uniqueId from '../../../utils/unique-id';

function suffix(id) {
  return Number(id.match(/\d+$/)[0]);
}

describe('uniqueId', function() {
  it('increments one shared sequence and prepends truthy prefixes', function() {
    const first = uniqueId('first');
    const second = uniqueId('second');

    expect(first).to.match(/^first\d+$/);
    expect(second).to.match(/^second\d+$/);
    expect(suffix(second)).to.equal(suffix(first) + 1);
  });

  it('does not share its sequence with Underscore or Backbone', function() {
    const before = uniqueId('owned');

    _.uniqueId('external');
    new Backbone.Model();

    const after = uniqueId('owned');
    expect(suffix(after)).to.equal(suffix(before) + 1);
  });

  it('returns only the id for falsey prefixes', function() {
    const prefixes = [undefined, null, false, 0, '', NaN, 0n];
    const ids = prefixes.map(prefix => uniqueId(prefix));

    ids.forEach(id => expect(id).to.match(/^\d+$/));
    ids.slice(1).forEach((id, index) => {
      expect(Number(id)).to.equal(Number(ids[index]) + 1);
    });
  });

  it('uses normal addition coercion after consuming the id', function() {
    const hints = [];
    const prefix = {
      [Symbol.toPrimitive](hint) {
        hints.push(hint);
        return 'coerced';
      }
    };

    expect(uniqueId(prefix)).to.match(/^coerced\d+$/);
    expect(hints).to.deep.equal(['default']);
  });

  it('propagates prefix coercion errors after consuming the id', function() {
    const before = uniqueId('before');
    const error = new Error('prefix coercion failed');
    const prefix = {
      [Symbol.toPrimitive]() {
        throw error;
      }
    };

    expect(() => uniqueId(prefix)).to.throw(error);
    const after = uniqueId('after');

    expect(suffix(after)).to.equal(suffix(before) + 2);
  });

  it('consumes the id before a Symbol prefix throws', function() {
    const before = uniqueId('before');

    expect(() => uniqueId(Symbol('prefix'))).to.throw(TypeError);
    const after = uniqueId('after');

    expect(suffix(after)).to.equal(suffix(before) + 2);
  });

  it('keeps custom-prefix ids unique across Marionette types', function() {
    const cidPrefix = 'shared';
    const SharedObject = MnObject.extend({ cidPrefix });
    const SharedApplication = Application.extend({ cidPrefix });
    const SharedView = View.extend({ cidPrefix });
    const SharedCollectionView = CollectionView.extend({ cidPrefix });
    const SharedRegion = Region.extend({ cidPrefix });
    const SharedBehavior = Behavior.extend({ cidPrefix });
    const hostView = new SharedView();
    const object = new SharedObject();
    const application = new SharedApplication();
    const collectionView = new SharedCollectionView();
    const region = new SharedRegion({ el: document.createElement('div') });
    const behavior = new SharedBehavior({}, hostView);
    const ids = [
      hostView.cid,
      object.cid,
      application.cid,
      collectionView.cid,
      region.cid,
      behavior.cid
    ];

    expect(ids).to.have.length(6);
    expect(new Set(ids)).to.have.property('size', ids.length);
    ids.forEach(id => expect(id).to.match(/^shared\d+$/));
  });

  it('shares the constructor sequence with event-listener bookkeeping', function() {
    const LObject = MnObject.extend({ cidPrefix: 'l' });
    const listener = new LObject();
    const listenee = new LObject();

    listener.listenTo(listenee, 'event', () => {});

    const ids = [
      listener.cid,
      listenee.cid,
      listenee._rdListenId,
      listener._rdListenId
    ];
    ids.forEach(id => expect(id).to.match(/^l\d+$/));
    ids.slice(1).forEach((id, index) => {
      expect(suffix(id)).to.equal(suffix(ids[index]) + 1);
    });
  });
});
