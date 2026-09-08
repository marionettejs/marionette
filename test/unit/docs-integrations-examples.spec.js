import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { createMarionette } from '../../src/index.ts';
import * as utils from '../../packages/utils/src/index.ts';
import BackboneApi from '../../packages/adapters/src/data/backbone.ts';
import Backbone from 'backbone';

function blocks(file) {
  return [...readFileSync(file, 'utf8').matchAll(/```(?:javascript|js)\n([\s\S]*?)```/g)]
    .map(match => match[1]);
}

function execute(file, index, exercise = '') {
  const runtime = createMarionette();
  const imports = { ...utils, ...runtime, createMarionette, BackboneApi, Backbone };
  const code = blocks(file)[index]
    .replace(/^import .* from .*;\n/gm, '')
    .replace(/^export /gm, '');
  const logs = [];
  const logger = { log: (...args) => logs.push(args), warn: (...args) => logs.push(args) };
  const result = new Function(...Object.keys(imports), 'console', code + '\n' + exercise)(
    ...Object.values(imports), logger
  );
  return { result, logs };
}

describe('integration documentation examples', () => {
  it('forwards a clicked collection row through the declared child event map', () => {
    const { result, logs } = execute('docs/events.md', 9, `
      const count = list.children.length;
      list.destroy();
      return count;
    `);
    expect(result).toBe(1);
    expect(logs).toEqual([['model selected: example']]);
  });

  it('opts into prefixed Region-child events and preserves custom arguments', () => {
    const { result, logs } = execute('docs/events.md', 10, `
      const parent = new ParentView().render();
      const child = parent.getChildView('foo');
      const received = [];
      for (const name of ['onChildviewClickView', 'onChildviewDidSomething']) {
        const original = parent[name];
        parent[name] = function(...args) {
          received.push(args[0]);
          return original.apply(this, args);
        };
      }
      child.el.click();
      child.doSomething();
      parent.destroy();
      return received.length === 2 && received.every(value => value === child);
    `);
    expect(result).toBe(true);
    expect(logs).toHaveLength(2);
    expect(logs[0][0]).toMatch(/^View clicked /);
    expect(logs[1][0]).toMatch(/^Something was done to /);
  });

  it('opts into prefixed CollectionView child events', () => {
    const { logs } = execute('docs/events.md', 11, `
      const list = new MyList({ collection: [{}] }).render();
      list.children.first().el.click();
      list.destroy();
    `);
    expect(logs).toHaveLength(1);
    expect(logs[0][0]).toMatch(/^Childview /);
  });

  it('forwards the custom prefix render event', () => {
    const { logs } = execute('docs/events.md', 12, 'collectionView.destroy();');
    expect(logs).toHaveLength(1);
    expect(logs[0][0]).toBe('Child rendered');
  });

  for (const index of [13, 14]) {
    it(`handles a Region child click with explicit map example ${index}`, () => {
      const { logs } = execute('docs/events.md', index, `
        const parent = new ParentView().render();
        parent.getChildView('foo').el.click();
        parent.destroy();
      `);
      expect(logs).toHaveLength(1);
    });
  }

  it('preserves message values through two generations', () => {
    const { logs } = execute('docs/events.md', 16, `
      const parent = new GrandParentView({ collection: [{}] }).render();
      parent.el.querySelector('.button').click();
      parent.destroy();
    `);
    expect(logs.map(args => args[0])).toEqual([
      'A child view fired show:message with foo', 'A child sent: foo',
      'A child view fired show:message with bar', 'A child sent: bar'
    ]);
  });

  it('shows and empties a Region with the documented event state', () => {
    const show = execute('docs/events.class.md', 1, 'myRegion.destroy();');
    expect(show.logs).toEqual([[false], [false], [true], [true], [true], [true]]);
    const empty = execute('docs/events.class.md', 2, 'myRegion.destroy();');
    expect(empty.logs).toEqual([[true], [false], [false], [true]]);
  });

  it('uses the filter callback arrays and renders the empty View', () => {
    const filtered = execute('docs/events.class.md', 3, `
      const row = View.extend({ template: () => 'Row' });
      const list = new MyCollectionView({ childView: row, collection: [{ id: 1 }, { id: 2 }],
        viewFilter: view => view.model.id === 1 }).render();
      const length = list.children.length;
      list.destroy();
      return length;
    `);
    expect(filtered.result).toBe(1);
    expect(filtered.logs[1][1]).toHaveLength(1);
    expect(filtered.logs[2][1]).toHaveLength(1);
    const empty = execute('docs/events.class.md', 4, `
      const text = myView.el.textContent;
      myView.destroy();
      return text;
    `);
    expect(empty.result).toBe('No items');
  });

  it('keeps preexisting Backbone listeners and returns the Radio service value', () => {
    const backbone = execute('docs/optional-backbone.md', 2);
    expect(backbone.logs).toEqual([['Model changed']]);
    const radio = execute('docs/radio.md', 3, 'return currentUser;');
    expect(radio.result).toEqual({ id: 'example' });
  });

  it('uses only utils imports for the standalone component', () => {
    const code = blocks('packages/utils/readme.md')[0];
    expect(code).not.toContain('from \'marionette\'');
    const { result } = execute('packages/utils/readme.md', 0, `
      return [component.triggerMethod('open'), component.normalizeMethods({ open: 'onOpen' }).open === component.onOpen];
    `);
    expect(result).toEqual(['Inbox', true]);
  });
});
