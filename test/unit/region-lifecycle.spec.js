import { vi, describe, it, expect, beforeEach } from 'vitest';
import { setFixtures } from '../setup/fixtures.js';
import _ from 'underscore';

import { CollectionView, Region, View } from 'marionette';
import { MarionetteError } from '@marionette/utils';

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
    setFixtures('<div id="region"></div>');
    region = new Region({ el: '#region' });
  });

  it('moves through empty, occupied, detached, and destroyed states', function() {
    const view = new TestView();
    vi.spyOn(view, 'render');

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
    expect(view.render).toHaveBeenCalledTimes(1);

    expect(region.show(view)).to.equal(region);
    expect(view.render).toHaveBeenCalledTimes(1);

    expect(region.detachView()).to.equal(view);
    expect(region.detachView()).toBeUndefined();
    expect(state()).to.deep.equal({
      hasView: false,
      destroyed: false,
      currentView: undefined,
    });

    expect(region.show(view)).to.equal(region);
    expect(view.render).toHaveBeenCalledTimes(1);

    expect(region.destroy()).to.equal(region);
    expect(state()).to.deep.equal({
      hasView: false,
      destroyed: true,
      currentView: undefined,
    });
  });

  it('reads Region ownership without rendering or mutating it', function() {
    expect(region.getOwner()).toBeUndefined();
    expect(region.getName()).toBeUndefined();

    const owner = new View({
      regions: {
        constructor: '.declared',
      },
      template() {
        return '<div class="declared"></div><div class="dynamic"></div>';
      },
    });
    vi.spyOn(owner, 'render');
    const declaredRegion = owner.getRegion('constructor');
    const dynamicRegion = owner.addRegion('toString', '.dynamic');

    expect(declaredRegion.getOwner()).to.equal(owner);
    expect(declaredRegion.getName()).to.equal('constructor');
    expect(dynamicRegion.getOwner()).to.equal(owner);
    expect(dynamicRegion.getName()).to.equal('toString');
    expect(owner.isRendered()).toBe(false);
    expect(owner.render).not.toHaveBeenCalled();

    owner.destroy();

    expect(declaredRegion.getOwner()).toBeUndefined();
    expect(declaredRegion.getName()).toBeUndefined();
    expect(dynamicRegion.getOwner()).toBeUndefined();
    expect(dynamicRegion.getName()).toBeUndefined();
  });

  it('rejects an empty Region name before changing ownership', function() {
    const owner = new View();

    expect(() => owner.addRegion('', region)).to.throw(MarionetteError).and.include({
      code: 'MN0032',
      name: 'RegionError',
    });
    expect(region.getOwner()).toBeUndefined();
    expect(region.getName()).toBeUndefined();

    owner.destroy();
  });

  it('clears ownership when a View removes its Region', function() {
    const owner = new View();
    const ownedRegion = owner.addRegion('content', region);

    expect(owner.removeRegion('content')).to.equal(ownedRegion);
    expect(ownedRegion.getOwner()).toBeUndefined();
    expect(ownedRegion.getName()).toBeUndefined();
  });

  it('keeps an identical registration as a no-op while destruction is in progress', function() {
    const owner = new View();
    const ownedRegion = owner.addRegion('content', region);

    ownedRegion.once('before:destroy', currentRegion => {
      expect(owner.addRegion('content', currentRegion)).to.equal(currentRegion);
      expect(currentRegion.getOwner()).to.equal(owner);
      expect(currentRegion.getName()).to.equal('content');
    });

    ownedRegion.destroy();

    expect(ownedRegion.getOwner()).toBeUndefined();
    expect(ownedRegion.getName()).toBeUndefined();
    expect(owner.hasRegion('content')).toBe(false);
  });

  it('keeps the CollectionView empty Region unnamed and clears its owner', function() {
    const collectionView = new CollectionView();
    const emptyRegion = collectionView.getEmptyRegion();

    expect(emptyRegion.getOwner()).to.equal(collectionView);
    expect(emptyRegion.getName()).toBeUndefined();

    collectionView.destroy();

    expect(emptyRegion.getOwner()).toBeUndefined();
    expect(emptyRegion.getName()).toBeUndefined();
  });

  it('stays empty when a missing element is allowed', function() {
    const missingRegion = new Region({
      el: '#missing',
      allowMissingEl: true,
    });
    const view = new TestView();

    expect(missingRegion.show(view)).toBeUndefined();
    expect(missingRegion.hasView()).toBe(false);
    expect(view.isRendered()).toBe(false);
  });

  it('shows a View in template content without reporting attachment', function() {
    const template = document.createElement('template');
    template.innerHTML = '<section></section>';
    const templateRegion = new Region({ el: template.content.firstElementChild });
    const view = new TestView();
    const attach = vi.fn();
    view.on('attach', attach);

    expect(templateRegion.el.ownerDocument.documentElement).toBeNull();
    expect(templateRegion.show(view)).to.equal(templateRegion);
    expect(templateRegion.el.contains(view.el)).toBe(true);
    expect(view.isAttached()).toBe(false);
    expect(attach).not.toHaveBeenCalled();

    templateRegion.destroy();
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
    expect(firstView.isDestroyed()).toBe(true);
    expect(region.currentView).to.equal(secondView);
    expect(region.isSwappingView()).toBe(false);
  });

  it('reports replacement independently from its lifecycle state', function() {
    const view = new TestView();
    region.replaceElement = true;

    expect(region.isReplaced()).toBe(false);
    region.show(view);
    expect(region.isReplaced()).toBe(true);
    expect(region.hasView()).toBe(true);

    expect(region.detachView()).to.equal(view);
    expect(region.isReplaced()).toBe(false);
    expect(region.hasView()).toBe(false);
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
      'region:before:empty:false',
      'view:before:destroy',
      'view:destroy',
      'region:empty:false',
      'region:destroy:true',
    ]);
    expect(region.hasView()).toBe(false);
    expect(region.isDestroyed()).toBe(true);
  });

  it('allows child teardown to repeat empty without aborting Region destruction', function() {
    const view = new TestView();
    const repeatedEmpty = vi.fn();
    const destroy = vi.fn();
    region.show(view);
    view.on('destroy', () => {
      repeatedEmpty();
      expect(region.empty()).to.equal(region);
    });
    region.on('destroy', destroy);

    expect(region.destroy()).to.equal(region);

    expect(repeatedEmpty).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(region.isDestroyed()).toBe(true);
    expect(region.hasView()).toBe(false);
    expect(view.isDestroyed()).toBe(true);
  });

  it('does not detach an occupied View once Region destruction begins', function() {
    const lifecycle = [];
    const view = new TestView();
    region.show(view);

    region.on('before:destroy', currentRegion => {
      expect(currentRegion.detachView()).toBeUndefined();
      expect(currentRegion.detachView()).toBeUndefined();
      expect(currentRegion.currentView).to.equal(view);
      expect(currentRegion.hasView()).toBe(true);
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
    expect(region.hasView()).toBe(false);
    expect(view.isDestroyed()).toBe(true);
  });

  it('preserves a replaceElement View when terminal detach is attempted', function() {
    const view = new TestView();
    region.replaceElement = true;
    region.show(view);
    const originalEl = region.el;

    region.on('before:destroy', currentRegion => {
      expect(currentRegion.detachView()).toBeUndefined();
      expect(currentRegion.currentView).to.equal(view);
      expect(currentRegion.isReplaced()).toBe(true);
      expect(originalEl.isConnected).toBe(false);
      expect(view.el.isConnected).toBe(true);
    });

    region.destroy();

    expect(view.isDestroyed()).toBe(true);
    expect(originalEl.isConnected).toBe(true);
  });

  it('does not detach through an owner while its Region is destroying', function() {
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
    ownedRegion.on('before:destroy', currentRegion => {
      expect(owner.detachChildView('content')).toBeUndefined();
      expect(currentRegion.currentView).to.equal(view);
    });

    ownedRegion.destroy();

    expect(view.isDestroyed()).toBe(true);
    expect(owner.getRegion('content')).toBeUndefined();
    owner.destroy();
  });

  for (const delegateReset of [true, false]) {
    it(`runs reset and empty overrides during destruction (${delegateReset ? 'delegated' : 'custom'} reset)`, function() {
      const lifecycle = [];
      const CustomRegion = Region.extend({
        reset(options) {
          lifecycle.push(['reset', this.isDestroyed()]);
          if (delegateReset) { return Region.prototype.reset.call(this, options); }
          this.empty(options);
          this.el = '#region';
          return this;
        },
        empty(options) {
          lifecycle.push(['empty', this.isDestroyed()]);
          return Region.prototype.empty.call(this, options);
        }
      });
      const customRegion = new CustomRegion({ el: '#region' });
      const view = new TestView();
      customRegion.show(view);
      lifecycle.length = 0;
      customRegion.on('destroy', () => lifecycle.push(['destroy', customRegion.isDestroyed()]));

      customRegion.destroy();

      expect(lifecycle).to.deep.equal([['reset', false], ['empty', false], ['destroy', true]]);
      expect(view.isDestroyed()).toBe(true);
      expect(customRegion.hasView()).toBe(false);
    });
  }

  it('allows before:destroy to empty the Region without repeating child destruction', function() {
    const view = new TestView();
    region.show(view);
    const destroy = vi.spyOn(view, 'destroy');
    const empty = vi.fn();
    region.on('before:destroy', () => region.empty());
    region.on('empty', empty);

    region.destroy();

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(empty).toHaveBeenCalledTimes(1);
    expect(region.isDestroyed()).toBe(true);
    expect(region.hasView()).toBe(false);
  });

  it('does not complete or retry destruction when child cleanup throws', function() {
    const error = new Error('cleanup failed');
    const view = new TestView();
    const other = new TestView();
    const beforeEmpty = vi.fn(() => { throw error; });
    const destroyed = vi.fn();
    region.show(view);
    region.on('before:empty', beforeEmpty);
    region.on('destroy', destroyed);

    expect(() => region.destroy()).to.throw(error);
    expect(region.isDestroyed()).toBe(false);
    expect(destroyed).not.toHaveBeenCalled();
    expect(region.destroy()).to.equal(region);
    expect(beforeEmpty).toHaveBeenCalledTimes(1);
    expect(region.show(other)).to.equal(region);
    expect(region.currentView).to.equal(view);
    expect(other.isRendered()).toBe(false);
    expect(region.detachView()).toBeUndefined();

    region.off('before:empty', beforeEmpty);
    view.destroy();
    other.destroy();
  });

  it('leaves teardown behavior to a non-delegating empty override', function() {
    const CustomRegion = Region.extend({
      empty() {
        return this;
      },
    });
    const customRegion = new CustomRegion({ el: '#region' });
    const view = new TestView();
    customRegion.show(view);
    vi.spyOn(customRegion, 'empty');
    const destroy = vi.fn();
    customRegion.on('destroy', destroy);

    expect(customRegion.destroy()).to.equal(customRegion);
    expect(customRegion.empty).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(destroy.mock.calls.map(args => args.slice(0, 2))).toContainEqual([customRegion, undefined]);
    expect(customRegion.isDestroyed()).toBe(true);
    expect(customRegion.currentView).to.equal(view);
    expect(view.isDestroyed()).toBe(false);

    const regionEl = document.querySelector('#region');
    const sentinel = document.createElement('span');
    sentinel.textContent = 'unmanaged';
    regionEl.appendChild(sentinel);
    const cachedEl = customRegion.el;
    const cached$El = { cached: true };
    customRegion.$el = cached$El;

    expect(Region.prototype.empty.call(customRegion)).to.equal(customRegion);
    expect(Region.prototype.reset.call(customRegion)).to.equal(customRegion);
    expect(customRegion.el).to.equal(cachedEl);
    expect(customRegion.$el).to.equal(cached$El);
    expect(customRegion.currentView).to.equal(view);
    expect(view.isDestroyed()).toBe(false);
    expect(regionEl.childNodes).to.have.length(2);
    expect(regionEl.firstChild).to.equal(view.el);
    expect(regionEl.lastChild).to.equal(sentinel);
    expect(sentinel.textContent).to.equal('unmanaged');

    view.destroy();
  });

  it('ignores show once destruction begins before resolving or mutating ownership', function() {
    const view = new TestView();
    const destroyedView = new TestView();
    const inputRead = vi.fn(() => { throw new Error('input inspected'); });
    const hostileView = new Proxy({}, { get: inputRead });
    const beforeShow = vi.fn();
    const show = vi.fn();

    region.on('before:show', beforeShow);
    region.on('show', show);
    vi.spyOn(view, 'render');
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
    expect(region.isDestroyed()).toBe(true);
    expect(region.hasView()).toBe(false);
    expect(region.currentView).toBeUndefined();
    expect(beforeShow).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
    expect(view.render).not.toHaveBeenCalled();
    expect(view.isRendered()).toBe(false);
    expect(view.isDestroyed()).toBe(false);
    expect(inputRead).not.toHaveBeenCalled();
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
    const beforeEmpty = vi.fn();
    const empty = vi.fn();
    region.on('before:empty', beforeEmpty);
    region.on('empty', empty);

    expect(region.detachView()).toBeUndefined();
    expect(region.detachView()).toBeUndefined();
    expect(region.isDestroyed()).toBe(true);
    expect(region.hasView()).toBe(false);
    expect(region.currentView).toBeUndefined();
    expect(regionEl.childNodes).to.have.length(1);
    expect(regionEl.firstChild).to.equal(sentinel);
    expect(sentinel.textContent).to.equal('unmanaged');
    expect(beforeEmpty).not.toHaveBeenCalled();
    expect(empty).not.toHaveBeenCalled();
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
      const beforeEmpty = vi.fn();
      const empty = vi.fn();
      ownedRegion.on('before:empty', beforeEmpty);
      ownedRegion.on('empty', empty);
      vi.spyOn(ownedRegion, 'getEl');

      expect(ownedRegion[operation]()).to.equal(ownedRegion);
      expect(ownedRegion[operation]()).to.equal(ownedRegion);
      expect(ownedRegion.isDestroyed()).toBe(true);
      expect(ownedRegion.hasView()).toBe(false);
      expect(ownedRegion.currentView).toBeUndefined();
      expect(ownedRegion.el).to.equal(cachedEl);
      expect(ownedRegion.$el).to.equal(cached$El);
      expect(ownedRegion.getEl).not.toHaveBeenCalled();
      expect(regionEl.childNodes).to.have.length(1);
      expect(regionEl.firstChild).to.equal(sentinel);
      expect(sentinel.textContent).to.equal('unmanaged');
      expect(beforeEmpty).not.toHaveBeenCalled();
      expect(empty).not.toHaveBeenCalled();
      expect(view.isDestroyed()).toBe(true);
      expect(owner.hasRegion('content')).toBe(false);
      expect(owner.getRegion('content')).toBeUndefined();
      expect(owner.regions).not.to.have.own.property('content');

      owner.destroy();
    });
  }

  it('releases parent listeners when shown children destroy themselves', function() {
    const lifecycle = [];
    const ping = vi.fn();
    const prefixedPing = vi.fn();
    const owner = new View({
      template: () => '<div class="content"></div>',
      regions: { content: '.content' },
      childViewEvents: {
        ping,
        'before:destroy': () => lifecycle.push('before:destroy'),
        destroy: () => lifecycle.push('destroy')
      },
      childViewEventPrefix: 'child'
    });
    owner.on('child:ping', prefixedPing);
    owner.render();

    for (let index = 0; index < 10; index++) {
      const child = new TestView();
      owner.showChildView('content', child);
      child.destroy();
      child.trigger('ping');

      expect(owner.getChildView('content')).toBeUndefined();
    }

    expect(lifecycle).to.deep.equal(Array.from({ length: 10 }, () => ['before:destroy', 'destroy']).flat());
    expect(ping).not.toHaveBeenCalled();
    expect(prefixedPing).not.toHaveBeenCalled();
    owner.destroy();
  });

  it('clears the Region once when its current View is destroyed externally', function() {
    const view = new TestView();
    const beforeEmpty = vi.fn();
    const empty = vi.fn();

    region.on('before:empty', beforeEmpty);
    region.on('empty', empty);
    region.show(view);

    view.destroy();
    view.destroy();

    expect(beforeEmpty).toHaveBeenCalledTimes(1);
    expect(beforeEmpty.mock.calls.map(args => args.slice(0, 2))).toContainEqual([region, view]);
    expect(empty).toHaveBeenCalledTimes(1);
    expect(empty.mock.calls.map(args => args.slice(0, 2))).toContainEqual([region, view]);
    expect(region.hasView()).toBe(false);
    expect(region.currentView).toBeUndefined();
  });

  for (const operation of ['child', 'region']) {
    it(`allows child destroy events to destroy the parent during ${operation} destruction`, function() {
      const owner = new View({
        template: () => '<div class="content"></div>',
        regions: { content: '.content' },
        childViewEvents: { destroy: 'destroy' }
      });
      const child = new TestView();
      owner.showChildView('content', child);
      const ownedRegion = owner.getRegion('content');
      const destroyed = vi.fn();
      ownedRegion.on('destroy', destroyed);

      (operation === 'child' ? child : ownedRegion).destroy();

      expect(owner.isDestroyed()).toBe(true);
      expect(child.isDestroyed()).toBe(true);
      expect(ownedRegion.isDestroyed()).toBe(true);
      expect(ownedRegion.hasView()).toBe(false);
      expect(owner.hasRegion('content')).toBe(false);
      expect(destroyed).toHaveBeenCalledTimes(1);
    });
  }

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
      beforeDestroy: vi.fn(currentRegion => {
        if (reenteredBeforeDestroy) { return; }
        reenteredBeforeDestroy = true;
        beforeDestroyReturn = currentRegion.destroy();
      }),
      beforeEmpty: vi.fn(),
      empty: vi.fn(),
      destroy: vi.fn(currentRegion => {
        if (reenteredDestroy) { return; }
        reenteredDestroy = true;
        destroyReturn = currentRegion.destroy();
      }),
    };
    const childLifecycle = {
      beforeDestroy: vi.fn(),
      destroy: vi.fn(),
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
    expect(owner.hasRegion('content')).toBe(true);
    expect(ownedRegion.currentView).to.equal(child);

    expect(ownedRegion.destroy()).to.equal(ownedRegion);
    expect(ownedRegion.destroy()).to.equal(ownedRegion);
    expect(beforeDestroyReturn).to.equal(ownedRegion);
    expect(destroyReturn).to.equal(ownedRegion);

    expect(ownedRegion.isDestroyed()).toBe(true);
    expect(ownedRegion.hasView()).toBe(false);
    expect(ownedRegion.currentView).toBeUndefined();
    expect(child.isDestroyed()).toBe(true);
    expect(owner.getRegion('content')).toBeUndefined();
    expect(owner.hasRegion('content')).toBe(false);
    expect(owner.getRegions()).not.to.have.own.property('content');

    expect(owner.destroy()).to.equal(owner);
    expect(owner.destroy()).to.equal(owner);

    for (const lifecycle of [regionLifecycle, childLifecycle]) {
      for (const callback of Object.values(lifecycle)) {
        expect(callback).toHaveBeenCalledTimes(1);
      }
    }
  });
});
