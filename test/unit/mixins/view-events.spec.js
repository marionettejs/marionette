import ViewEventsMixin from '../../../mixins/view-events';

function createView(overrides = {}) {
  return {
    normalizeUIString: sinon.stub().callsFake(key => key),
    triggerMethod: sinon.stub(),
    ...ViewEventsMixin,
    ...overrides
  };
}

describe('view events mixin', function() {
  describe('#_delegateEvents', function() {
    it('uses an explicit event map instead of the configured map', function() {
      const configuredHandler = this.sinon.stub();
      const explicitHandler = this.sinon.stub();
      const view = createView({ events: { click: configuredHandler } });
      const delegates = [];

      view._delegateEvents(delegates, {}, { submit: explicitHandler });

      expect(delegates).to.have.lengthOf(2);
      delegates[0]();
      expect(explicitHandler).to.have.been.calledOnce;
      expect(configuredHandler).to.not.have.been.called;
    });

    it('resolves a callable event map on the view with no arguments', function() {
      const eventHandler = this.sinon.stub();
      const events = this.sinon.stub().returns({ click: eventHandler });
      const view = createView({ events });
      const delegates = [];

      view._delegateEvents(delegates, {});

      expect(events).to.have.been.calledOnce.and.calledOn(view).and.calledWithExactly();
      expect(delegates).to.have.lengthOf(2);

      delegates[0]('event argument');
      expect(eventHandler).to.have.been.calledOnce.and.calledOn(view).and.calledWithExactly('event argument');
    });

    it('snapshots own event keys before reading values', function() {
      const trace = [];
      const firstHandler = this.sinon.stub();
      const secondHandler = this.sinon.stub();
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
      const handler = this.sinon.stub();
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
      const triggers = this.sinon.stub().returns({ submit: 'submitted' });
      const view = createView({ triggers });
      const delegates = [];

      view._delegateTriggers(delegates, {}, view);

      expect(triggers).to.have.been.calledOnce.and.calledOn(view).and.calledWithExactly();
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
        preventDefault: this.sinon.stub(),
        stopPropagation: this.sinon.stub()
      };
      const view = createView({ triggers: { click: triggerName } });
      const delegates = [];

      view._delegateTriggers(delegates, {}, view);
      delegates[0](event, 'extra');

      expect(event.preventDefault).to.have.been.calledOnce;
      expect(event.stopPropagation).to.have.been.calledOnce;
      expect(view.triggerMethod)
        .to.have.been.calledOnce
        .and.calledWithExactly(triggerName, view, event, 'extra');
    });
  });
});
