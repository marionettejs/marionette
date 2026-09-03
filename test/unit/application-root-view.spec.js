'use strict';

import _ from 'underscore';

import Application from '../../modules/application';
import Region from '../../modules/region';
import View from '../../modules/view';

const RootView = View.extend({
  template: _.template('<span>root</span>')
});

describe('Application root View ownership', function() {
  beforeEach(function() {
    this.setFixtures('<div id="application-root"></div>');
  });

  it('shows and reads only the View coordinated by the Application', function() {
    const region = new Region({ el: '#application-root' });
    const app = new Application({ region });
    const view = new RootView();
    const show = this.sinon.spy(region, 'show');

    expect(app.getView()).to.be.undefined;
    expect(app.showView(view)).to.equal(view);
    expect(show).to.have.been.calledOnce.and.calledWithExactly(view);
    expect(app.getRegion()).to.equal(region);
    expect(app.getView()).to.equal(view);
    expect(app.showView(view)).to.equal(view);
    expect(show).to.have.been.calledTwice;

    region.destroy();
  });

  it('clears its View when a borrowed Region is emptied externally', async function() {
    const region = new Region({ el: '#application-root' });
    const app = new Application({ region });
    const view = new RootView();

    await app.start();
    app.showView(view);
    region.empty();

    expect(view.isDestroyed()).to.be.true;
    expect(app.isRunning()).to.be.true;
    expect(app.getView()).to.be.undefined;

    await app.stop();
    expect(region.hasView()).to.be.false;

    await app.destroy();
    region.destroy();
  });

  it('does not claim or empty an external replacement View', async function() {
    const region = new Region({ el: '#application-root' });
    const app = new Application({ region });
    const rootView = new RootView();
    const replacement = new RootView();

    await app.start();
    app.showView(rootView);
    region.show(replacement);

    expect(rootView.isDestroyed()).to.be.true;
    expect(app.getView()).to.be.undefined;
    expect(region.currentView).to.equal(replacement);

    await app.stop();
    expect(region.currentView).to.equal(replacement);
    expect(replacement.isDestroyed()).to.be.false;

    region.empty();
    expect(replacement.isDestroyed()).to.be.true;
    expect(app.getView()).to.be.undefined;

    await app.destroy();
    expect(region.isDestroyed()).to.be.false;
    region.destroy();
  });

  it('does not let a detached prior root clear the current root later', async function() {
    const region = new Region({ el: '#application-root' });
    const app = new Application({ region });
    const firstView = new RootView();
    const secondView = new RootView();

    app.showView(firstView);
    expect(region.detachView()).to.equal(firstView);
    expect(app.getView()).to.be.undefined;

    app.showView(secondView);
    firstView.destroy();

    expect(app.getView()).to.equal(secondView);
    expect(await app.stop()).to.be.true;
    expect(secondView.isDestroyed()).to.be.true;
    expect(app.getView()).to.be.undefined;

    await app.destroy();
    region.destroy();
  });

  it('does not reclaim a detached root re-shown externally', async function() {
    const region = new Region({ el: '#application-root' });
    const app = new Application({ region });
    const view = new RootView();

    app.showView(view);
    expect(region.detachView()).to.equal(view);
    region.show(view);

    expect(app.getView()).to.be.undefined;
    expect(await app.stop()).to.be.true;
    expect(region.currentView).to.equal(view);
    expect(view.isDestroyed()).to.be.false;

    region.destroy();
    await app.destroy();
  });

  it('does not claim a View the host Region could not show', async function() {
    const region = new Region({
      el: '#missing-application-root',
      allowMissingEl: true
    });
    const app = new Application({ region });
    const view = new RootView();

    expect(app.showView(view)).to.equal(view);
    expect(app.getView()).to.be.undefined;
    expect(view.isRendered()).to.be.false;

    await app.destroy();
  });

  it('stops children before emptying its root View and completing stop', async function() {
    const events = [];
    const region = new Region({ el: '#application-root' });
    const app = new (Application.extend({
      onStop() { events.push('application:stop'); }
    }))({ region });
    const child = new (Application.extend({
      onStop() { events.push('child:stop'); }
    }))();
    const view = new (RootView.extend({
      onDestroy() { events.push('view:destroy'); }
    }))();

    app.addChildApp('child', child);
    await app.start();
    app.showView(view);

    expect(await app.stop()).to.be.true;
    expect(events).to.deep.equal([
      'child:stop',
      'view:destroy',
      'application:stop'
    ]);
    expect(app.getView()).to.be.undefined;

    await app.destroy();
    region.destroy();
  });

  it('stops a root View shown while the Application is stopped', async function() {
    const beforeStop = this.sinon.spy();
    const onStop = this.sinon.spy();
    const TestApplication = Application.extend({ onBeforeStop: beforeStop, onStop });
    const app = new TestApplication({ region: '#application-root' });
    const view = new RootView();

    app.showView(view);

    expect(await app.stop()).to.be.true;
    expect(beforeStop).to.not.have.been.called;
    expect(onStop).to.not.have.been.called;
    expect(view.isDestroyed()).to.be.true;
    expect(app.getView()).to.be.undefined;

    await app.destroy();
  });

  for (const lifecycleState of ['stopped', 'running']) {
    it(`rejects and releases its root when ${ lifecycleState } root teardown throws`, async function() {
      const error = new Error('root destroy failed');
      const onBeforeDestroy = this.sinon.stub();
      onBeforeDestroy.onFirstCall().throws(error);
      const app = new Application({ region: '#application-root' });
      const view = new (RootView.extend({ onBeforeDestroy }))();

      if (lifecycleState === 'running') {
        await app.start();
      }
      app.showView(view);

      try {
        await app.stop();
        throw new Error('Expected stop to reject.');
      } catch (actualError) {
        expect(actualError).to.equal(error);
      }

      expect(app.isRunning()).to.equal(lifecycleState === 'running');
      expect(app.getView()).to.be.undefined;
      expect(app.getRegion().hasView()).to.be.false;

      view.destroy();
      await app.destroy();
    });
  }

  it('lets root View teardown supersede stop with terminal destroy', async function() {
    const app = new Application({ region: '#application-root' });
    const view = new RootView();
    let destroy;

    view.on('destroy', () => {
      destroy = app.destroy();
    });
    await app.start();
    app.showView(view);

    expect(await app.stop()).to.be.false;
    expect(await destroy).to.be.true;
    expect(app.isDestroyed()).to.be.true;
    expect(app.getView()).to.be.undefined;
  });

  it('tears down the prior root View before restart shows a new one', async function() {
    const views = [];
    const TestApplication = Application.extend({
      region: '#application-root',
      onStart() {
        const view = new RootView();
        views.push(view);
        this.showView(view);
      }
    });
    const app = new TestApplication();

    await app.start();
    const firstView = app.getView();

    expect(await app.restart()).to.be.true;
    expect(firstView.isDestroyed()).to.be.true;
    expect(views).to.have.length(2);
    expect(app.getView()).to.equal(views[1]);

    await app.destroy();
  });

  it('tears down a stopped root View before restart starts', async function() {
    const starts = [];
    const TestApplication = Application.extend({
      region: '#application-root',
      onStart() { starts.push(this.getView()); }
    });
    const app = new TestApplication();
    const view = new RootView();

    app.showView(view);

    expect(await app.restart()).to.be.true;
    expect(view.isDestroyed()).to.be.true;
    expect(starts).to.deep.equal([undefined]);

    await app.destroy();
  });

  it('destroys a constructed Region and releases its root View ownership', async function() {
    const app = new Application({ region: '#application-root' });
    const region = app.getRegion();
    const view = new RootView();

    app.showView(view);

    expect(await app.destroy()).to.be.true;
    expect(view.isDestroyed()).to.be.true;
    expect(region.isDestroyed()).to.be.true;
    expect(app.getRegion()).to.be.undefined;
    expect(app.getView()).to.be.undefined;
  });

  for (const failure of ['_initRadio', 'initialize', 'createState', 'stateEvents']) {
    it(`destroys its constructed Region when ${ failure } throws`, function() {
      const error = new Error(`${ failure } failed`);
      let region;
      const TrackingRegion = Region.extend({
        initialize() { region = this; }
      });
      const BrokenApplication = Application.extend({
        region: '#application-root',
        regionClass: TrackingRegion,
        stateEvents: failure === 'createState' ? { change() {} } : undefined,
        [failure]() { throw error; }
      });

      expect(() => new BrokenApplication()).to.throw(error);
      expect(region.isDestroyed()).to.be.true;
    });

    it(`releases its supplied Region when ${ failure } throws`, function() {
      const error = new Error(`${ failure } failed`);
      const region = new Region({ el: '#application-root' });
      const BrokenApplication = Application.extend({
        stateEvents: failure === 'createState' ? { change() {} } : undefined,
        [failure]() { throw error; }
      });

      expect(() => new BrokenApplication({ region })).to.throw(error);
      expect(region.isDestroyed()).to.be.false;
      region.destroy();
    });
  }

  it('releases rather than destroys a borrowed Region', async function() {
    const region = new Region({ el: '#application-root' });
    const app = new Application({ region });
    const view = new RootView();

    app.showView(view);

    expect(await app.destroy()).to.be.true;
    expect(view.isDestroyed()).to.be.true;
    expect(region.isDestroyed()).to.be.false;
    expect(app.getRegion()).to.be.undefined;
    expect(app.getView()).to.be.undefined;

    region.destroy();
  });

  it('does not mount a root View once terminal teardown begins', async function() {
    const region = new Region({ el: '#application-root' });
    const lateView = new RootView();
    const TestApplication = Application.extend({
      onBeforeDestroy() {
        expect(this.getView()).to.be.undefined;
        expect(this.showView(lateView)).to.equal(lateView);
      }
    });
    const app = new TestApplication({ region });

    expect(await app.destroy()).to.be.true;
    expect(region.hasView()).to.be.false;
    expect(lateView.isRendered()).to.be.false;
    expect(app.showView(lateView)).to.equal(lateView);
    expect(region.hasView()).to.be.false;

    lateView.destroy();
    region.destroy();
  });

  it('shares reentrant lifecycle calls during direct root teardown', async function() {
    const app = new Application({ region: '#application-root' });
    const view = new RootView();
    let stop;
    let destroy;

    view.on('destroy', () => {
      stop = app.stop();
      destroy = app.destroy();
    });
    app.showView(view);

    expect(await app.destroy()).to.be.true;
    expect(await stop).to.be.true;
    expect(await destroy).to.be.true;
    expect(app.isDestroyed()).to.be.true;
    expect(app.getView()).to.be.undefined;
  });
});
