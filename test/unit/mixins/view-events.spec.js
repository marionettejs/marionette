import { vi, describe, it, expect } from 'vitest';
import ViewEventsMixin from '../../../src/mixins/view-events';

function createView(overrides = {}) {
  return {
    normalizeUIString: vi.fn().mockImplementation(key => key),
    triggerMethod: vi.fn(),
    ...ViewEventsMixin,
    ...overrides
  };
}

describe('view events mixin', function() {
  describe('#_delegateEvents', function() {
    it('uses an explicit event map instead of the configured map', function() {
      const configuredHandler = vi.fn();
      const explicitHandler = vi.fn();
      const view = createView({ events: { click: configuredHandler } });
      const delegates = [];

      view._delegateEvents(delegates, {}, { submit: explicitHandler });

      expect(delegates).to.have.lengthOf(2);
      delegates[0]();
      expect(explicitHandler).toHaveBeenCalledTimes(1);
      expect(configuredHandler).not.toHaveBeenCalled();
    });

    it('resolves a callable event map on the view with no arguments', function() {
      const eventHandler = vi.fn();
      const events = vi.fn().mockReturnValue({ click: eventHandler });
      const view = createView({ events });
      const delegates = [];

      view._delegateEvents(delegates, {});

      expect(events).toHaveBeenCalledTimes(1);
      expect(events.mock.contexts).toContain(view);
      expect(events).toHaveBeenCalledWith();
      expect(delegates).to.have.lengthOf(2);

      delegates[0]('event argument');
      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler.mock.contexts).toContain(view);
      expect(eventHandler).toHaveBeenCalledWith('event argument');
    });

    it('snapshots own event keys before reading values', function() {
      const trace = [];
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      const events = {};
      Object.defineProperties(events, {
        first: {
          enumerable: true,
          get() {
            trace.push('read:first');
            events.third = firstHandler;
            return firstHandler;
          }
        },
        second: {
          enumerable: true,
          get() {
            trace.push('read:second');
            return secondHandler;
          }
        }
      });
      const view = createView({
        events,
        normalizeUIString(key) {
          trace.push(`normalize:${key}`);
          return key;
        }
      });
      const delegates = [];

      view._delegateEvents(delegates, {});

      expect(trace).to.deep.equal([
        'read:first',
        'normalize:first',
        'read:second',
        'normalize:second'
      ]);
      expect(delegates).to.have.lengthOf(4);
    });

    it('ignores inherited map keys while preserving own built-in names', function() {
      const handler = vi.fn();
      const events = Object.create({ inherited: handler });
      Object.defineProperties(events, {
        ['__proto__']: { enumerable: true, value: handler },
        constructor: { enumerable: true, value: handler },
        toString: { enumerable: true, value: handler }
      });
      const view = createView({ events });
      const delegates = [];

      view._delegateEvents(delegates, {});

      expect(delegates.filter((value, index) => index % 2 === 1))
        .to.deep.equal(['__proto__', 'constructor', 'toString']);
    });

    it('treats a null resolved event map as a no-op', function() {
      const view = createView({ events() { return null; } });
      const delegates = [];

      view._delegateEvents(delegates, {});

      expect(delegates).to.deep.equal([]);
    });

    it('stops reading event values when a getter throws', function() {
      const calls = [];
      const error = new Error('event failed');
      const events = Object.defineProperties({}, {
        first: {
          enumerable: true,
          get() {
            calls.push('first');
            return function() {};
          }
        },
        second: {
          enumerable: true,
          get() {
            calls.push('second');
            throw error;
          }
        },
        third: {
          enumerable: true,
          get() {
            calls.push('third');
            return function() {};
          }
        }
      });
      const view = createView({ events });

      expect(() => view._delegateEvents([], {})).to.throw(error);
      expect(calls).to.deep.equal(['first', 'second']);
    });
  });

  describe('#_delegateTriggers', function() {
    it('resolves a callable trigger map on the view with no arguments', function() {
      const triggers = vi.fn().mockReturnValue({ submit: 'submitted' });
      const view = createView({ triggers });
      const delegates = [];

      view._delegateTriggers(delegates, {}, view);

      expect(triggers).toHaveBeenCalledTimes(1);
      expect(triggers.mock.contexts).toContain(view);
      expect(triggers).toHaveBeenCalledWith();
      expect(delegates).to.have.lengthOf(2);
    });

    it('treats an undefined resolved trigger map as a no-op', function() {
      const view = createView({ triggers() { return undefined; } });
      const delegates = [];

      view._delegateTriggers(delegates, {}, view);

      expect(delegates).to.deep.equal([]);
    });

    it('accepts boxed string triggers and forwards the view, event, and extra arguments', function() {
      const triggerName = new String('clicked');
      const event = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      };
      const view = createView({ triggers: { click: triggerName } });
      const delegates = [];

      view._delegateTriggers(delegates, {}, view);
      delegates[0](event, 'extra');

      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(event.stopPropagation).toHaveBeenCalledTimes(1);
      expect(view.triggerMethod).toHaveBeenCalledTimes(1);
      expect(view.triggerMethod).toHaveBeenCalledWith(triggerName, view, event, 'extra');
    });
  });
});
