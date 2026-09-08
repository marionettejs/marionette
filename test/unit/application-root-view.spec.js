import { vi, describe, it, expect, beforeEach } from 'vitest';
import { setFixtures } from '../setup/fixtures.js';
'use strict';

import _ from 'underscore';

import { Application } from 'marionette';
import { Region } from 'marionette';
import { View } from 'marionette';

const RootView = View.extend({
  template: _.template('<span>root</span>')
});

describe('Application root View ownership', function() {
  beforeEach(function() {
    setFixtures('<div id="application-root"></div>');
  });

  it('shows and reads the current View of its Region', function() {
    const region = new Region({ el: '#application-root' });
    const app = new Application({ region });
    const view = new RootView();
    const show = vi.spyOn(region, 'show');

    expect(app.getView()).toBeUndefined();
    expect(app.showView(view)).to.equal(view);
    expect(show).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledWith(view);
    expect(app.getRegion()).to.equal(region);
    expect(app.getView()).to.equal(view);
    expect(app.showView(view)).to.equal(view);
    expect(show).toHaveBeenCalledTimes(2);

    region.destroy();
  });

  it('leaves unmanaged HTML alone when the Region has no View', async function() {
    const region = new Region({ el: document.querySelector('#application-root') });
    region.el.innerHTML = '<span>Unmanaged content</span>';
    const app = new Application({ region });

    expect(await app.stop()).toBe(true);
    expect(app.getView()).toBeUndefined();
    expect(region.el.innerHTML).to.equal('<span>Unmanaged content</span>');

    await app.destroy();
    region.destroy();
  });

  it('reads and stops a View already shown before the Region is supplied', async function() {
    const region = new Region({ el: '#application-root' });
    const view = new RootView();
    region.show(view);
    const app = new Application({ region });

    expect(app.getView()).to.equal(view);
    expect(await app.stop()).toBe(true);
    expect(view.isDestroyed()).toBe(true);
    expect(app.getView()).toBeUndefined();

    await app.destroy();
    region.destroy();
  });

  it('clears its View when a borrowed Region is emptied externally', async function() {
    const region = new Region({ el: '#application-root' });
    const app = new Application({ region });
    const view = new RootView();

    await app.start();
    app.showView(view);
    region.empty();

    expect(view.isDestroyed()).toBe(true);
    expect(app.isRunning()).toBe(true);
    expect(app.getView()).toBeUndefined();

    await app.stop();
    expect(region.hasView()).toBe(false);

    await app.destroy();
    region.destroy();
  });

  it('reads and empties an externally shown replacement View', async function() {
    const region = new Region({ el: '#application-root' });
    const app = new Application({ region });
    const rootView = new RootView();
    const replacement = new RootView();

    await app.start();
    app.showView(rootView);
    region.show(replacement);

    expect(rootView.isDestroyed()).toBe(true);
    expect(app.getView()).to.equal(replacement);
    expect(region.currentView).to.equal(replacement);

    await app.stop();
    expect(region.currentView).toBeUndefined();
    expect(replacement.isDestroyed()).toBe(true);
    expect(app.getView()).toBeUndefined();

    await app.destroy();
    expect(region.isDestroyed()).toBe(false);
    region.destroy();
  });

  it('does not let a detached prior root clear the current root later', async function() {
    const region = new Region({ el: '#application-root' });
    const app = new Application({ region });
    const firstView = new RootView();
    const secondView = new RootView();

    app.showView(firstView);
    expect(region.detachView()).to.equal(firstView);
    expect(app.getView()).toBeUndefined();

    app.showView(secondView);
    firstView.destroy();

    expect(app.getView()).to.equal(secondView);
    expect(await app.stop()).toBe(true);
    expect(secondView.isDestroyed()).toBe(true);
    expect(app.getView()).toBeUndefined();

    await app.destroy();
    region.destroy();
  });

  it('empties a later externally shown View when stopped again', async function() {
    const region = new Region({ el: '#application-root' });
    const app = new Application({ region });
    await app.start();
    await app.stop();

    const view = new RootView();
    region.show(view);
    expect(app.getView()).to.equal(view);
    expect(await app.stop()).toBe(true);
    expect(view.isDestroyed()).toBe(true);
    expect(app.getView()).toBeUndefined();

    await app.destroy();
    region.destroy();
  });

  it('reads and empties a detached View re-shown externally', async function() {
    const region = new Region({ el: '#application-root' });
    const app = new Application({ region });
    const view = new RootView();

    app.showView(view);
    expect(region.detachView()).to.equal(view);
    region.show(view);

    expect(app.getView()).to.equal(view);
    expect(await app.stop()).toBe(true);
    expect(region.currentView).toBeUndefined();
    expect(view.isDestroyed()).toBe(true);

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
    expect(app.getView()).toBeUndefined();
    expect(view.isRendered()).toBe(false);

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

    expect(await app.stop()).toBe(true);
    expect(events).to.deep.equal([
      'child:stop',
      'view:destroy',
      'application:stop'
    ]);
    expect(app.getView()).toBeUndefined();

    await app.destroy();
    region.destroy();
  });

  it('stops a root View shown while the Application is stopped', async function() {
    const beforeStop = vi.fn();
    const onStop = vi.fn();
    const TestApplication = Application.extend({ onBeforeStop: beforeStop, onStop });
    const app = new TestApplication({ region: '#application-root' });
    const view = new RootView();

    app.showView(view);

    expect(await app.stop()).toBe(true);
    expect(beforeStop).not.toHaveBeenCalled();
    expect(onStop).not.toHaveBeenCalled();
    expect(view.isDestroyed()).toBe(true);
    expect(app.getView()).toBeUndefined();

    await app.destroy();
  });

  for (const lifecycleState of ['stopped', 'running']) {
    it(`rejects and releases its root when ${ lifecycleState } root teardown throws`, async function() {
      const error = new Error('root destroy failed');
      const onBeforeDestroy = vi.fn();
      onBeforeDestroy.mockImplementationOnce(() => { throw error; });
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
      expect(app.getView()).toBeUndefined();
      expect(app.getRegion().hasView()).toBe(false);

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

    expect(await app.stop()).toBe(false);
    expect(await destroy).toBe(true);
    expect(app.isDestroyed()).toBe(true);
    expect(app.getView()).toBeUndefined();
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

    expect(await app.restart()).toBe(true);
    expect(firstView.isDestroyed()).toBe(true);
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

    app.getRegion().show(view);

    expect(await app.restart()).toBe(true);
    expect(view.isDestroyed()).toBe(true);
    expect(starts).to.deep.equal([undefined]);

    await app.destroy();
  });

  it('destroys a constructed Region and releases its root View ownership', async function() {
    const app = new Application({ region: '#application-root' });
    const region = app.getRegion();
    const view = new RootView();

    app.showView(view);

    expect(await app.destroy()).toBe(true);
    expect(view.isDestroyed()).toBe(true);
    expect(region.isDestroyed()).toBe(true);
    expect(app.getRegion()).toBeUndefined();
    expect(app.getView()).toBeUndefined();
  });

  for (const failure of ['channelName', 'initialize', 'createState', 'stateEvents']) {

    it(`releases its supplied Region when ${ failure } throws`, function() {
      const error = new Error(`${ failure } failed`);
      const region = new Region({ el: '#application-root' });
      const BrokenApplication = Application.extend({
        stateEvents: failure === 'createState' ? { change() {} } : undefined,
        [failure]() { throw error; }
      });

      expect(() => new BrokenApplication({ region })).to.throw(error);
      expect(region.isDestroyed()).toBe(false);
      region.destroy();
    });
  }

  it('destroys an externally shown View but preserves its borrowed Region', async function() {
    const region = new Region({ el: '#application-root' });
    const app = new Application({ region });
    const view = new RootView();

    region.show(view);

    expect(await app.destroy()).toBe(true);
    expect(view.isDestroyed()).toBe(true);
    expect(region.isDestroyed()).toBe(false);
    expect(app.getRegion()).toBeUndefined();
    expect(app.getView()).toBeUndefined();

    region.destroy();
  });

  it('does not mount a root View once terminal teardown begins', async function() {
    const region = new Region({ el: '#application-root' });
    const lateView = new RootView();
    const TestApplication = Application.extend({
      onBeforeDestroy() {
        expect(this.getView()).toBeUndefined();
        expect(this.showView(lateView)).to.equal(lateView);
      }
    });
    const app = new TestApplication({ region });

    expect(await app.destroy()).toBe(true);
    expect(region.hasView()).toBe(false);
    expect(lateView.isRendered()).toBe(false);
    expect(app.showView(lateView)).to.equal(lateView);
    expect(region.hasView()).toBe(false);

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

    expect(await app.destroy()).toBe(true);
    expect(await stop).toBe(true);
    expect(await destroy).toBe(true);
    expect(app.isDestroyed()).toBe(true);
    expect(app.getView()).toBeUndefined();
  });

  it('preserves an external replacement in a borrowed Region when construction fails', function() {
    const region = new Region({ el: '#application-root' });
    const root = new RootView();
    const replacement = new RootView();
    const failure = new Error('owner initialization failed');
    const Owner = Application.extend({
      initialize() {
        this.showView(root);
        region.show(replacement);
        throw failure;
      }
    });

    try {
      expect(() => new Owner({ region })).to.throw(failure);
      expect(root.isDestroyed()).toBe(true);
      expect(region.currentView).to.equal(replacement);
      expect(replacement.isDestroyed()).toBe(false);
      expect(region.isDestroyed()).toBe(false);
    } finally {
      region.destroy();
    }
  });

});
