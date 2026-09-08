import { describe, it, expect, vi } from 'vitest';
import { CollectionView, View } from 'marionette';

function setup(kind, options) {
  const child = new View({ template: false });
  const parent = kind === 'View' ?
    new View({ template: () => '<section></section>', regions: { content: 'section' }, ...options }).render() :
    new CollectionView({ ...options }).render();
  if (kind === 'View') { parent.showChildView('content', child); } else { parent.addChildView(child); }
  return { parent, child };
}

for (const kind of ['View', 'CollectionView']) {
  describe(`${kind} child event map ownership`, function() {
    it('ignores inherited entries in event and trigger maps', function() {
      const inheritedHandler = vi.fn();
      const { parent, child } = setup(kind, {
        childViewEvents: Object.create({ inherited: inheritedHandler }),
        childViewTriggers: Object.create({ inherited: 'unexpected' }),
      });
      const unexpected = vi.fn();
      parent.on('unexpected', unexpected);
      try {
        for (const name of ['constructor', 'toString', '__proto__', 'inherited']) {
          expect(() => child.trigger(name, 'payload')).not.toThrow();
        }
        expect(inheritedHandler).not.toHaveBeenCalled();
        expect(unexpected).not.toHaveBeenCalled();
      } finally { parent.destroy(); }
    });

    it('dispatches explicitly owned special-name mappings with the parent receiver', function() {
      const handler = vi.fn();
      const events = { ['__proto__']: handler, constructor: handler };
      const { parent, child } = setup(kind, {
        childViewEvents: events,
        childViewTriggers: { ['__proto__']: 'mapped', constructor: 'mapped' },
      });
      const mapped = vi.fn();
      parent.on('mapped', mapped);
      try {
        child.trigger('__proto__', 'first');
        child.trigger('constructor', 'second');
        expect(handler).toHaveBeenCalledTimes(2);
        expect(handler.mock.contexts[0]).toBe(parent);
        expect(handler).toHaveBeenNthCalledWith(1, 'first');
        expect(mapped).toHaveBeenCalledTimes(2);
        expect(mapped).toHaveBeenNthCalledWith(2, 'second');
      } finally { parent.destroy(); }
    });
  });
}
