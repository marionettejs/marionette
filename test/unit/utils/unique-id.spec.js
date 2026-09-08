import { describe, it, expect } from 'vitest';
import Backbone from 'backbone';
import '../../setup/backbone.js';
import _ from 'underscore';
import { Application } from 'marionette';
import { Behavior } from 'marionette';
import { CollectionView } from 'marionette';
import { MnObject } from 'marionette';
import { Region } from 'marionette';
import { View } from 'marionette';
import { uniqueId } from '@mnjs/utils';

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

  it('keeps ids unique while observers subscribe and unsubscribe', function() {
    const owner = new MnObject();
    const source = new MnObject();
    const ids = new Set([owner.cid, source.cid]);
    for (let index = 0; index < 10; index++) {
      owner.listenTo(source, 'event', () => {});
      const next = uniqueId('owned');
      expect(ids.has(next)).toBe(false);
      ids.add(next);
      owner.stopListening(source);
    }
    owner.destroy();
    source.destroy();
  });
});
