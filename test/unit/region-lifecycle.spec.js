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

  it('allows child teardown to repeat empty without aborting Region destruction', function() {
    const view = new TestView();
    const repeatedEmpty = this.sinon.spy();
    const destroy = this.sinon.spy();
    region.show(view);
    view.on('destroy', () => {
      repeatedEmpty();
      expect(region.empty()).to.equal(region);
    });
    region.on('destroy', destroy);

    expect(region.destroy()).to.equal(region);

    expect(repeatedEmpty).to.have.been.calledOnce;
    expect(destroy).to.have.been.calledOnce;
    expect(region.isDestroyed()).to.be.true;
    expect(region.hasView()).to.be.false;
    expect(view.isDestroyed()).to.be.true;
  });

  it('does not detach an occupied View once Region destruction begins', function() {
    const lifecycle = [];
    const view = new TestView();
    region.show(view);

    region.on('before:destroy', currentRegion => {
      expect(currentRegion.detachView()).to.be.undefined;
      expect(currentRegion.detachView()).to.be.undefined;
      expect(currentRegion.currentView).to.equal(view);
      expect(currentRegion.hasView()).to.be.true;
      expect(lifecycle).to.deep.equal([]);
    });
    region.on('before:empty', () => lifecycle.push('before:empty'));
    region.on('empty', () => lifecycle.push('empty'));
    view.on('before:detach', () => lifecycle.push('before:detach'));
    view.on('detach', () => lifecycle.push('detach'));
    view.on('destroy', () => lifecycle.push('destroy'));

    expect(region.destroy()).to.equal(region);

    expect(lifecycle).to.deep.equal([
      'before:empty',
      'before:detach',
      'detach',
      'destroy',
      'empty',
    ]);
    expect(region.hasView()).to.be.false;
    expect(view.isDestroyed()).to.be.true;
  });

  it('preserves a replaceElement View when terminal detach is attempted', function() {
    const view = new TestView();
    region.replaceElement = true;
    region.show(view);
    const originalEl = region.el;

    region.on('before:destroy', currentRegion => {
      expect(currentRegion.detachView()).to.be.undefined;
      expect(currentRegion.currentView).to.equal(view);
      expect(currentRegion.isReplaced()).to.be.true;
      expect(originalEl.isConnected).to.be.false;
      expect(view.el.isConnected).to.be.true;
    });

    region.destroy();

    expect(view.isDestroyed()).to.be.true;
    expect(originalEl.isConnected).to.be.true;
  });

  it('preserves ownership when terminal detach precedes a failed destroy', function() {
    const error = new Error('stop destroy');
    const view = new TestView();
    let shouldThrow = true;
    region.show(view);

    region.on('before:destroy', currentRegion => {
      expect(currentRegion.detachView()).to.be.undefined;
      if (shouldThrow) {
        shouldThrow = false;
        throw error;
      }
    });

    expect(() => region.destroy()).to.throw(error);
    expect(region.currentView).to.equal(view);
    expect(region.hasView()).to.be.true;
    expect(view.isDestroyed()).to.be.false;

    expect(region.destroy()).to.equal(region);
    expect(region.hasView()).to.be.false;
    expect(view.isDestroyed()).to.be.true;
  });

  it('authorizes only the intended reset and empty override chain during destroy', function() {
    const lifecycle = [];
    const ignored = [];
    let duringDestroy = false;
    let view;
    const captureNoop = (label, currentRegion, operation) => {
      ignored.push({
        label,
        result: operation(),
        currentView: currentRegion.currentView,
        el: currentRegion.el,
      });
    };
    const CustomRegion = Region.extend({
      reset(options) {
        if (duringDestroy) {
          lifecycle.push('reset');
          captureNoop('reset:empty', this, () => Region.prototype.empty.call(this));
        }
        return Region.prototype.reset.call(this, options);
      },
      empty(options) {
        if (duringDestroy) {
          lifecycle.push('empty');
          captureNoop('empty:reset', this, () => Region.prototype.reset.call(this));
        }
        return Region.prototype.empty.call(this, options);
      },
    });
    const customRegion = new CustomRegion({ el: '#region' });
    view = new TestView();
    customRegion.show(view);
    const occupiedEl = customRegion.el;
    customRegion.on('before:empty', currentRegion => {
      lifecycle.push('before:empty');
      captureNoop(
        'before:empty:empty',
        currentRegion,
        () => Region.prototype.empty.call(currentRegion)
      );
      captureNoop(
        'before:empty:reset',
        currentRegion,
        () => Region.prototype.reset.call(currentRegion)
      );
    });

    duringDestroy = true;
    expect(customRegion.destroy()).to.equal(customRegion);
    expect(lifecycle).to.deep.equal(['reset', 'empty', 'before:empty']);
    expect(ignored.map(({ label }) => label)).to.deep.equal([
      'reset:empty',
      'empty:reset',
      'before:empty:empty',
      'before:empty:reset',
    ]);
    for (const noop of ignored) {
      expect(noop.result).to.equal(customRegion);
      expect(noop.currentView).to.equal(view);
      expect(noop.el).to.equal(occupiedEl);
    }
    expect(customRegion.isDestroyed()).to.be.true;
    expect(customRegion.hasView()).to.be.false;
    expect(customRegion.currentView).to.be.undefined;
    expect(view.isDestroyed()).to.be.true;
  });

  it('leaves teardown behavior to a non-delegating empty override', function() {
    let overrideSymbolKeys;
    const CustomRegion = Region.extend({
      empty() {
        overrideSymbolKeys = Reflect.ownKeys(this)
          .filter(key => typeof key === 'symbol');
        return this;
      },
    });
    const customRegion = new CustomRegion({ el: '#region' });
    const view = new TestView();
    customRegion.show(view);
    const originalSymbolKeys = Reflect.ownKeys(customRegion)
      .filter(key => typeof key === 'symbol');
    this.sinon.spy(customRegion, 'empty');
    const destroy = this.sinon.spy();
    customRegion.on('destroy', destroy);

    expect(customRegion.destroy()).to.equal(customRegion);
    expect(customRegion.empty).to.have.been.calledOnce;
    expect(destroy).to.have.been.calledOnceWith(customRegion, undefined);
    expect(overrideSymbolKeys).to.deep.equal(originalSymbolKeys);
    expect(customRegion.isDestroyed()).to.be.true;
    expect(customRegion.currentView).to.equal(view);
    expect(view.isDestroyed()).to.be.false;

    const regionEl = document.querySelector('#region');
    const sentinel = document.createElement('span');
    sentinel.textContent = 'unmanaged';
    regionEl.appendChild(sentinel);
    const cachedEl = customRegion.el;
    const cached$El = { cached: true };
    customRegion.$el = cached$El;

    expect(Region.prototype.empty.call(customRegion)).to.equal(customRegion);
    expect(Region.prototype.reset.call(customRegion)).to.equal(customRegion);
    expect(Reflect.ownKeys(customRegion).filter(key => typeof key === 'symbol'))
      .to.deep.equal(originalSymbolKeys);
    expect(customRegion.el).to.equal(cachedEl);
    expect(customRegion.$el).to.equal(cached$El);
    expect(customRegion.currentView).to.equal(view);
    expect(view.isDestroyed()).to.be.false;
    expect(regionEl.childNodes).to.have.length(2);
    expect(regionEl.firstChild).to.equal(view.el);
    expect(regionEl.lastChild).to.equal(sentinel);
    expect(sentinel.textContent).to.equal('unmanaged');

    view.destroy();
  });

  for (const operation of ['reset', 'empty']) {
    const article = operation === 'empty' ? 'an' : 'a';
    it(`clears teardown authorization when ${article} ${operation} override throws`, function() {
      const error = new Error(`${operation} failed`);
      let duringDestroy = false;
      let overrideCalls = 0;
      const CustomRegion = Region.extend({
        [operation](options) {
          if (!duringDestroy) {
            return Region.prototype[operation].call(this, options);
          }
          overrideCalls += 1;
          throw error;
        },
      });
      const owner = new View({
        regions: {
          content: {
            el: '.content',
            regionClass: CustomRegion,
          },
        },
        template() {
          return '<div class="content"></div>';
        },
      });
      const view = new TestView();
      owner.render();
      const ownedRegion = owner.getRegion('content');
      ownedRegion.show(view);
      const beforeEmpty = this.sinon.spy();
      const empty = this.sinon.spy();
      const destroy = this.sinon.spy();
      ownedRegion.on('before:empty', beforeEmpty);
      ownedRegion.on('empty', empty);
      ownedRegion.on('destroy', destroy);

      let thrownError;
      try {
        duringDestroy = true;
        ownedRegion.destroy();
      } catch (caughtError) {
        thrownError = caughtError;
      }

      expect(thrownError).to.equal(error);
      expect(overrideCalls).to.equal(1);
      expect(ownedRegion.isDestroyed()).to.be.true;
      expect(ownedRegion.currentView).to.equal(view);
      expect(view.isDestroyed()).to.be.false;
      expect(owner.getRegion('content')).to.equal(ownedRegion);
      expect(owner.hasRegion('content')).to.be.true;
      expect(beforeEmpty).to.not.have.been.called;
      expect(empty).to.not.have.been.called;
      expect(destroy).to.not.have.been.called;

      const regionEl = owner.el.querySelector('.content');
      const sentinel = document.createElement('span');
      sentinel.textContent = 'unmanaged';
      regionEl.appendChild(sentinel);
      const contents = Array.from(regionEl.childNodes);
      const cachedEl = ownedRegion.el;
      const cached$El = { cached: true };
      ownedRegion.$el = cached$El;

      expect(Region.prototype.empty.call(ownedRegion)).to.equal(ownedRegion);
      expect(Region.prototype.reset.call(ownedRegion)).to.equal(ownedRegion);
      expect(ownedRegion.currentView).to.equal(view);
      expect(view.isDestroyed()).to.be.false;
      expect(owner.getRegion('content')).to.equal(ownedRegion);
      expect(ownedRegion.el).to.equal(cachedEl);
      expect(ownedRegion.$el).to.equal(cached$El);
      expect(Array.from(regionEl.childNodes)).to.deep.equal(contents);
      expect(regionEl.lastChild).to.equal(sentinel);
      expect(sentinel.textContent).to.equal('unmanaged');
      expect(beforeEmpty).to.not.have.been.called;
      expect(empty).to.not.have.been.called;
      expect(destroy).to.not.have.been.called;

      view.destroy();
      owner.destroy();
    });
  }

  it('retries destruction after before:destroy throws and cleans up ownership once', function() {
    const error = new Error('before:destroy failed');
    const firstOptions = { attempt: 1 };
    const retryOptions = { attempt: 2 };
    const lifecycle = [];
    const owner = new View({
      regions: {
        content: '.content',
      },
      template() {
        return '<div class="content"></div>';
      },
    });
    const child = new TestView();
    let beforeDestroySideEffects = 0;

    owner.render();
    const ownedRegion = owner.getRegion('content');
    ownedRegion.show(child);
    this.sinon.spy(child, 'destroy');
    this.sinon.spy(ownedRegion, 'stopListening');
    this.sinon.spy(owner, '_removeReferences');
    ownedRegion.on('before:destroy', (currentRegion, options) => {
      lifecycle.push(['region:before:destroy', options]);
      if (++beforeDestroySideEffects === 1) { throw error; }
    });
    ownedRegion.on('before:empty', () => lifecycle.push(['region:before:empty']));
    child.on('before:destroy', () => lifecycle.push(['child:before:destroy']));
    child.on('destroy', () => lifecycle.push(['child:destroy']));
    ownedRegion.on('empty', () => lifecycle.push(['region:empty']));
    ownedRegion.on('destroy', () => lifecycle.push(['region:destroy']));

    expect(() => ownedRegion.destroy(firstOptions)).to.throw(error);
    expect(ownedRegion.isDestroyed()).to.be.false;
    expect(ownedRegion.currentView).to.equal(child);
    expect(child.isDestroyed()).to.be.false;
    expect(owner.getRegion('content')).to.equal(ownedRegion);
    expect(ownedRegion.stopListening).to.not.have.been.called;
    expect(owner._removeReferences).to.not.have.been.called;

    expect(ownedRegion.destroy(retryOptions)).to.equal(ownedRegion);
    expect(ownedRegion.destroy()).to.equal(ownedRegion);
    expect(ownedRegion.isDestroyed()).to.be.true;
    expect(child.isDestroyed()).to.be.true;
    expect(owner.getRegion('content')).to.be.undefined;
    expect(beforeDestroySideEffects).to.equal(2);
    expect(lifecycle).to.deep.equal([
      ['region:before:destroy', firstOptions],
      ['region:before:destroy', retryOptions],
      ['region:before:empty'],
      ['child:before:destroy'],
      ['child:destroy'],
      ['region:empty'],
      ['region:destroy'],
    ]);
    expect(child.destroy).to.have.been.calledOnce;
    expect(ownedRegion.stopListening).to.have.been.calledOnce;
    expect(owner._removeReferences).to.have.been.calledOnceWith('content');

    owner.destroy();
  });

  it('ignores show once destruction begins before resolving or mutating ownership', function() {
    const view = new TestView();
    const destroyedView = new TestView();
    const inputRead = this.sinon.spy(() => { throw new Error('input inspected'); });
    const hostileView = new Proxy({}, { get: inputRead });
    const beforeShow = this.sinon.spy();
    const show = this.sinon.spy();

    region.on('before:show', beforeShow);
    region.on('show', show);
    this.sinon.spy(view, 'render');
    region.on('before:destroy', currentRegion => {
      expect(currentRegion.show(view)).to.equal(currentRegion);
    });

    expect(region.destroy()).to.equal(region);
    expect(region.show(view)).to.equal(region);
    expect(region.show(view)).to.equal(region);

    document.querySelector('#region').remove();
    destroyedView.destroy();

    expect(region.show(destroyedView)).to.equal(region);
    expect(region.show(hostileView)).to.equal(region);
    expect(region.isDestroyed()).to.be.true;
    expect(region.hasView()).to.be.false;
    expect(region.currentView).to.be.undefined;
    expect(beforeShow).to.not.have.been.called;
    expect(show).to.not.have.been.called;
    expect(view.render).to.not.have.been.called;
    expect(view.isRendered()).to.be.false;
    expect(view.isDestroyed()).to.be.false;
    expect(inputRead).to.not.have.been.called;
    expect(region.destroy()).to.equal(region);

    view.destroy();
  });

  it('treats detachView after destruction as an idempotent no-op', function() {
    const view = new TestView();
    region.show(view);
    region.destroy();

    const sentinel = document.createElement('span');
    sentinel.textContent = 'unmanaged';
    const regionEl = document.querySelector('#region');
    regionEl.appendChild(sentinel);
    const beforeEmpty = this.sinon.spy();
    const empty = this.sinon.spy();
    region.on('before:empty', beforeEmpty);
    region.on('empty', empty);

    expect(region.detachView()).to.be.undefined;
    expect(region.detachView()).to.be.undefined;
    expect(region.isDestroyed()).to.be.true;
    expect(region.hasView()).to.be.false;
    expect(region.currentView).to.be.undefined;
    expect(regionEl.childNodes).to.have.length(1);
    expect(regionEl.firstChild).to.equal(sentinel);
    expect(sentinel.textContent).to.equal('unmanaged');
    expect(beforeEmpty).to.not.have.been.called;
    expect(empty).to.not.have.been.called;
  });

  it('does not expose an _emptyRegion helper on Region instances', function() {
    const view = new TestView();
    region.show(view);
    region.destroy();

    expect(Region.prototype).not.to.have.own.property('_emptyRegion');
    expect(region._emptyRegion).to.be.undefined;
  });

  for (const operation of ['empty', 'reset']) {
    it(`ignores ${operation} after destruction without changing lifecycle state`, function() {
      const owner = new View({
        regions: {
          content: '.content',
        },
        template() {
          return '<div class="content"></div>';
        },
      });
      const view = new TestView();
      owner.render();
      const ownedRegion = owner.getRegion('content');
      ownedRegion.show(view);
      ownedRegion.destroy();

      const regionEl = owner.el.querySelector('.content');
      const sentinel = document.createElement('span');
      sentinel.textContent = 'unmanaged';
      regionEl.appendChild(sentinel);
      const cachedEl = ownedRegion.el;
      const cached$El = { cached: true };
      ownedRegion.$el = cached$El;
      const beforeEmpty = this.sinon.spy();
      const empty = this.sinon.spy();
      ownedRegion.on('before:empty', beforeEmpty);
      ownedRegion.on('empty', empty);
      this.sinon.spy(ownedRegion, 'getEl');

      expect(ownedRegion[operation]()).to.equal(ownedRegion);
      expect(ownedRegion[operation]()).to.equal(ownedRegion);
      expect(ownedRegion.isDestroyed()).to.be.true;
      expect(ownedRegion.hasView()).to.be.false;
      expect(ownedRegion.currentView).to.be.undefined;
      expect(ownedRegion.el).to.equal(cachedEl);
      expect(ownedRegion.$el).to.equal(cached$El);
      expect(ownedRegion.getEl).to.not.have.been.called;
      expect(regionEl.childNodes).to.have.length(1);
      expect(regionEl.firstChild).to.equal(sentinel);
      expect(sentinel.textContent).to.equal('unmanaged');
      expect(beforeEmpty).to.not.have.been.called;
      expect(empty).to.not.have.been.called;
      expect(view.isDestroyed()).to.be.true;
      expect(owner.hasRegion('content')).to.be.false;
      expect(owner.getRegion('content')).to.be.undefined;
      expect(owner.regions).not.to.have.own.property('content');
      expect(owner._regions).not.to.have.own.property('content');

      owner.destroy();
    });
  }

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
