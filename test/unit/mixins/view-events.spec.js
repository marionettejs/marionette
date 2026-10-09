import { describe, expect, it, vi } from 'vitest';
import { View } from 'marionette';

function dispatch(view, name) {
  const event = new Event(name, { bubbles: true, cancelable: true });
  view.el.dispatchEvent(event);
  return event;
}

describe('View event declarations', () => {
  it('uses an explicit event map when redelegating', () => {
    const configured = vi.fn();
    const explicit = vi.fn();
    const view = new View({ events: { click: configured } });
    view.delegateEvents({ submit: explicit });
    dispatch(view, 'click');
    dispatch(view, 'submit');
    expect(configured).not.toHaveBeenCalled();
    expect(explicit).toHaveBeenCalledTimes(1);
    view.destroy();
  });

  it('resolves callable maps on the View and invokes handlers with the event', () => {
    const handler = vi.fn();
    const events = vi.fn().mockReturnValue({ click: handler });
    const view = new View({ events });
    const event = dispatch(view, 'click');
    expect(events).toHaveBeenCalledExactlyOnceWith();
    expect(events.mock.contexts[0] === view).toBe(true);
    expect(handler).toHaveBeenCalledExactlyOnceWith(event);
    expect(handler.mock.contexts[0] === view).toBe(true);
    view.destroy();
  });

  it('snapshots own event keys, ignoring inherited and late-added declarations', () => {
    const first = vi.fn();
    const second = vi.fn();
    const ignored = vi.fn();
    const events = Object.create({ inherited: ignored });
    Object.defineProperties(events, {
      first: { enumerable: true, get() { events.late = ignored; return first; } },
      second: { enumerable: true, value: second }
    });
    const view = new View({ events });
    ['first', 'second', 'inherited', 'late'].forEach(name => dispatch(view, name));
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(ignored).not.toHaveBeenCalled();
    view.destroy();
  });

  it.each(['__proto__', 'constructor', 'toString'])('accepts an own event named %s', name => {
    const handler = vi.fn();
    const events = Object.defineProperty({}, name, { enumerable: true, value: handler });
    const view = new View({ events });
    dispatch(view, name);
    expect(handler).toHaveBeenCalledTimes(1);
    view.destroy();
  });

  it('stops reading event declarations when a getter throws', () => {
    const later = vi.fn();
    const error = new Error('event failed');
    const events = Object.defineProperties({}, {
      first: { enumerable: true, get() { throw error; } },
      second: { enumerable: true, get: later }
    });
    expect(() => new View({ events })).toThrow(error);
    expect(later).not.toHaveBeenCalled();
  });

  it('allows empty callable maps and dispatches string triggers', () => {
    const empty = new View({ events() { return null; }, triggers() { return undefined; } });
    empty.destroy();
    const triggers = vi.fn().mockReturnValue({ click: 'clicked' });
    const view = new View({ triggers });
    const clicked = vi.fn();
    view.on('clicked', clicked);
    const event = dispatch(view, 'click');
    expect(triggers).toHaveBeenCalledExactlyOnceWith();
    expect(clicked).toHaveBeenCalledExactlyOnceWith(view, event);
    expect(event.defaultPrevented).toBe(true);
    view.destroy();
  });
});
