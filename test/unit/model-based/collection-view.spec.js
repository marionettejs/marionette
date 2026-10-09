import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { CollectionView, Region, View } from 'marionette';
import { Command, modelSettings } from './settings.js';

const childCount = 6;
const id = fc.integer({ min: 0, max: childCount - 1 });
const filterModes = ['all', 'even', 'odd'];

function visible(model) {
  return model.order.filter(value => model.filter === 'all' || value % 2 === (model.filter === 'even' ? 0 : 1));
}

function verify(model, real) {
  const expected = visible(model);
  expect(real.parent.children.toArray()).toEqual(expected.map(value => real.children[value]));
  expect(Array.from(real.parent.el.children).map(el => Number(el.dataset.itemId))).toEqual(expected);
  expect(real.parent.isDestroyed()).toBe(model.destroyed);
  expect(real.parent.isEmpty()).toBe(expected.length === 0);
  for (let index = 0; index < childCount; index++) {
    const view = real.children[index];
    expect(view.isDestroyed()).toBe(model.states[index] === 'destroyed');
    expect(view.isAttached()).toBe(expected.includes(index));
    if (expected.includes(index)) {
      expect(view.isRendered()).toBe(true);
      expect(view.el.parentNode).toBe(real.parent.el);
    } else {
      expect(view.el.parentNode).toBeNull();
    }
  }
}

function command(name, args, check, update) {
  return new Command(name, args, check, (model, real) => {
    update(model, real);
    verify(model, real);
  });
}

function available(model, value) { return !model.destroyed && model.states[value] === 'available'; }

const commands = [
  id.map(value => command('append', [value], model => available(model, value), (model, real) => {
    expect(real.parent.addChildView(real.children[value])).toBe(real.children[value]);
    model.order.push(value);
    model.states[value] = 'owned';
  })),
  fc.tuple(id, id).map(([value, position]) => command('insert', [value, position],
    model => available(model, value) && model.filter === 'all', (model, real) => {
      const index = position % (model.order.length + 1);
      expect(real.parent.addChildView(real.children[value], index)).toBe(real.children[value]);
      model.order.splice(index, 0, value);
      model.states[value] = 'owned';
    })),
  id.map(value => command('detach', [value], model => !model.destroyed && model.states[value] === 'owned', (model, real) => {
    expect(real.parent.detachChildView(real.children[value])).toBe(real.children[value]);
    model.order = model.order.filter(entry => entry !== value);
    model.states[value] = 'available';
  })),
  id.map(value => command('remove', [value], model => !model.destroyed && model.states[value] === 'owned', (model, real) => {
    expect(real.parent.removeChildView(real.children[value])).toBe(real.children[value]);
    model.order = model.order.filter(entry => entry !== value);
    model.states[value] = 'destroyed';
  })),
  fc.tuple(id, id).map(([first, second]) => command('swap', [first, second],
    model => !model.destroyed && model.states[first] === 'owned' && model.states[second] === 'owned', (model, real) => {
      expect(real.parent.swapChildViews(real.children[first], real.children[second])).toBe(real.parent);
      const a = model.order.indexOf(first);
      const b = model.order.indexOf(second);
      [model.order[a], model.order[b]] = [model.order[b], model.order[a]];
    })),
  fc.constantFrom(...filterModes).map(mode => command('filter', [mode], model => !model.destroyed, (model, real) => {
    if (mode === 'all') {
      expect(real.parent.removeFilter()).toBe(real.parent);
    } else {
      expect(real.parent.setFilter(view => view.itemId % 2 === (mode === 'even' ? 0 : 1))).toBe(real.parent);
    }
    model.filter = mode;
  })),
  fc.constant(command('destroy', [], model => !model.destroyed, (model, real) => {
    expect(real.parent.destroy()).toBe(real.parent);
    for (const value of model.order) { model.states[value] = 'destroyed'; }
    model.order = [];
    model.destroyed = true;
  })),
  id.map(value => command('addAfterDestroy', [value], model => model.destroyed && model.states[value] === 'available', (model, real) => {
    expect(real.parent.addChildView(real.children[value])).toBe(real.children[value]);
  }))
];

describe('CollectionView public operation sequences', () => {
  it('preserves membership, order, ownership and identity through filtering and reinsertion', { timeout: 120000 }, () => {
    const settings = modelSettings();
    fc.assert(fc.property(fc.commands([commands[0], commands[0], ...commands], settings.commands), sequence => {
      const mount = document.createElement('main');
      document.body.append(mount);
      const region = new Region({ el: mount });
      const parent = new CollectionView({ template: false });
      const children = Array.from({ length: childCount }, (_, value) => {
        const view = new View({ template: () => `item ${value}`, attributes: { 'data-item-id': String(value) } });
        view.itemId = value;
        return view;
      });
      const model = { order: [], states: Array(childCount).fill('available'), filter: 'all', destroyed: false };
      const real = { parent, children };
      region.show(parent);
      try {
        fc.modelRun(() => ({ model, real }), sequence);
        verify(model, real);
      } finally {
        region.destroy();
        for (const child of children) { child.destroy(); }
        mount.remove();
      }
    }), settings.assert);
  });
});
