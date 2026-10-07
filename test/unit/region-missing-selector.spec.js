import { expect, it } from 'vitest';
import { Region, View } from 'marionette';

for (const operation of ['empty', 'reset', 'destroy']) {
  it(`supports ${operation} after an allowed missing selector`, () => {
    const region = new Region({ parentEl: document.createElement('div'), el: '.optional', allowMissingEl: true });
    const view = new View({ template: false });

    try {
      expect(region.show(view)).toBeUndefined();
      expect(region.show(view)).toBeUndefined();
      expect(region[operation]()).toBe(region);
      expect(region.hasView()).toBe(false);
      expect(view.isDestroyed()).toBe(false);
      expect(view.isRendered()).toBe(false);
      expect(region.isDestroyed()).toBe(operation === 'destroy');
    } finally {
      view.destroy();
      region.destroy();
    }
  });
}

it('resolves a previously missing selector on a later explicit show', () => {
  const container = document.createElement('div');
  const region = new Region({ parentEl: container, el: '.optional' });
  const view = new View({ template: () => 'Ready' });

  try {
    expect(region.show(view, { allowMissingEl: true })).toBeUndefined();
    const target = document.createElement('section');
    target.className = 'optional';
    container.append(target);
    expect(region.show(view)).toBe(region);
    expect(target.firstElementChild).toBe(view.el);
    region.destroy();
    expect(view.isDestroyed()).toBe(true);
    expect(target.childElementCount).toBe(0);
  } finally {
    view.destroy();
    region.destroy();
  }
});

it('retains strict missing-target diagnostics after an allowed skip', () => {
  const region = new Region({ parentEl: document.createElement('div'), el: '.optional', allowMissingEl: true });
  const view = new View({ template: false });

  try {
    expect(region.show(view)).toBeUndefined();
    expect(() => region.show(view, { allowMissingEl: false })).toThrowError(expect.objectContaining({ code: 'MN0005' }));
  } finally {
    view.destroy();
    region.destroy();
  }
});

it('rerenders and destroys a parent after its optional Region skips showing', () => {
  const parent = new View({ template: () => '', regions: { optional: { el: '.optional', allowMissingEl: true } } });
  const child = new View({ template: false });
  const region = parent.getRegion('optional');

  try {
    parent.showChildView('optional', child);
    expect(region.hasView()).toBe(false);
    expect(parent.render()).toBe(parent);
    expect(parent.getRegion('optional')).toBe(region);
    parent.destroy();
    expect(region.isDestroyed()).toBe(true);
    expect(child.isDestroyed()).toBe(false);
  } finally {
    child.destroy();
    parent.destroy();
  }
});
