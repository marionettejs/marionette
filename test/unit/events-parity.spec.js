import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import _ from 'underscore';

import { Events as EventsMixin } from '@mnjs/utils';

const require = createRequire(import.meta.url);
const Backbone = require('backbone');

const createEmitter = Events => _.extend({}, Events);

const runFor = (Events, scenario) => scenario(createEmitter(Events));

const expectParity = scenario => {
  const backboneResult = runFor(Backbone.Events, scenario);
  const marionetteResult = runFor(EventsMixin, scenario);

  expect(marionetteResult).to.eql(backboneResult);
};

describe('Events parity with Backbone.Events', function() {
  it('preserves multi-name registration with separate dispatch calls', function() {
    expectParity(Events => {
      const calls = [];

      Events.on('alpha beta', function(...args) {
        calls.push([this === Events, ...args]);
      });
      Events.trigger('alpha', 1, 2);
      Events.trigger('beta', 1, 2);

      return calls;
    });
  });

  const dispatchChanges = [
    ['clears all handlers', emitter => emitter.off()],
    ['removes the next event', emitter => emitter.off('beta')],
    ['adds a handler to the next event', (emitter, calls) => {
      emitter.on('beta', () => calls.push('added'));
    }],
    ['replaces the event registry', (emitter, calls) => {
      emitter.off();
      emitter.on('beta', () => calls.push('replacement'));
    }],
  ];

  for (const [name, change] of dispatchChanges) {
    it(`preserves separate dispatch calls when a handler ${name}`, function() {
      expectParity(emitter => {
        const calls = [];
        emitter.on('alpha', () => {
          calls.push('alpha');
          change(emitter, calls);
        });
        emitter.on('beta', () => calls.push('beta'));

        emitter.trigger('alpha');
        emitter.trigger('beta');
        emitter.trigger('beta');

        return calls;
      });
    });
  }

  it('preserves once-map dispatch when the first handler clears all events', function() {
    expectParity(emitter => {
      const calls = [];
      emitter.once({
        alpha() {
          calls.push('alpha');
          emitter.off();
        },
        beta() { calls.push('beta'); },
      });

      emitter.trigger('alpha');
      emitter.trigger('beta');
      emitter.trigger('alpha');
      emitter.trigger('beta');

      return calls;
    });
  });

  it('uses a replacement registry for nested dispatch without changing the outer dispatch', function() {
    expectParity(emitter => {
      const calls = [];
      emitter.once('alpha', () => {
        calls.push('alpha');
        emitter.off();
        emitter.on('beta', value => calls.push(['replacement', value]));
        emitter.trigger('beta', 'nested');
      });
      emitter.on('beta', value => calls.push(['original', value]));

      emitter.trigger('alpha', 'outer');
      emitter.trigger('beta', 'outer');
      emitter.trigger('beta', 'later');

      return calls;
    });
  });

  it('removes a once handler before a reentrant trigger', function() {
    // Backbone once wrappers remove themselves before invoking the callback:
    // https://github.com/jashkenas/backbone/blob/1.4.0/backbone.js#L270-L299
    expectParity(Events => {
      const calls = [];

      Events.once('alpha', function(value) {
        calls.push(value);
        Events.trigger('alpha', 'reentrant');
      });
      Events.trigger('alpha', 'outer');

      return calls;
    });
  });

  it('dispatches one-shot registration through the canonical overrides', function() {
    // Backbone 1.3.3 and 1.4.0 implement once through `this.on` and
    // listenToOnce through `this.listenTo`.
    const runScenario = Events => {
      const emitter = createEmitter(Events);
      const listener = createEmitter(Events);
      const baseOn = emitter.on;
      const baseListenTo = listener.listenTo;
      let onCalls = 0;
      let listenToCalls = 0;
      let handlerCalls = 0;

      emitter.on = function(...args) {
        onCalls++;
        return baseOn.apply(this, args);
      };
      listener.listenTo = function(...args) {
        listenToCalls++;
        return baseListenTo.apply(this, args);
      };

      emitter.once('direct', () => handlerCalls++);
      listener.listenToOnce(emitter, 'listening', () => handlerCalls++);
      emitter.trigger('direct');
      emitter.trigger('direct');
      emitter.trigger('listening');
      emitter.trigger('listening');

      return { onCalls, listenToCalls, handlerCalls };
    };

    expect(runScenario(EventsMixin)).to.deep.equal(runScenario(Backbone.Events));
  });

  it('cleans up listener bookkeeping as subscriptions are removed', function() {
    // Backbone listener cleanup after the final callback is removed:
    // https://github.com/jashkenas/backbone/blob/1.4.0/backbone.js#L220-L268
    const emitter = createEmitter(EventsMixin);
    const listener = createEmitter(EventsMixin);
    const calls = [];

    listener.listenTo(emitter, 'alpha beta', name => calls.push(name));
    emitter.off('alpha');
    emitter.trigger('alpha', 'alpha');
    emitter.trigger('beta', 'beta');

    expect(calls).to.eql(['beta']);

    emitter.off('beta');

  });

  it('passes the event name before trigger arguments to all listeners', function() {
    // Backbone all-listener argument construction:
    // https://github.com/jashkenas/backbone/blob/1.4.0/backbone.js#L301-L325
    expectParity(Events => {
      const calls = [];

      Events.on('all', (...args) => calls.push(args));
      Events.trigger('alpha', 1, { value: 2 });

      return calls;
    });
  });

  it('propagates handler errors and stops the current dispatch', function() {
    // Backbone invokes event callbacks directly without catching handler errors:
    // https://github.com/jashkenas/backbone/blob/1.4.0/backbone.js#L328-L340
    expectParity(Events => {
      const calls = [];
      const error = new Error('handler failed');
      let thrown;

      Events.on('alpha', () => {
        calls.push('first');
        throw error;
      });
      Events.on('alpha', () => calls.push('second'));

      try {
        Events.trigger('alpha');
      } catch (triggerError) {
        thrown = triggerError;
      }

      return {
        calls,
        propagatedOriginalError: thrown === error
      };
    });
  });

  it('uses the current handler snapshot during reentrant dispatch', function() {
    // Backbone captures the current handler-array length before dispatch:
    // https://github.com/jashkenas/backbone/blob/1.4.0/backbone.js#L328-L340
    expectParity(Events => {
      const calls = [];
      let isInnerDispatch = false;

      const secondHandler = () => {
        calls.push(isInnerDispatch ? 'second:inner' : 'second:outer');
      };
      const lateHandler = () => {
        calls.push(isInnerDispatch ? 'late:inner' : 'late:outer');
      };

      Events.on('alpha', () => {
        calls.push(isInnerDispatch ? 'first:inner' : 'first:outer');
        if (!isInnerDispatch) {
          Events.off('alpha', secondHandler);
          Events.on('alpha', lateHandler);
          isInnerDispatch = true;
          Events.trigger('alpha');
          isInnerDispatch = false;
        }
      });
      Events.on('alpha', secondHandler);

      Events.trigger('alpha');

      return calls;
    });
  });

  it('preserves the Backbone.Events object when loading the integration', async function() {
    // Backbone exposes one stable Events mixin object on its namespace:
    // https://github.com/jashkenas/backbone/blob/1.4.0/backbone.js#L71-L84
    const eventsIdentity = Backbone.Events;
    await import('@mnjs/adapters/backbone');

    expect(Backbone.Events).to.equal(eventsIdentity);
  });
});
