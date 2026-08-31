import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');

globalThis.window = dom.window;
globalThis.document = dom.window.document;

const [{ CollectionView, View }, { default: Backbone }] = await Promise.all([
  import('marionette'),
  import('marionette/backbone'),
]);

const ChildView = View.extend({ template: false });
let attachCount = 0;

const TestCollectionView = CollectionView.extend({
  childView: ChildView,
  sortWithCollection: false,

  attachHtml() {
    attachCount += 1;
    return CollectionView.prototype.attachHtml.apply(this, arguments);
  }
});

const collection = new Backbone.Collection(
  Array.from({ length: 1001 }, (value, id) => ({ id }))
);
const collectionView = new TestCollectionView({ collection });

collectionView.render();

const removedView = collectionView.children.findByModel(collection.at(500));
const firstNode = collectionView.el.firstElementChild;
const lastNode = collectionView.el.lastElementChild;

attachCount = 0;
collection.remove(removedView.model);

assert.equal(attachCount, 0, 'removal-only update must not reattach survivors');
assert.equal(collectionView.el.children.length, 1000);
assert.equal(collectionView.el.firstElementChild, firstNode);
assert.equal(collectionView.el.lastElementChild, lastNode);
assert.equal(removedView.isDestroyed(), true);

collectionView.destroy();
dom.window.close();
