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
  it('increments one shared sequence and prepends string prefixes', function() {
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

  it('returns only the id without a prefix', function() {
    expect(uniqueId()).to.match(/^\d+$/);
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
