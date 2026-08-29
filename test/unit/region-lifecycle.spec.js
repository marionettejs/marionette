import _ from 'underscore';

import Region from '../../modules/region';
import View from '../../modules/view';

describe('Region lifecycle contract', function() {
  'use strict';

  let region;

  const TestView = View.extend({
    template: _.template('<span>content</span>')
  });

  function state() {
    return {
      hasView: region.hasView(),
      destroyed: region.isDestroyed(),
      currentView: region.currentView,
    };
  }

  beforeEach(function() {
    this.setFixtures('<div id="region"></div>');
    region = new Region({ el: '#region' });
  });

  it('moves through empty, occupied, detached, and destroyed states', function() {
    const view = new TestView();
    this.sinon.spy(view, 'render');

    expect(state()).to.deep.equal({
      hasView: false,
      destroyed: false,
      currentView: undefined,
    });

    expect(region.show(view)).to.equal(region);
    expect(state()).to.deep.equal({
      hasView: true,
      destroyed: false,
      currentView: view,
    });
    expect(view.render).to.have.been.calledOnce;

    expect(region.show(view)).to.equal(region);
    expect(view.render).to.have.been.calledOnce;

    expect(region.detachView()).to.equal(view);
    expect(region.detachView()).to.be.undefined;
    expect(state()).to.deep.equal({
      hasView: false,
      destroyed: false,
      currentView: undefined,
    });

    expect(region.show(view)).to.equal(region);
    expect(view.render).to.have.been.calledOnce;

    expect(region.destroy()).to.equal(region);
    expect(state()).to.deep.equal({
      hasView: false,
      destroyed: true,
      currentView: undefined,
    });
  });

  it('stays empty when a missing element is allowed', function() {
    const missingRegion = new Region({
      el: '#missing',
      allowMissingEl: true,
    });
    const view = new TestView();

    expect(missingRegion.show(view)).to.be.undefined;
    expect(missingRegion.hasView()).to.be.false;
    expect(view.isRendered()).to.be.false;
  });

  it('treats repeated show, empty, and destroy operations deterministically', function() {
    const lifecycle = [];
    const view = new TestView();

    region.on('before:show', () => lifecycle.push('before:show'));
    region.on('show', () => lifecycle.push('show'));
    region.on('before:empty', () => lifecycle.push('before:empty'));
    region.on('empty', () => lifecycle.push('empty'));
    region.on('before:destroy', () => lifecycle.push('before:destroy'));
    region.on('destroy', () => lifecycle.push('destroy'));

    region.show(view);
    region.show(view);
    expect(lifecycle).to.deep.equal(['before:show', 'show']);

    expect(region.empty()).to.equal(region);
    expect(region.empty()).to.equal(region);
    expect(lifecycle).to.deep.equal([
      'before:show',
      'show',
      'before:empty',
      'empty',
    ]);

    expect(region.destroy()).to.equal(region);
    expect(region.destroy()).to.equal(region);
    expect(lifecycle).to.deep.equal([
      'before:show',
      'show',
      'before:empty',
      'empty',
      'before:destroy',
      'destroy',
    ]);
  });

  it('reports swapping throughout replacement lifecycle callbacks', function() {
    const lifecycle = [];
    const firstView = new TestView();
    const secondView = new TestView();

    region.on('before:show', (currentRegion, view) => {
      lifecycle.push(`before:show:${view.cid}:${currentRegion.isSwappingView()}`);
    });
    region.on('before:empty', (currentRegion, view) => {
      lifecycle.push(`before:empty:${view.cid}:${currentRegion.isSwappingView()}`);
    });
    region.on('empty', (currentRegion, view) => {
      lifecycle.push(`empty:${view.cid}:${currentRegion.isSwappingView()}`);
    });
    region.on('show', (currentRegion, view) => {
      lifecycle.push(`show:${view.cid}:${currentRegion.isSwappingView()}`);
    });

    region.show(firstView);
    lifecycle.length = 0;
    region.show(secondView);

    expect(lifecycle).to.deep.equal([
      `before:show:${secondView.cid}:true`,
      `before:empty:${firstView.cid}:true`,
      `empty:${firstView.cid}:true`,
      `show:${secondView.cid}:true`,
    ]);
    expect(firstView.isDestroyed()).to.be.true;
    expect(region.currentView).to.equal(secondView);
    expect(region.isSwappingView()).to.be.false;
  });

  it('reports replacement independently from its lifecycle state', function() {
    const view = new TestView();
    region.replaceElement = true;

    expect(region.isReplaced()).to.be.false;
    region.show(view);
    expect(region.isReplaced()).to.be.true;
    expect(region.hasView()).to.be.true;

    expect(region.detachView()).to.equal(view);
    expect(region.isReplaced()).to.be.false;
    expect(region.hasView()).to.be.false;
  });

  it('destroys an occupied Region in public lifecycle order', function() {
    const lifecycle = [];
    const view = new TestView();
    region.show(view);

    region.on('before:destroy', currentRegion => {
      lifecycle.push(`region:before:destroy:${currentRegion.isDestroyed()}`);
    });
    region.on('before:empty', currentRegion => {
      lifecycle.push(`region:before:empty:${currentRegion.isDestroyed()}`);
    });
    view.on('before:destroy', () => lifecycle.push('view:before:destroy'));
    view.on('destroy', () => lifecycle.push('view:destroy'));
    region.on('empty', currentRegion => {
      lifecycle.push(`region:empty:${currentRegion.isDestroyed()}`);
    });
    region.on('destroy', currentRegion => {
      lifecycle.push(`region:destroy:${currentRegion.isDestroyed()}`);
    });

    region.destroy();

    expect(lifecycle).to.deep.equal([
      'region:before:destroy:false',
      'region:before:empty:true',
      'view:before:destroy',
      'view:destroy',
      'region:empty:true',
      'region:destroy:true',
    ]);
    expect(region.hasView()).to.be.false;
    expect(region.isDestroyed()).to.be.true;
  });

  it('does not restart destruction after before:destroy throws', function() {
    const error = new Error('before:destroy failed');
    const beforeDestroy = this.sinon.stub().throws(error);
    region.on('before:destroy', beforeDestroy);

    expect(() => region.destroy()).to.throw(error);
    expect(region.isDestroyed()).to.be.false;
    expect(region.destroy()).to.equal(region);
    expect(beforeDestroy).to.have.been.calledOnceWith(region, undefined);
  });

  it('clears the Region once when its current View is destroyed externally', function() {
    const view = new TestView();
    const beforeEmpty = this.sinon.spy();
    const empty = this.sinon.spy();

    region.on('before:empty', beforeEmpty);
    region.on('empty', empty);
    region.show(view);

    view.destroy();
    view.destroy();

    expect(beforeEmpty).to.have.been.calledOnceWith(region, view);
    expect(empty).to.have.been.calledOnceWith(region, view);
    expect(region.hasView()).to.be.false;
    expect(region.currentView).to.be.undefined;
  });

  it('unlinks a reentrantly destroyed owned Region without repeating teardown', function() {
    const owner = new View({
      regions: {
        content: '.content',
      },
      template() {
        return '<div class="content"></div>';
      },
    });
    const child = new TestView();
    let beforeDestroyReturn;
    let destroyReturn;
    let reenteredBeforeDestroy = false;
    let reenteredDestroy = false;
    const regionLifecycle = {
      beforeDestroy: this.sinon.spy(currentRegion => {
        if (reenteredBeforeDestroy) { return; }
        reenteredBeforeDestroy = true;
        beforeDestroyReturn = currentRegion.destroy();
      }),
      beforeEmpty: this.sinon.spy(),
      empty: this.sinon.spy(),
      destroy: this.sinon.spy(currentRegion => {
        if (reenteredDestroy) { return; }
        reenteredDestroy = true;
        destroyReturn = currentRegion.destroy();
      }),
    };
    const childLifecycle = {
      beforeDestroy: this.sinon.spy(),
      destroy: this.sinon.spy(),
    };

    owner.render();
    const ownedRegion = owner.getRegion('content');
    ownedRegion.on('before:destroy', regionLifecycle.beforeDestroy);
    ownedRegion.on('before:empty', regionLifecycle.beforeEmpty);
    ownedRegion.on('empty', regionLifecycle.empty);
    ownedRegion.on('destroy', regionLifecycle.destroy);
    child.on('before:destroy', childLifecycle.beforeDestroy);
    child.on('destroy', childLifecycle.destroy);
    ownedRegion.show(child);

    expect(owner.getRegion('content')).to.equal(ownedRegion);
    expect(owner.hasRegion('content')).to.be.true;
    expect(ownedRegion.currentView).to.equal(child);

    expect(ownedRegion.destroy()).to.equal(ownedRegion);
    expect(ownedRegion.destroy()).to.equal(ownedRegion);
    expect(beforeDestroyReturn).to.equal(ownedRegion);
    expect(destroyReturn).to.equal(ownedRegion);

    expect(ownedRegion.isDestroyed()).to.be.true;
    expect(ownedRegion.hasView()).to.be.false;
    expect(ownedRegion.currentView).to.be.undefined;
    expect(child.isDestroyed()).to.be.true;
    expect(owner.getRegion('content')).to.be.undefined;
    expect(owner.hasRegion('content')).to.be.false;
    expect(owner.getRegions()).not.to.have.own.property('content');

    expect(owner.destroy()).to.equal(owner);
    expect(owner.destroy()).to.equal(owner);

    for (const lifecycle of [regionLifecycle, childLifecycle]) {
      for (const callback of Object.values(lifecycle)) {
        expect(callback).to.have.been.calledOnce;
      }
    }
  });
});
