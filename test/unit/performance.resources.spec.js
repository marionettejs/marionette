import Backbone from 'backbone';
import performanceContract from '../../config/performance.json';
import Behavior from '../../modules/behavior';
import ChildViewContainer from '../../modules/child-view-container';
import CollectionView from '../../modules/collection-view';
import Region from '../../modules/region';
import View from '../../modules/view';

function registrations(eventMap, owner) {
  return Object.values(eventMap || {})
    .flat()
    .filter(event => !owner || event.context === owner || event.ctx === owner || event.listener === owner)
    .length;
}

function marionetteRegistrations(emitter, owner) {
  return registrations(emitter._rdEvents, owner);
}

function backboneRegistrations(emitter, owner) {
  return registrations(emitter._events, owner);
}

describe('Phase 0 deterministic resource baselines', function() {
  const resources = performanceContract.deterministicResources;
  const PlainView = View.extend({ template: false });
  const ChildView = View.extend({ template: false });
  const ListeningBehavior = Behavior.extend({
    modelEvents: {
      change: 'onModelChange'
    },
    onModelChange() {}
  });
  const BehaviorView = View.extend({
    behaviors: [ListeningBehavior],
    template: false,
  });

  it('records the own-property shape of unused core instances', function() {
    const view = new View();
    const region = new Region({ el: document.createElement('div') });
    const behaviorHost = new View();
    const behavior = new Behavior({}, behaviorHost);
    const collectionView = new CollectionView({
      childView: ChildView,
      collection: new Backbone.Collection(),
    });

    expect(Object.keys(view).sort()).to.eql(resources.instanceShapes.View);
    expect(Object.keys(region).sort()).to.eql(resources.instanceShapes.Region);
    expect(Object.keys(behavior).sort()).to.eql(resources.instanceShapes.Behavior);
    expect(Object.keys(collectionView).sort()).to.eql(resources.instanceShapes.CollectionView);

    behavior.destroy();
    behaviorHost.destroy();
    view.destroy();
    region.destroy();
    collectionView.destroy();
  });

  it('records the eager allocation categories of unused core instances', function() {
    const view = new View();
    const behaviorHost = new View();
    const behavior = new Behavior({}, behaviorHost);
    const collectionView = new CollectionView({
      childView: ChildView,
      collection: new Backbone.Collection(),
    });
    const shapes = resources.allocationShapes;

    for (const property of shapes.View.emptyArrays) {
      expect(view[property]).to.be.an('array').with.lengthOf(0);
    }
    for (const property of shapes.View.emptyObjects) {
      expect(view[property]).to.eql({});
    }
    expect(marionetteRegistrations(view)).to.equal(shapes.View.marionetteEventRegistrations);

    for (const property of shapes.Behavior.emptyArrays) {
      expect(behavior[property]).to.be.an('array').with.lengthOf(0);
    }
    for (const property of shapes.Behavior.emptyObjects) {
      expect(behavior[property]).to.eql({});
    }
    expect(Object.keys(behavior._rdListeningTo)).to.have.lengthOf(shapes.Behavior.listeningContainers);

    for (const property of shapes.CollectionView.emptyArrays) {
      expect(collectionView[property]).to.be.an('array').with.lengthOf(0);
    }
    for (const property of shapes.CollectionView.emptyChildViewContainers) {
      expect(collectionView[property]).to.be.instanceOf(ChildViewContainer);
      expect(collectionView[property].length).to.equal(0);
      expect(collectionView[property]._views).to.be.an('array').with.lengthOf(0);
      expect(collectionView[property]._viewsByCid).to.eql({});
    }
    expect(collectionView._emptyRegion).to.be.instanceOf(Region);
    expect(collectionView._emptyRegion.hasView()).to.equal(false);
    expect(marionetteRegistrations(collectionView))
      .to.equal(shapes.CollectionView.marionetteEventRegistrations);

    behavior.destroy();
    behaviorHost.destroy();
    view.destroy();
    collectionView.destroy();
  });

  it(`leaves no Region registrations after ${resources.attachDetachCycles} detach cycles`, function() {
    const regionEl = document.createElement('div');
    document.body.appendChild(regionEl);
    const region = new Region({ el: regionEl });
    const view = new PlainView();

    for (let index = 0; index < resources.attachDetachCycles; index += 1) {
      region.show(view);
      expect(marionetteRegistrations(view, region)).to.equal(1);
      expect(region.detachView()).to.equal(view);
      expect(region.hasView()).to.equal(false);
      expect(marionetteRegistrations(view, region)).to.equal(0);
      expect(regionEl.childNodes).to.have.lengthOf(resources.retentionShapes.managedDomChildrenAfterEmpty);
    }

    view.destroy();
    region.destroy();
    regionEl.remove();
  });

  it(`releases external owners across ${resources.mountDestroyCycles} mount and destroy cycles`, function() {
    const collection = new Backbone.Collection([{ id: 1 }]);
    const model = new Backbone.Model();
    const collectionBaseline = backboneRegistrations(collection);
    const modelBaseline = backboneRegistrations(model);

    expect(collectionBaseline).to.equal(resources.retentionShapes.externalBackboneRegistrationsAfterDestroy);
    expect(modelBaseline).to.equal(resources.retentionShapes.externalBackboneRegistrationsAfterDestroy);

    for (let index = 0; index < resources.mountDestroyCycles; index += 1) {
      const regionEl = document.createElement('div');
      document.body.appendChild(regionEl);
      const region = new Region({ el: regionEl });
      const regionView = new PlainView();
      region.show(regionView);
      region.empty();

      expect(region.hasView()).to.equal(false);
      expect(marionetteRegistrations(regionView, region)).to.equal(0);
      expect(regionEl.childNodes).to.have.lengthOf(resources.retentionShapes.managedDomChildrenAfterEmpty);

      const collectionView = new CollectionView({
        childView: ChildView,
        collection,
      });
      document.body.appendChild(collectionView.el);
      collectionView.render();
      expect(backboneRegistrations(collection, collectionView)).to.equal(3);
      collectionView.destroy();

      expect(collectionView._children.length).to.equal(0);
      expect(collectionView.children.length).to.equal(0);
      expect(collectionView._emptyRegion.isDestroyed()).to.equal(true);
      expect(backboneRegistrations(collection, collectionView)).to.equal(0);
      expect(backboneRegistrations(collection)).to.equal(collectionBaseline);
      expect(collectionView.el.isConnected).to.equal(false);
      expect(collectionView.el.childNodes).to.have.lengthOf(resources.retentionShapes.managedDomChildrenAfterEmpty);

      const behaviorView = new BehaviorView({ model });
      const behavior = behaviorView._behaviors[0];
      document.body.appendChild(behaviorView.el);
      expect(backboneRegistrations(model, behavior)).to.equal(1);
      behaviorView.destroy();

      expect(backboneRegistrations(model, behaviorView)).to.equal(0);
      expect(backboneRegistrations(model, behavior)).to.equal(0);
      expect(backboneRegistrations(model)).to.equal(modelBaseline);
      expect(behaviorView.el.isConnected).to.equal(false);
      expect(behavior.view === behaviorView)
        .to.equal(resources.retentionShapes.destroyedBehaviorRetainsHostReference);
      expect(behaviorView._behaviors).to.have.lengthOf(
        resources.retentionShapes.destroyedHostRetainsBehaviorCount
      );
      expect(behaviorView._behaviors.includes(behavior)).to.equal(true);

      region.destroy();
      expect(region.isDestroyed()).to.equal(true);
      expect(region._parentView).to.equal(undefined);
      expect(regionEl.isConnected).to.equal(true);
      expect(regionEl.childNodes).to.have.lengthOf(resources.retentionShapes.managedDomChildrenAfterEmpty);
      regionEl.remove();
    }
  });
});
