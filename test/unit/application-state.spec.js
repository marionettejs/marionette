'use strict';

import Application from '../../modules/application';
import State from '../../modules/state';

function defer() {
  let resolve;
  const promise = new Promise(resolvePromise => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

describe('Application State composition', function() {
  it('does not allocate State until requested', async function() {
    const app = new Application();

    expect(Object.hasOwn(app, '_state')).to.be.false;
    expect(Object.hasOwn(app, '_stateDefinition')).to.be.false;

    const state = app.getState();

    expect(state).to.be.instanceOf(State);
    expect(app.getState()).to.equal(state);

    await app.destroy();
    expect(state.isDestroyed()).to.be.true;
  });

  it('activates declared State before initialize and binds events after it', async function() {
    const onReady = this.sinon.spy();
    let initializedState;
    const StatefulApplication = Application.extend({
      state: { ready: false },
      stateEvents: { 'change:ready': 'onReady' },
      initialize() {
        initializedState = this.getState();
        initializedState.set('ready', true);
      },
      onReady
    });
    const app = new StatefulApplication();

    expect(initializedState.get('ready')).to.be.true;
    expect(onReady).to.not.have.been.called;

    initializedState.set('ready', false);
    expect(onReady).to.have.been.calledOnce.and.calledOn(app);

    await app.destroy();
  });

  for (const failure of ['initialize', 'stateEvents']) {
    it(`destroys supplied State when ${ failure } throws`, function() {
      const error = new Error(`${ failure } failed`);
      const state = new State();
      const BrokenApplication = Application.extend({
        [failure]() {
          throw error;
        }
      });

      expect(() => new BrokenApplication({ state })).to.throw(error);
      expect(state.isDestroyed()).to.be.true;
    });
  }

  it('preserves State across stop and restart, then destroys it with the Application', async function() {
    const state = new State({ count: 1 });
    const app = new Application({ state });

    await app.start();
    state.set('count', 2);
    await app.stop();

    expect(app.getState()).to.equal(state);
    expect(state.get('count')).to.equal(2);

    await app.restart();
    expect(app.getState()).to.equal(state);
    expect(state.get('count')).to.equal(2);

    await app.destroy();
    expect(state.isDestroyed()).to.be.true;
  });

  it('uses startup cancellation to prevent stale readiness from mutating State', async function() {
    const readiness = defer();
    const StatefulApplication = Application.extend({
      state: { ready: false },
      onBeforeStart(application, options, context) {
        return readiness.promise.then(() => {
          if (!context.signal.aborted) {
            this.getState().set('ready', true);
          }
        });
      }
    });
    const app = new StatefulApplication();

    const start = app.start();
    const stop = app.stop();
    readiness.resolve();

    expect(await start).to.be.false;
    expect(await stop).to.be.true;
    expect(app.getState().get('ready')).to.be.false;

    await app.destroy();
  });

  it('returns a destroyed State when first requested after destroy', async function() {
    const app = new Application();

    await app.destroy();

    expect(app.getState().isDestroyed()).to.be.true;
  });
});
