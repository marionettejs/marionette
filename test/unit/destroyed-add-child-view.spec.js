import { vi, describe, it, expect } from 'vitest';
import '../setup/backbone.js';
import Backbone from 'backbone';
import { CollectionView, Region, View } from 'marionette';

function state(view) {
  return {
    attached: view.isAttached(),
    destroyed: view.isDestroyed(),
    rendered: view.isRendered(),
  };
}

describe('#addChildView after destruction begins', function() {
  it('ignores collection sort and reset notifications after destruction', function() {
    const collection = new Backbone.Collection();
    const parent = new CollectionView({ collection });
    parent.destroy();
    const sort = vi.spyOn(parent, 'sort');
    const onAdd = vi.fn();
    parent.on('add:child', onAdd);

    collection.trigger('sort', collection);
    collection.reset([{ id: 1 }]);

    expect(sort).not.toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
    expect(parent.children).to.have.lengthOf(0);
    expect(parent.isDestroyed()).toBe(true);
  });

  it('ignores queued reorder and reset notifications after a public callback destroys the owner', function() {
    const collection = new Backbone.Collection([{ id: 1 }, { id: 2 }], { comparator: 'id' });
    const ChildView = View.extend({ template: () => 'child' });
    const parent = new CollectionView({ collection, childView: ChildView });
    parent.render();
    const added = vi.fn();
    parent.on('add:child', added);
    parent.once('before:sort', () => {
      collection.trigger('sort', collection);
      collection.reset([{ id: 3 }]);
      parent.destroy();
    });

    expect(() => collection.trigger('sort', collection)).not.to.throw();
    expect(parent.isDestroyed()).toBe(true);
    expect(parent.children).to.have.lengthOf(0);
    expect(added).not.toHaveBeenCalled();
  });

  it('ignores collection additions triggered by child destruction', function() {
    const collection = new Backbone.Collection([{ id: 1 }]);
    const ChildView = View.extend({ template: () => '<span>Child</span>' });
    const parent = new CollectionView({ childView: ChildView, collection, template: false });
    parent.render();
    const child = parent.children.findByModel(collection.at(0));
    const beforeAdd = vi.fn();
    const add = vi.fn();
    parent.on('before:add:child', beforeAdd);
    parent.on('add:child', add);
    child.on('destroy', () => collection.add({ id: 2 }));

    expect(parent.destroy()).to.equal(parent);

    expect(collection).to.have.lengthOf(2);
    expect(beforeAdd).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    expect(parent.children).to.have.lengthOf(0);
    expect(state(parent)).to.deep.equal({ attached: false, destroyed: true, rendered: false });
  });

  it('returns the child during before:destroy without changing the parent or child', function() {
    const parent = new CollectionView({ template: false });
    const child = new View({ template: () => '<span>Child</span>' });
    const childOn = vi.spyOn(child, 'on');
    const sentinel = document.createElement('span');
    sentinel.textContent = 'Unmanaged content';
    parent.el.append(sentinel);
    const beforeAdd = vi.fn();
    const add = vi.fn();
    parent.on('before:add:child', beforeAdd);
    parent.on('add:child', add);
    let stateDuringDestroy;

    parent.on('before:destroy', () => {
      const parentState = state(parent);
      const html = parent.el.innerHTML;
      const publicChildren = parent.children.toArray();

      expect(parent.addChildView(child)).to.equal(child);

      stateDuringDestroy = state(parent);
      expect(stateDuringDestroy).to.deep.equal(parentState);
      expect(parent.el.innerHTML).to.equal(html);
      expect(parent.el.lastChild).to.equal(sentinel);
      expect(parent.children.toArray()).to.deep.equal(publicChildren);
      expect(state(child)).to.deep.equal({ attached: false, destroyed: false, rendered: false });
      expect(childOn).not.toHaveBeenCalled();
    });

    expect(parent.destroy()).to.equal(parent);

    expect(stateDuringDestroy).to.deep.equal({ attached: false, destroyed: false, rendered: false });
    expect(state(parent)).to.deep.equal({ attached: false, destroyed: true, rendered: false });
    expect(beforeAdd).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();

    const liveOwner = new CollectionView({ template: false });
    expect(liveOwner.addChildView(child)).to.equal(child);
    expect(liveOwner.children.hasView(child)).toBe(true);
    expect(state(child)).to.deep.equal({ attached: false, destroyed: false, rendered: true });
    liveOwner.destroy();
  });

  it('returns repeatedly after destruction before inspecting inputs or doing observable work', function() {
    const parent = new CollectionView({ template: false });
    parent.destroy();
    expect(parent.destroy()).to.equal(parent);

    const sentinel = document.createElement('span');
    sentinel.textContent = 'Unmanaged content';
    parent.el.append(sentinel);
    const child = new View({ template: () => '<span>Child</span>' });
    const childOn = vi.spyOn(child, 'on');
    const destroyedChild = new View();
    destroyedChild.destroy();
    const shownChild = new View({ template: false });
    const regionEl = document.createElement('div');
    document.body.append(regionEl);
    const region = new Region({ el: regionEl });
    region.show(shownChild);
    const inputRead = vi.fn(() => { throw new Error('input inspected'); });
    const hostileView = new Proxy({}, { get: inputRead });
    const hostileIndex = new Proxy({}, { get: inputRead });
    const hostileOptions = new Proxy({}, { get: inputRead });
    const parentState = state(parent);
    const html = parent.el.innerHTML;
    const beforeAdd = vi.fn();
    const add = vi.fn();
    parent.on('before:add:child', beforeAdd);
    parent.on('add:child', add);

    expect(parent.addChildView()).toBeUndefined();
    for (const args of [
      [child],
      [child],
      [destroyedChild],
      [shownChild],
      [hostileView],
      [child, hostileIndex],
      [child, 0, hostileOptions],
    ]) {
      expect(parent.addChildView(...args)).to.equal(args[0]);
    }

    expect(inputRead).not.toHaveBeenCalled();
    expect(state(parent)).to.deep.equal(parentState);
    expect(parent.el.innerHTML).to.equal(html);
    expect(parent.el.lastChild).to.equal(sentinel);
    expect(parent.children).to.have.lengthOf(0);
    expect(beforeAdd).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    expect(state(child)).to.deep.equal({ attached: false, destroyed: false, rendered: false });
    expect(childOn).not.toHaveBeenCalled();

    const liveOwner = new CollectionView({ template: false });
    expect(liveOwner.addChildView(child)).to.equal(child);
    expect(liveOwner.children.hasView(child)).toBe(true);
    expect(state(child)).to.deep.equal({ attached: false, destroyed: false, rendered: true });

    liveOwner.destroy();
    region.destroy();
    regionEl.remove();
  });

  it('leaves a custom override in control until it delegates', function() {
    const child = new View();
    const customResult = {};
    const CustomCollectionView = CollectionView.extend({
      addChildView(view) {
        if (this.isDestroyed()) { return customResult; }
        return CollectionView.prototype.addChildView.call(this, view);
      },
    });
    const custom = new CustomCollectionView();
    custom.destroy();

    expect(custom.addChildView(child)).to.equal(customResult);
    expect(state(child)).to.deep.equal({ attached: false, destroyed: false, rendered: false });

    const DelegatingCollectionView = CollectionView.extend({
      addChildView(view, index, options) {
        return CollectionView.prototype.addChildView.call(this, view, index, options);
      },
    });
    const delegating = new DelegatingCollectionView();
    delegating.destroy();

    expect(delegating.addChildView(child)).to.equal(child);

    child.destroy();
  });
});
