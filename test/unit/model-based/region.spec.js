import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Region, View } from 'marionette';
import { Command, modelSettings } from './settings.js';

const viewCount = 4;
const regionIndex = fc.integer({ min: 0, max: 1 });
const viewIndex = fc.integer({ min: 0, max: viewCount - 1 });

function verify(model, real) {
  for (let index = 0; index < 2; index++) {
    const expected = model.regions[index];
    const region = real.regions[index];
    const view = expected.current === null ? undefined : real.views[expected.current];
    expect(region.currentView).toBe(view);
    expect(region.hasView()).toBe(view !== undefined);
    expect(region.isDestroyed()).toBe(expected.destroyed);
    expect(region.isReplaced()).toBe(expected.current !== null && expected.replace);
    expect(region.isSwappingView()).toBe(false);
    if (!view || !expected.replace) {
      expect(real.containers[index].firstChild).toBe(real.placeholders[index]);
      expect(Array.from(real.placeholders[index].children)).toEqual(view ? [view.el] : []);
    } else {
      expect(real.containers[index].firstChild).toBe(view.el);
      expect(real.placeholders[index].parentNode).toBeNull();
    }
    expect(real.containers[index].childNodes).toHaveLength(1);
  }
  for (let index = 0; index < viewCount; index++) {
    const view = real.views[index];
    expect(view.isDestroyed()).toBe(model.views[index].destroyed);
    expect(view.isAttached()).toBe(model.attached && model.views[index].owner !== null);
    if (model.views[index].owner === null) { expect(view.el.parentNode).toBeNull(); }
  }
}

function command(name, args, check, update) {
  return new Command(name, args, check, (model, real) => {
    update(model, real);
    verify(model, real);
  });
}

function release(model, index, destroy) {
  const current = model.regions[index].current;
  if (current !== null) {
    model.views[current] = { owner: null, destroyed: destroy };
    model.regions[index].current = null;
  }
}

const commands = [
  fc.tuple(regionIndex, viewIndex, fc.boolean()).map(([index, value, replace]) => command('show', [index, value, replace], model =>
    !model.regions[index].destroyed && !model.views[value].destroyed && [null, index].includes(model.views[value].owner), (model, real) => {
    expect(real.regions[index].show(real.views[value], { replaceElement: replace })).toBe(real.regions[index]);
    if (model.regions[index].current !== value) {
      release(model, index, true);
      model.regions[index].current = value;
      model.regions[index].replace = replace;
      model.views[value].owner = index;
    }
  })),
  fc.tuple(regionIndex, viewIndex).map(([index, value]) => command('rejectOwnedView', [index, value], model =>
    !model.regions[index].destroyed && model.views[value].owner !== null && model.views[value].owner !== index, (model, real) => {
    expect(() => real.regions[index].show(real.views[value])).toThrowError(expect.objectContaining({ code: 'MN0003' }));
  })),
  regionIndex.map(index => command('detach', [index], () => true, (model, real) => {
    const current = model.regions[index].current;
    expect(real.regions[index].detachView()).toBe(current === null ? undefined : real.views[current]);
    release(model, index, false);
  })),
  regionIndex.map(index => command('empty', [index], () => true, (model, real) => {
    expect(real.regions[index].empty()).toBe(real.regions[index]);
    release(model, index, true);
  })),
  regionIndex.map(index => command('destroyRegion', [index], () => true, (model, real) => {
    expect(real.regions[index].destroy()).toBe(real.regions[index]);
    release(model, index, true);
    model.regions[index].destroyed = true;
  })),
  viewIndex.map(value => command('destroyView', [value], () => true, (model, real) => {
    expect(real.views[value].destroy()).toBe(real.views[value]);
    const owner = model.views[value].owner;
    if (owner !== null) { release(model, owner, true); }
    model.views[value].destroyed = true;
  })),
  fc.tuple(regionIndex, viewIndex).map(([index, value]) => command('showAfterDestroy', [index, value], model =>
    model.regions[index].destroyed, (model, real) => {
    expect(real.regions[index].show(real.views[value])).toBe(real.regions[index]);
  }))
];

describe('Region public ownership sequences', () => {
  for (const attached of [false, true]) {
    it(`preserves exclusive ownership and placeholder restoration with attached=${attached}`, { timeout: 120000 }, () => {
      const settings = modelSettings();
      fc.assert(fc.property(fc.commands([commands[0], commands[0], ...commands], settings.commands), sequence => {
        const containers = Array.from({ length: 2 }, () => document.createElement('main'));
        const placeholders = containers.map(container => {
          const placeholder = document.createElement('section');
          container.append(placeholder);
          if (attached) { document.body.append(container); }
          return placeholder;
        });
        const regions = placeholders.map(el => new Region({ el }));
        const views = Array.from({ length: viewCount }, (_, index) => new View({ template: () => `view ${index}` }));
        const model = {
          attached,
          regions: regions.map(() => ({ current: null, destroyed: false, replace: false })),
          views: views.map(() => ({ owner: null, destroyed: false }))
        };
        const real = { regions, views, containers, placeholders };
        try {
          fc.modelRun(() => ({ model, real }), sequence);
          verify(model, real);
        } finally {
          for (const region of regions) { region.destroy(); }
          for (const view of views) { view.destroy(); }
          for (const container of containers) { container.remove(); }
        }
      }), settings.assert);
    });
  }
});
