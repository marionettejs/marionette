import { createRequire } from 'module';
import _ from 'underscore';

import EventsMixin from '../../mixins/events';

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
  it('dispatches each object-form trigger entry with its mapped value', function() {
    const emitter = createEmitter(EventsMixin);
    const calls = [];

    emitter.on('alpha', value => calls.push(['alpha', value]));
    emitter.on('beta', value => calls.push(['beta', value]));

    // Backbone event-map dispatch:
    // https://github.com/jashkenas/backbone/blob/1.4.0/backbone.js#L95-L113
    // Marionette extends that shape by passing each mapped value to its handler.
    emitter.trigger({ alpha: 1, beta: 2 });

    expect(calls).to.eql([
      ['alpha', 1],
      ['beta', 2]
    ]);
  });

  it('preserves arguments and order for space-separated event names', function() {
    // Backbone eventsApi space-separated dispatch:
    // https://github.com/jashkenas/backbone/blob/1.4.0/backbone.js#L103-L107
    expectParity(Events => {
      const calls = [];

      Events.on('alpha beta', function(...args) {
        calls.push([this === Events, ...args]);
      });
      Events.trigger('alpha beta', 1, 2);

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
    expect(Object.keys(listener._rdListeningTo)).to.have.lengthOf(1);

    emitter.off('beta');

    expect(Object.keys(listener._rdListeningTo)).to.have.lengthOf(0);
    expect(Object.keys(emitter._rdListeners)).to.have.lengthOf(0);
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
      let isOuterDispatch = true;

      Events.on('alpha', () => {
        calls.push(isOuterDispatch ? 'first:outer' : 'first:inner');
        if (isOuterDispatch) {
          isOuterDispatch = false;
          Events.trigger('alpha');
        }
      });
      Events.on('alpha', () => {
        calls.push(isOuterDispatch ? 'second:outer' : 'second:inner');
      });

      Events.trigger('alpha');

      return calls;
    });
  });

  it('preserves the Backbone.Events object when loading the shim', async function() {
    // Backbone exposes one stable Events mixin object on its namespace:
    // https://github.com/jashkenas/backbone/blob/1.4.0/backbone.js#L71-L84
    const eventsIdentity = Backbone.Events;
    const { default: ShimmedBackbone } = await import('../../backbone.js');

    expect(ShimmedBackbone.Events).to.equal(eventsIdentity);
  });
});
