import { describe, expect, it, vi } from 'vitest';
import { View } from 'marionette';

describe('View option composition', () => {
  it('resolves inherited element declarations on the View without mutating attributes', () => {
    const attributes = { title: 'owned' };
    const calls = [];
    const Parent = View.extend({
      tagName() { calls.push(['tagName', this, arguments.length]); return 'section'; },
      attributes() { calls.push(['attributes', this, arguments.length]); return attributes; },
      id() { calls.push(['id', this, arguments.length]); return 'resolved-id'; },
      className() { calls.push(['className', this, arguments.length]); return 'resolved-class'; }
    });
    const view = new (Parent.extend())();
    expect(view.el.tagName).toBe('SECTION');
    expect(view.el.id).toBe('resolved-id');
    expect(view.el.className).toBe('resolved-class');
    expect(view.el.title).toBe('owned');
    expect(attributes).toEqual({ title: 'owned' });
    expect(calls.map(([name]) => name)).toEqual(['tagName', 'attributes', 'id', 'className']);
    expect(calls.every(([, context, count]) => context === view && count === 0)).toBe(true);
    view.destroy();
  });

  it('stops declaration resolution after an id error', () => {
    const className = vi.fn();
    const Custom = View.extend({ id() { throw new Error('id failed'); }, className });
    expect(() => new Custom()).toThrow('id failed');
    expect(className).not.toHaveBeenCalled();
  });

  it('preserves falsy id and class values', () => {
    const view = new View({ id: 0, className: '' });
    expect(view.el.id).toBe('0');
    expect(view.el.getAttribute('class')).toBe('');
    view.destroy();
  });

  it.each([[undefined, null], [false, null], [null, 'null:changed'], [0, '0:changed'], ['', ':changed'], [() => undefined, 'undefined:changed']])(
    'forwards child events according to prefix %s', (childViewEventPrefix, expectedName) => {
      const parent = new View({ template: () => '<div></div>', regions: { content: 'div' }, childViewEventPrefix });
      const child = new View({ template: () => '' });
      parent.showChildView('content', child);
      const events = [];
      parent.on('all', name => events.push(name));
      child.trigger('changed', 'payload');
      expect(events).toEqual(expectedName ? [expectedName] : []);
      parent.destroy();
    }
  );

  it('resolves child event maps and a coercible prefix on the parent', () => {
    const mapped = vi.fn();
    const calls = [];
    const Parent = View.extend({
      template: () => '<div></div>', regions: { content: 'div' },
      childViewEvents() { calls.push('events'); return { changed: mapped }; },
      childViewTriggers() { calls.push('triggers'); return { changed: 'forwarded' }; },
      childViewEventPrefix() { calls.push('prefix'); return { [Symbol.toPrimitive]() { return 'custom'; } }; }
    });
    const parent = new Parent();
    const child = new View({ template: () => '' });
    const prefixed = vi.fn();
    const forwarded = vi.fn();
    parent.on('custom:changed', prefixed);
    parent.on('forwarded', forwarded);
    parent.showChildView('content', child);
    child.trigger('changed', 'payload');
    expect(calls).toEqual(['events', 'triggers', 'prefix', 'events', 'triggers', 'prefix']);
    expect(mapped).toHaveBeenCalledExactlyOnceWith('payload');
    expect(prefixed).toHaveBeenCalledExactlyOnceWith('payload');
    expect(forwarded).toHaveBeenCalledTimes(1);
    parent.destroy();
  });

  it('propagates child-event prefix coercion errors', () => {
    expect(() => new View({ childViewEventPrefix: Symbol('prefix') })).toThrow(TypeError);
  });
});
