import Backbone from 'backbone';

import CollectionView from '../../../modules/collection-view';
import Region from '../../../modules/region';
import View from '../../../modules/view';

function state(view) {
  return {
    rendered: view.isRendered(),
    attached: view.isAttached(),
    destroyed: view.isDestroyed(),
  };
}

function childStates(collectionView) {
  return collectionView.children.map(state);
}

describe('CollectionView lifecycle contract', function() {
  const ChildView = View.extend({
    template() {
      return '<span>Child</span>';
    },
  });

  const constructionStates = [
    {
      name: 'generated empty detached element',
      create() {
        return new CollectionView();
      },
      expected: { rendered: false, attached: false, destroyed: false },
    },
    {
      name: 'empty attached element',
      create(context) {
        context.setFixtures('<div id="empty-attached"></div>');
        return new CollectionView({ el: document.querySelector('#empty-attached') });
      },
      expected: { rendered: false, attached: true, destroyed: false },
    },
    {
      name: 'populated detached element',
      create() {
        const el = document.createElement('div');
        el.innerHTML = '<span>Existing content</span>';
        return new CollectionView({ el });
      },
      expected: { rendered: false, attached: false, destroyed: false },
    },
    {
      name: 'populated attached element',
      create(context) {
        context.setFixtures('<div id="populated-attached"><span>Existing content</span></div>');
        return new CollectionView({ el: document.querySelector('#populated-attached') });
      },
      expected: { rendered: false, attached: true, destroyed: false },
    },
  ];

  for (const scenario of constructionStates) {
    it(`exposes the ${scenario.name} state vector`, function() {
      const collectionView = scenario.create(this);

      expect(state(collectionView)).to.deep.equal(scenario.expected);
      expect(collectionView.children).to.have.lengthOf(0);

      collectionView.destroy();
    });
  }

  it('preserves rendered state and recomputes attachment when replacing its element while alive', function() {
    this.setFixtures(`
      <div id="replacement-empty"></div>
      <div id="replacement-populated"><span>Existing content</span></div>
    `);
    const populatedDetached = document.createElement('div');
    populatedDetached.innerHTML = '<span>Existing content</span>';
    const replacements = [
      {
        el: document.createElement('div'),
        expected: { rendered: true, attached: false, destroyed: false },
      },
      {
        el: populatedDetached,
        expected: { rendered: true, attached: false, destroyed: false },
      },
      {
        el: document.querySelector('#replacement-empty'),
        expected: { rendered: true, attached: true, destroyed: false },
      },
      {
        el: document.querySelector('#replacement-populated'),
        expected: { rendered: true, attached: true, destroyed: false },
      },
    ];
    const collectionView = new CollectionView();

    for (const replacement of [replacements[0], replacements[2]]) {
      const expected = { ...replacement.expected, rendered: false };

      expect(collectionView.setElement(replacement.el)).to.equal(collectionView);
      expect(state(collectionView)).to.deep.equal(expected);

      expect(collectionView.setElement(replacement.el)).to.equal(collectionView);
      expect(state(collectionView)).to.deep.equal(expected);
    }

    collectionView.render();

    for (const replacement of replacements) {
      expect(collectionView.setElement(replacement.el)).to.equal(collectionView);
      expect(state(collectionView)).to.deep.equal(replacement.expected);

      expect(collectionView.setElement(replacement.el)).to.equal(collectionView);
      expect(state(collectionView)).to.deep.equal(replacement.expected);
    }

    collectionView.destroy();
  });

  it('preserves child ownership without moving child DOM when replacing its element', function() {
    this.setFixtures('<div id="collection-owner"></div>');
    const oldRoot = document.querySelector('#collection-owner');
    const replacementRoot = document.createElement('div');
    replacementRoot.innerHTML = '<span>Replacement content</span>';
    const model = new Backbone.Model({ id: 1 });
    const collectionView = new CollectionView({
      el: oldRoot,
      collection: new Backbone.Collection([model]),
      childView: ChildView,
    });
    collectionView.render();
    const child = collectionView.children.findByModel(model);

    expect(oldRoot.contains(child.el)).to.be.true;
    expect(state(child)).to.deep.equal({
      rendered: true,
      attached: true,
      destroyed: false,
    });

    collectionView.setElement(replacementRoot);

    expect(state(collectionView)).to.deep.equal({
      rendered: true,
      attached: false,
      destroyed: false,
    });
    expect(collectionView.children).to.have.lengthOf(1);
    expect(collectionView.children.findByModel(model)).to.equal(child);
    expect(state(child)).to.deep.equal({
      rendered: true,
      attached: true,
      destroyed: false,
    });
    expect(oldRoot.contains(child.el)).to.be.true;
    expect(replacementRoot.contains(child.el)).to.be.false;

    collectionView.destroy();
  });

  it('follows the normal Region-managed transition sequence', function() {
    this.setFixtures('<div id="collection-region"></div>');
    const collection = new Backbone.Collection([{ id: 1 }, { id: 2 }]);
    const collectionView = new CollectionView({ collection, childView: ChildView });
    const region = new Region({ el: '#collection-region' });

    expect(state(collectionView)).to.deep.equal({
      rendered: false,
      attached: false,
      destroyed: false,
    });

    expect(region.show(collectionView)).to.equal(region);
    expect(state(collectionView)).to.deep.equal({
      rendered: true,
      attached: true,
      destroyed: false,
    });
    expect(childStates(collectionView)).to.deep.equal([
      { rendered: true, attached: true, destroyed: false },
      { rendered: true, attached: true, destroyed: false },
    ]);

    const firstChildren = collectionView.children.toArray();
    expect(collectionView.render()).to.equal(collectionView);
    expect(state(collectionView)).to.deep.equal({
      rendered: true,
      attached: true,
      destroyed: false,
    });
    expect(firstChildren.every(child => child.isDestroyed())).to.be.true;
    expect(collectionView.children.toArray()).to.not.deep.equal(firstChildren);
    expect(childStates(collectionView)).to.deep.equal([
      { rendered: true, attached: true, destroyed: false },
      { rendered: true, attached: true, destroyed: false },
    ]);

    const secondChildren = collectionView.children.toArray();
    expect(region.detachView()).to.equal(collectionView);
    expect(state(collectionView)).to.deep.equal({
      rendered: true,
      attached: false,
      destroyed: false,
    });
    expect(childStates(collectionView)).to.deep.equal([
      { rendered: true, attached: false, destroyed: false },
      { rendered: true, attached: false, destroyed: false },
    ]);

    expect(region.show(collectionView)).to.equal(region);
    expect(collectionView.children.toArray()).to.deep.equal(secondChildren);
    expect(childStates(collectionView)).to.deep.equal([
      { rendered: true, attached: true, destroyed: false },
      { rendered: true, attached: true, destroyed: false },
    ]);

    region.empty();
    expect(state(collectionView)).to.deep.equal({
      rendered: false,
      attached: false,
      destroyed: true,
    });
    expect(secondChildren.every(child => child.isDestroyed())).to.be.true;

    region.destroy();
  });

  it('replaces children on collection reset without changing parent state', function() {
    this.setFixtures('<div id="reset-region"></div>');
    const collection = new Backbone.Collection([{ id: 1 }, { id: 2 }]);
    const collectionView = new CollectionView({ collection, childView: ChildView });
    const region = new Region({ el: '#reset-region' });
    region.show(collectionView);
    const previousChildren = collectionView.children.toArray();

    collection.reset([{ id: 3 }]);

    expect(state(collectionView)).to.deep.equal({
      rendered: true,
      attached: true,
      destroyed: false,
    });
    expect(previousChildren.every(child => child.isDestroyed())).to.be.true;
    expect(collectionView.children).to.have.lengthOf(1);
    expect(childStates(collectionView)).to.deep.equal([
      { rendered: true, attached: true, destroyed: false },
    ]);

    region.destroy();
  });

  it('destroys manually added children on rerender, reset, and owner destruction', function() {
    const collection = new Backbone.Collection([{ id: 1 }]);
    const collectionView = new CollectionView({ collection, childView: ChildView });
    const rerenderChild = new ChildView();
    const resetChild = new ChildView();
    const destroyChild = new ChildView();

    collectionView.render();
    collectionView.addChildView(rerenderChild);
    collectionView.render();

    expect(rerenderChild.isDestroyed()).to.be.true;
    expect(collectionView.children.hasView(rerenderChild)).to.be.false;

    collectionView.addChildView(resetChild);
    collection.reset([{ id: 2 }]);

    expect(resetChild.isDestroyed()).to.be.true;
    expect(collectionView.children.hasView(resetChild)).to.be.false;

    collectionView.addChildView(destroyChild);
    collectionView.destroy();

    expect(destroyChild.isDestroyed()).to.be.true;
  });

  it('leaves child attachment state unmonitored when parent monitoring is disabled', function() {
    this.setFixtures('<div id="unmonitored-region"></div>');
    const collectionView = new CollectionView();
    const region = new Region({ el: '#unmonitored-region' });
    const child = new ChildView();
    const beforeAttach = this.sinon.spy();
    const attach = this.sinon.spy();
    child.on('before:attach', beforeAttach);
    child.on('attach', attach);
    region.show(collectionView);
    collectionView.monitorViewEvents = false;

    collectionView.addChildView(child);

    expect(state(collectionView)).to.deep.equal({
      rendered: true,
      attached: true,
      destroyed: false,
    });
    expect(state(child)).to.deep.equal({
      rendered: true,
      attached: false,
      destroyed: false,
    });
    expect(beforeAttach).to.not.be.called;
    expect(attach).to.not.be.called;

    region.destroy();
  });

  it('releases detached and externally destroyed children once', function() {
    this.setFixtures('<div id="managed-region"></div>');
    const collectionView = new CollectionView();
    const region = new Region({ el: '#managed-region' });
    const detachedChild = new ChildView();
    const removedChild = new ChildView();
    const destroyedChild = new ChildView();
    let beforeDestroyedChildRemoval = 0;
    let destroyedChildRemoval = 0;

    collectionView.on('before:remove:child', (owner, child) => {
      if (child === destroyedChild) {
        expect(owner).to.equal(collectionView);
        beforeDestroyedChildRemoval += 1;
      }
    });
    collectionView.on('remove:child', (owner, child) => {
      if (child === destroyedChild) {
        expect(owner).to.equal(collectionView);
        destroyedChildRemoval += 1;
      }
    });

    expect(collectionView.addChildView(detachedChild)).to.equal(detachedChild);
    expect(state(collectionView)).to.deep.equal({
      rendered: true,
      attached: false,
      destroyed: false,
    });
    expect(state(detachedChild)).to.deep.equal({
      rendered: true,
      attached: false,
      destroyed: false,
    });

    region.show(collectionView);
    collectionView.addChildView(removedChild);
    collectionView.addChildView(destroyedChild);

    expect(collectionView.detachChildView(detachedChild)).to.equal(detachedChild);
    expect(state(detachedChild)).to.deep.equal({
      rendered: true,
      attached: false,
      destroyed: false,
    });
    expect(collectionView.children.hasView(detachedChild)).to.be.false;

    expect(collectionView.removeChildView(removedChild)).to.equal(removedChild);
    expect(removedChild.isDestroyed()).to.be.true;
    expect(collectionView.children.hasView(removedChild)).to.be.false;

    destroyedChild.destroy();
    destroyedChild.destroy();
    expect(collectionView.children.hasView(destroyedChild)).to.be.false;
    expect(beforeDestroyedChildRemoval).to.equal(1);
    expect(destroyedChildRemoval).to.equal(1);
    expect(state(collectionView)).to.deep.equal({
      rendered: true,
      attached: true,
      destroyed: false,
    });

    detachedChild.destroy();
    region.destroy();
  });

  it('destroys managed children after detaching the parent and only once', function() {
    this.setFixtures('<div id="destroy-region"></div>');
    const collection = new Backbone.Collection([{ id: 1 }]);
    const collectionView = new CollectionView({ collection, childView: ChildView });
    const region = new Region({ el: '#destroy-region' });
    const lifecycle = [];
    region.show(collectionView);
    const child = collectionView.children.first();

    collectionView.on('before:destroy', () => lifecycle.push('parent:before:destroy'));
    child.on('before:detach', () => lifecycle.push('child:before:detach'));
    child.on('detach', () => lifecycle.push('child:detach'));
    collectionView.on('before:destroy:children', () => {
      expect(collectionView.isAttached()).to.be.false;
      expect(child.isAttached()).to.be.false;
      lifecycle.push('parent:before:destroy:children');
    });
    child.on('before:destroy', () => lifecycle.push('child:before:destroy'));
    child.on('destroy', () => lifecycle.push('child:destroy'));
    collectionView.on('destroy:children', () => lifecycle.push('parent:destroy:children'));
    collectionView.on('destroy', () => lifecycle.push('parent:destroy'));

    expect(collectionView.destroy()).to.equal(collectionView);
    expect(collectionView.destroy()).to.equal(collectionView);

    expect(lifecycle).to.deep.equal([
      'parent:before:destroy',
      'child:before:detach',
      'child:detach',
      'parent:before:destroy:children',
      'child:before:destroy',
      'child:destroy',
      'parent:destroy:children',
      'parent:destroy',
    ]);
    expect(state(collectionView)).to.deep.equal({
      rendered: false,
      attached: false,
      destroyed: true,
    });
    expect(state(child)).to.deep.equal({
      rendered: false,
      attached: false,
      destroyed: true,
    });
    expect(collectionView.children).to.have.lengthOf(0);
    expect(region.hasView()).to.be.false;

    region.destroy();
  });

  it('attempts every child and the empty Region when child destruction throws', function() {
    const firstError = new Error('first child destroy failed');
    const secondError = new Error('second child destroy failed');
    const teardown = [];
    const ThrowingChildView = View.extend({
      template: false,
      destroy() {
        const id = this.model.id;
        teardown.push(id);
        View.prototype.destroy.call(this);
        if (id === 1) { throw firstError; }
        if (id === 2) { throw secondError; }
        return this;
      },
    });
    const collectionView = new CollectionView({
      collection: new Backbone.Collection([{ id: 1 }, { id: 2 }, { id: 3 }]),
      childView: ThrowingChildView,
    });

    collectionView.render();
    const children = collectionView.children.toArray();
    const emptyRegion = collectionView.getEmptyRegion();
    const destroyEmptyRegion = emptyRegion.destroy;
    this.sinon.stub(emptyRegion, 'destroy').callsFake(function() {
      teardown.push('empty');
      return destroyEmptyRegion.call(this);
    });

    expect(() => collectionView.destroy()).to.throw(firstError);

    expect(teardown).to.deep.equal([1, 2, 3, 'empty']);
    expect(children.every(child => child.isDestroyed())).to.be.true;
    expect(collectionView.children).to.have.lengthOf(0);
    expect(emptyRegion.isDestroyed()).to.be.true;
  });
});
