import { assign, createActor, createMachine, emit } from 'xstate';
import { createMarionette } from '../../src/index.ts';
import createXStateActorApi from '../../packages/adapters/src/xstate.js';
import createXStateStoreDataApi from '../../packages/adapters/src/xstate-store.js';

const childMachine = createMachine({
  context: ({ input }) => ({ id: input.id, label: input.label }),
  on: {
    rename: {
      actions: assign({ label: ({ event }) => event.label })
    },
    announce: {
      actions: emit(({ context }) => ({ type: 'announced', label: context.label }))
    }
  }
});

const parentMachine = createMachine({
  context: ({ input }) => ({ models: input.models, unrelated: 0 }),
  on: {
    replace: {
      actions: assign({ models: ({ event }) => event.models })
    },
    updateUnrelated: {
      actions: assign({ unrelated: ({ context }) => context.unrelated + 1 })
    }
  }
});

function createChild(id, label) {
  return createActor(childMachine, { input: { id, label } }).start();
}

function createParent(models) {
  return createActor(parentMachine, { input: { models } }).start();
}

describe('XState actor adapter', function() {
  let actors;

  beforeEach(function() {
    actors = [];
  });

  afterEach(function() {
    actors.forEach(actor => actor.stop());
  });

  function track(actor) {
    actors.push(actor);
    return actor;
  }

  it('renders and reconciles stable child actor references through public APIs', function() {
    const first = track(createChild(1, 'one'));
    const second = track(createChild(2, 'two'));
    const parent = track(createParent([first, second]));
    const ActorApi = createXStateActorApi({
      select: snapshot => snapshot.context.models,
      snapshotEvent: 'actor:snapshot'
    });
    const runtime = createMarionette();
    const ChildView = runtime.View.extend({
      template: context => context.label,
      modelEvents: { 'actor:snapshot': 'render', announced: 'onAnnounced' },
      onAnnounced(event) { this.announcement = event.label; }
    });
    const ListView = runtime.CollectionView.extend({ childView: ChildView });
    ChildView.setDataApi(ActorApi);
    ListView.setDataApi(ActorApi);
    const view = new ListView({ collection: parent }).render();
    const firstView = view.children.findByModel(first);
    const secondView = view.children.findByModel(second);

    expect(view.el.textContent).to.equal('onetwo');
    first.send({ type: 'rename', label: 'updated' });
    first.send({ type: 'announce' });
    expect(firstView.el.textContent).to.equal('updated');
    expect(firstView.announcement).to.equal('updated');

    const third = track(createChild(3, 'three'));
    parent.send({ type: 'replace', models: [second, first, third] });
    expect(view.children.toArray().map(child => child.model))
      .to.deep.equal([second, first, third]);
    expect(view.children.findByModel(first)).to.equal(firstView);
    expect(view.children.findByModel(second)).to.equal(secondView);

    parent.send({ type: 'replace', models: [third, first] });
    expect(secondView.isDestroyed()).to.be.true;
    view.destroy();
    expect(parent.getSnapshot().status).to.equal('active');
    expect(first.getSnapshot().status).to.equal('active');
  });

  it('ignores unrelated parent snapshots and supports multiple observers', function() {
    const first = track(createChild(1, 'one'));
    const parent = track(createParent([first]));
    let keyCalls = 0;
    const ActorApi = createXStateActorApi({
      select: snapshot => snapshot.context.models
    });
    const originalKey = ActorApi.key;
    ActorApi.key = actor => {
      keyCalls++;
      return originalKey(actor);
    };
    const firstObserver = this.sinon.spy();
    const secondObserver = this.sinon.spy();
    const stopFirst = ActorApi.observeCollection(parent, firstObserver);
    const stopSecond = ActorApi.observeCollection(parent, secondObserver);
    keyCalls = 0;

    parent.send({ type: 'updateUnrelated' });
    expect(firstObserver).to.not.have.been.called;
    expect(secondObserver).to.not.have.been.called;
    expect(keyCalls).to.equal(0);

    const second = track(createChild(2, 'two'));
    parent.send({ type: 'replace', models: [first, second] });
    stopFirst();
    stopFirst();
    parent.send({ type: 'replace', models: [first] });

    expect(firstObserver).to.have.been.calledOnce;
    expect(secondObserver).to.have.been.calledTwice;
    stopSecond();
  });

  it('subscribes to snapshots and emitted events with native payloads', function() {
    const actor = track(createChild(1, 'one'));
    const ActorApi = createXStateActorApi({
      select: () => [],
      snapshotEvent: 'actor:snapshot'
    });
    const context = {};
    const snapshots = this.sinon.spy();
    const announcements = this.sinon.spy();
    const stopSnapshots = ActorApi.subscribe(actor, 'actor:snapshot', snapshots, context);
    const stopAnnouncements = ActorApi.subscribe(actor, 'announced', announcements, context);

    expect(snapshots).to.not.have.been.called;
    actor.send({ type: 'rename', label: 'updated' });
    actor.send({ type: 'announce' });
    expect(snapshots).to.have.been.calledOn(context);
    expect(snapshots.lastCall.args[0].context.label).to.equal('updated');
    expect(announcements).to.have.been.calledOnce.and.calledOn(context);
    expect(announcements.firstCall.args).to.deep.equal([{ type: 'announced', label: 'updated' }]);

    stopSnapshots();
    stopSnapshots();
    stopAnnouncements();
    actor.send({ type: 'rename', label: 'late' });
    actor.send({ type: 'announce' });
    expect(snapshots.lastCall.args[0].context.label).to.equal('updated');
    expect(announcements).to.have.been.calledOnce;
  });

  it('forwards unconfigured event names without reserving a domain event', function() {
    const actor = track(createChild(1, 'one'));
    const ActorApi = createXStateActorApi({ select: () => [] });
    const snapshotEvent = this.sinon.spy();
    const cleanup = ActorApi.subscribe(actor, 'announced', snapshotEvent);

    actor.send({ type: 'announce' });

    expect(snapshotEvent).to.have.been.calledOnce.and.calledWith({
      type: 'announced',
      label: 'one'
    });
    cleanup();
  });

  it('reads actor context and preserves actor-reference identity', function() {
    const actor = track(createChild(1, 'one'));
    const ActorApi = createXStateActorApi();

    expect(ActorApi.key(actor)).to.equal(actor);
    expect(ActorApi.get(actor, 'label')).to.equal('one');
    expect(ActorApi.get(actor, 'missing')).to.be.undefined;
    expect(ActorApi.has(actor, 'label')).to.be.true;
    expect(ActorApi.has(actor, 'missing')).to.be.false;
    expect(ActorApi.serialize(actor)).to.equal(actor.getSnapshot().context);
    expect(ActorApi).to.not.have.property('models');
    expect(ActorApi).to.not.have.property('observeCollection');
  });

  it('treats a respawned actor with the same id as a new model identity', function() {
    const first = track(createActor(childMachine, {
      id: 'shared-id',
      input: { id: 1, label: 'first' }
    }).start());
    const replacement = track(createActor(childMachine, {
      id: 'shared-id',
      input: { id: 1, label: 'replacement' }
    }).start());
    const parent = track(createParent([first]));
    const ActorApi = createXStateActorApi({
      select: snapshot => snapshot.context.models
    });
    const runtime = createMarionette();
    const ChildView = runtime.View.extend({ template: context => context.label });
    const ListView = runtime.CollectionView.extend({ childView: ChildView });
    ChildView.setDataApi(ActorApi);
    ListView.setDataApi(ActorApi);
    const view = new ListView({ collection: parent }).render();
    const firstView = view.children.first();

    parent.send({ type: 'replace', models: [replacement] });

    expect(firstView.isDestroyed()).to.be.true;
    expect(view.children.first().model).to.equal(replacement);
    expect(view.el.textContent).to.equal('replacement');
    view.destroy();
  });

  it('stops only factory-owned state actors', function() {
    const borrowed = track(createChild(1, 'borrowed'));
    const owned = track(createChild(2, 'owned'));
    const ActorApi = createXStateActorApi();
    const runtime = createMarionette();
    const Borrower = runtime.MnObject.extend({ state: borrowed });
    const Owner = runtime.MnObject.extend({ createState: () => owned });
    Borrower.setStateApi(ActorApi);
    Owner.setStateApi(ActorApi);

    new Borrower().destroy();
    const owner = new Owner();
    owner.getState();
    owner.destroy();

    expect(borrowed.getSnapshot().status).to.equal('active');
    expect(owned.getSnapshot().status).to.equal('stopped');
  });

  it('releases owned actor subscriptions before stopping the actor', function() {
    const calls = [];
    const actor = {
      getSnapshot: () => ({ context: {} }),
      subscribe() {
        calls.push('subscribe');
        return { unsubscribe() { calls.push('unsubscribe'); } };
      },
      on() { return { unsubscribe() {} }; },
      stop() { calls.push('stop'); }
    };
    const ActorApi = createXStateActorApi({ snapshotEvent: 'actor:snapshot' });
    const runtime = createMarionette();
    const Owner = runtime.MnObject.extend({
      createState: () => actor,
      stateEvents: { 'actor:snapshot': 'onSnapshot' },
      onSnapshot() {}
    });
    Owner.setStateApi(ActorApi);

    new Owner().destroy();

    expect(calls).to.deep.equal(['subscribe', 'unsubscribe', 'stop']);
  });

  it('diagnoses malformed actor sources and snapshots', function() {
    const ActorApi = createXStateActorApi({ select: snapshot => snapshot.models });
    const noSnapshot = { subscribe() { return () => {}; } };
    const noContext = { getSnapshot: () => ({}), subscribe() { return () => {}; } };
    const primitiveContext = { getSnapshot: () => ({ context: 'invalid' }) };
    const invalidDisposer = { getSnapshot: () => ({ models: [] }), subscribe() { return {}; } };
    const invalidEventDisposer = { on() { return {}; } };

    expect(() => ActorApi.models(noSnapshot)).to.throw(TypeError, 'missing synchronous snapshot');
    expect(() => ActorApi.models(null)).to.throw(TypeError, 'missing synchronous snapshot');
    expect(() => ActorApi.serialize(noContext)).to.throw(TypeError, 'object snapshot context');
    expect(() => ActorApi.serialize(primitiveContext)).to.throw(TypeError, 'object snapshot context');
    expect(() => ActorApi.observeCollection(invalidDisposer, () => {}))
      .to.throw(TypeError, 'subscribe must return a disposer');
    expect(() => ActorApi.subscribe(invalidEventDisposer, 'notice', () => {}))
      .to.throw(TypeError, 'subscribe must return a disposer');
    expect(() => createXStateActorApi({ select: () => [], snapshotEvent: '' }))
      .to.throw(TypeError, 'snapshotEvent must be a non-empty string');
    expect(() => createXStateActorApi({ select: () => [], snapshotEvent: 1 }))
      .to.throw(TypeError, 'snapshotEvent must be a non-empty string');
  });

  it('uses the keyed snapshot adapter for plain records in a parent actor', function() {
    const first = { id: 1, label: 'one' };
    const parent = track(createParent([first]));
    const DataApi = createXStateStoreDataApi({
      key: model => model.id,
      select: snapshot => snapshot.context.models
    });
    const callback = this.sinon.spy();
    const cleanup = DataApi.observeCollection(parent, callback);
    const second = { id: 2, label: 'two' };

    parent.send({ type: 'replace', models: [first, second] });

    expect(callback).to.have.been.calledOnce.and.calledWith({
      kind: 'update',
      added: [second],
      removed: [],
      updated: []
    });
    cleanup();
  });
});
