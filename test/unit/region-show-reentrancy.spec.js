import { describe, it, expect, vi } from 'vitest';
import { Events, Region, View } from 'marionette';
import { triggerMethod } from '@marionette/utils';
import { setFixtures } from '../setup/fixtures.js';

const releases = [
  { name: 'detachView', release: (region) => region.detachView(), destroysView: false },
  { name: 'empty', release: (region) => region.empty(), destroysView: true },
  { name: 'destroy Region', release: (region) => region.destroy(), destroysView: true, destroysRegion: true },
  { name: 'destroy View', release: (region, view) => view.destroy(), destroysView: true }
];

describe('Region.show ownership after render callbacks', function() {
  for (const attached of [false, true]) {
    for (const replaceElement of [false, true]) {
      for (const { name, release, destroysView, destroysRegion = false } of releases) {
        it(`honors ${name} during render with attached=${attached}, replaceElement=${replaceElement}`, function() {
          const container = document.createElement('main');
          const placeholder = document.createElement('section');
          container.append(placeholder);
          if (attached) {
            setFixtures(container);
          }
          const region = new Region({ el: placeholder, replaceElement });
          const beforeShow = vi.fn();
          const shown = vi.fn();
          const emptied = vi.fn();
          const beforeAttach = vi.fn();
          const attachedView = vi.fn();
          const detachedView = vi.fn();
          const destroyedView = vi.fn();
          region.on('before:show', beforeShow);
          region.on('show', shown);
          region.on('empty', emptied);
          const view = new View({
            template: () => '<button>released</button>',
            onRender() { release(region, this); },
            onBeforeAttach: beforeAttach,
            onAttach: attachedView,
            onDetach: detachedView,
            onDestroy: destroyedView
          });

          expect(region.show(view)).to.equal(region);

          expect(region.hasView()).toBe(false);
          expect(region.currentView).toBeUndefined();
          expect(region.isDestroyed()).to.equal(destroysRegion);
          expect(region.isSwappingView()).toBe(false);
          expect(region.isReplaced()).toBe(false);
          expect(container.firstChild).to.equal(placeholder);
          expect(container.childNodes).to.have.lengthOf(1);
          expect(placeholder.childNodes).to.have.lengthOf(0);
          expect(view.el.parentNode).toBeNull();
          expect(view.isAttached()).toBe(false);
          expect(view.isDestroyed()).to.equal(destroysView);
          expect(view.isRendered()).to.equal(!destroysView);
          expect(beforeShow).toHaveBeenCalledTimes(1);
          expect(emptied).toHaveBeenCalledTimes(1);
          expect(shown).not.toHaveBeenCalled();
          expect(beforeAttach).not.toHaveBeenCalled();
          expect(attachedView).not.toHaveBeenCalled();
          expect(detachedView).not.toHaveBeenCalled();
          expect(destroyedView).toHaveBeenCalledTimes(destroysView ? 1 : 0);

          if (!destroysView) {
            const nextRegion = new Region({ el: document.createElement('aside') });
            expect(nextRegion.show(view)).to.equal(nextRegion);
            expect(nextRegion.currentView).to.equal(view);
            nextRegion.destroy();
          }
          region.destroy();
        });
      }
    }
  }

  it('still renders a supported foreign View once across Region adoption', function() {
    const view = {
      ...Events,
      el: document.createElement('article'),
      triggerMethod,
      render: vi.fn(function() { this.el.textContent = 'foreign'; return this; }),
      destroy: vi.fn(function() { this.el.remove(); this.triggerMethod('destroy', this); return this; })
    };
    const first = new Region({ el: document.createElement('section') });
    const second = new Region({ el: document.createElement('aside') });

    first.show(view);
    first.detachView();
    second.show(view);

    expect(view.render).toHaveBeenCalledTimes(1);
    expect(second.currentView).to.equal(view);
    expect(second.el.firstChild).to.equal(view.el);
    expect(view.el.textContent).to.equal('foreign');
    first.destroy();
    second.destroy();
    expect(view.destroy).toHaveBeenCalledTimes(1);
  });

  it('preserves a replacement shown by the original View render callback', function() {
    const placeholder = document.createElement('section');
    setFixtures(placeholder);
    const region = new Region({ el: placeholder });
    const replacement = new View({ template: () => 'replacement' });
    const original = new View({ template: () => 'original', onRender() { region.show(replacement); } });
    const shown = vi.fn();
    region.on('show', shown);

    expect(region.show(original)).to.equal(region);

    expect(region.currentView).to.equal(replacement);
    expect(placeholder.firstChild).to.equal(replacement.el);
    expect(placeholder.childNodes).to.have.lengthOf(1);
    expect(original.isDestroyed()).toBe(true);
    expect(original.isRendered()).toBe(false);
    expect(original.el.parentNode).toBeNull();
    expect(region.isSwappingView()).toBe(false);
    expect(shown).toHaveBeenCalledTimes(1);
    expect(shown).toHaveBeenCalledWith(region, replacement, undefined);
    region.destroy();
  });

  it('does not attach into a Region destroyed through a non-delegating teardown override', function() {
    const TerminalRegion = Region.extend({ empty() { return this; } });
    const placeholder = document.createElement('section');
    setFixtures(placeholder);
    const region = new TerminalRegion({ el: placeholder });
    const shown = vi.fn();
    region.on('show', shown);
    const view = new View({ template: () => 'content', onRender() { region.destroy(); } });

    expect(region.show(view)).to.equal(region);

    expect(region.isDestroyed()).toBe(true);
    expect(region.currentView).to.equal(view);
    expect(view.isDestroyed()).toBe(false);
    expect(view.el.parentNode).toBeNull();
    expect(placeholder.childNodes).to.have.lengthOf(0);
    expect(shown).not.toHaveBeenCalled();
    view.destroy();
  });

  it('does not resume showing after a render callback catches terminal teardown failure', function() {
    const error = new Error('teardown failed');
    const placeholder = document.createElement('section');
    setFixtures(placeholder);
    const region = new Region({ el: placeholder, onBeforeDestroy() { throw error; } });
    const shown = vi.fn();
    region.on('show', shown);
    const view = new View({
      template: () => 'content',
      onRender() { expect(() => region.destroy()).to.throw(error); }
    });

    expect(region.show(view)).to.equal(region);

    expect(region.isDestroyed()).toBe(false);
    expect(region.currentView).to.equal(view);
    expect(view.el.parentNode).toBeNull();
    expect(placeholder.childNodes).to.have.lengthOf(0);
    expect(shown).not.toHaveBeenCalled();
    view.destroy();
  });

  it('finishes swap bookkeeping when the incoming View releases itself', function() {
    setFixtures('<main><section id="swap-region"></section></main>');
    const placeholder = document.querySelector('#swap-region');
    const region = new Region({ el: placeholder, replaceElement: true });
    const original = new View({ template: () => 'original' });
    region.show(original);
    const shown = vi.fn();
    const emptied = vi.fn();
    region.on('show', shown);
    region.on('empty', emptied);
    const replacement = new View({
      template: () => 'replacement',
      onRender() {
        expect(region.isSwappingView()).toBe(true);
        region.detachView();
      }
    });

    expect(region.show(replacement)).to.equal(region);

    expect(original.isDestroyed()).toBe(true);
    expect(region.isSwappingView()).toBe(false);
    expect(region.hasView()).toBe(false);
    expect(region.isReplaced()).toBe(false);
    expect(placeholder.isConnected).toBe(true);
    expect(replacement.el.parentNode).toBeNull();
    expect(shown).not.toHaveBeenCalled();
    expect(emptied).toHaveBeenCalledTimes(2);
    replacement.destroy();
    region.destroy();
  });
});
