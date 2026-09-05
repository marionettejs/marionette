import Backbone from 'backbone';
import CollectionView from '../../src/modules/collection-view';
import Region from '../../src/modules/region';
import View from '../../src/modules/view';

function state(view) {
  return {
    attached: view.isAttached(),
    destroyed: view.isDestroyed(),
    rendered: view.isRendered(),
  };
}

describe('#addChildView after destruction begins', function() {
  it('ignores collection sort and reset notifications after destruction', function() {
    const parent = new CollectionView({ collection: new Backbone.Collection() });
    parent.destroy();
    const sort = this.sinon.spy(parent, 'sort');
    const destroyChildren = this.sinon.spy(parent, '_destroyChildren');

    parent._onCollectionReorder();
    parent._onCollectionReset();

    expect(sort).to.not.have.been.called;
    expect(destroyChildren).to.not.have.been.called;
  });

  it('ignores collection additions triggered by child destruction', function() {
    const collection = new Backbone.Collection([{ id: 1 }]);
    const ChildView = View.extend({ template: () => '<span>Child</span>' });
    const parent = new CollectionView({ childView: ChildView, collection, template: false });
    parent.render();
    const child = parent.children.findByModel(collection.at(0));
    const beforeAdd = this.sinon.spy();
    const add = this.sinon.spy();
    parent.on('before:add:child', beforeAdd);
    parent.on('add:child', add);
    child.on('destroy', () => collection.add({ id: 2 }));

    expect(parent.destroy()).to.equal(parent);

    expect(collection).to.have.lengthOf(2);
    expect(beforeAdd).to.not.have.been.called;
    expect(add).to.not.have.been.called;
    expect(parent._children).to.have.lengthOf(0);
    expect(parent.children).to.have.lengthOf(0);
    expect(state(parent)).to.deep.equal({ attached: false, destroyed: true, rendered: false });
  });

  it('returns the child during before:destroy without changing the parent or child', function() {
    const parent = new CollectionView({ template: false });
    const child = new View({ template: () => '<span>Child</span>' });
    const childOn = this.sinon.spy(child, 'on');
    const sentinel = document.createElement('span');
    sentinel.textContent = 'Unmanaged content';
    parent.el.append(sentinel);
    const beforeAdd = this.sinon.spy();
    const add = this.sinon.spy();
    parent.on('before:add:child', beforeAdd);
    parent.on('add:child', add);
    let stateDuringDestroy;

    parent.on('before:destroy', () => {
      const parentState = state(parent);
      const html = parent.el.innerHTML;
      const internalChildren = parent._children.toArray();
      const publicChildren = parent.children.toArray();

      expect(parent.addChildView(child)).to.equal(child);

      stateDuringDestroy = state(parent);
      expect(stateDuringDestroy).to.deep.equal(parentState);
      expect(parent.el.innerHTML).to.equal(html);
      expect(parent.el.lastChild).to.equal(sentinel);
      expect(parent._children.toArray()).to.deep.equal(internalChildren);
      expect(parent.children.toArray()).to.deep.equal(publicChildren);
      expect(state(child)).to.deep.equal({ attached: false, destroyed: false, rendered: false });
      expect(child._isShown).to.not.be.true;
      expect(childOn).to.not.have.been.called;
    });

    expect(parent.destroy()).to.equal(parent);

    expect(stateDuringDestroy).to.deep.equal({ attached: false, destroyed: false, rendered: false });
    expect(state(parent)).to.deep.equal({ attached: false, destroyed: true, rendered: false });
    expect(beforeAdd).to.not.have.been.called;
    expect(add).to.not.have.been.called;

    const liveOwner = new CollectionView({ template: false });
    expect(liveOwner.addChildView(child)).to.equal(child);
    expect(liveOwner.children.hasView(child)).to.be.true;
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
    const childOn = this.sinon.spy(child, 'on');
    const destroyedChild = new View();
    destroyedChild.destroy();
    const shownChild = new View({ template: false });
    const regionEl = document.createElement('div');
    document.body.append(regionEl);
    const region = new Region({ el: regionEl });
    region.show(shownChild);
    const inputRead = this.sinon.spy(() => { throw new Error('input inspected'); });
    const hostileView = new Proxy({}, { get: inputRead });
    const hostileIndex = new Proxy({}, { get: inputRead });
    const hostileOptions = new Proxy({}, { get: inputRead });
    const parentState = state(parent);
    const html = parent.el.innerHTML;
    const beforeAdd = this.sinon.spy();
    const add = this.sinon.spy();
    parent.on('before:add:child', beforeAdd);
    parent.on('add:child', add);

    expect(parent.addChildView()).to.be.undefined;
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

    expect(inputRead).to.not.have.been.called;
    expect(state(parent)).to.deep.equal(parentState);
    expect(parent.el.innerHTML).to.equal(html);
    expect(parent.el.lastChild).to.equal(sentinel);
    expect(parent._children).to.have.lengthOf(0);
    expect(parent.children).to.have.lengthOf(0);
    expect(beforeAdd).to.not.have.been.called;
    expect(add).to.not.have.been.called;
    expect(state(child)).to.deep.equal({ attached: false, destroyed: false, rendered: false });
    expect(child._isShown).to.not.be.true;
    expect(childOn).to.not.have.been.called;

    const liveOwner = new CollectionView({ template: false });
    expect(liveOwner.addChildView(child)).to.equal(child);
    expect(liveOwner.children.hasView(child)).to.be.true;
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
    expect(child._isShown).to.not.be.true;

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
