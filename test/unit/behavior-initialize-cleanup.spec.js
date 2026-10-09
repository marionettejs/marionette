import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Behavior, View } from 'marionette';

// Observe real DOM handlers and public cleanup; do not inspect the parser's array.
describe('Behavior initialization cleanup', function() {
  let el;
  let host;
  let instances;
  let clicks;
  let destroyed;

  beforeEach(function() {
    el = document.createElement('section');
    el.innerHTML = '<button>Run</button>';
    document.body.appendChild(el);
    instances = {};
    clicks = [];
    destroyed = [];
  });

  afterEach(function() {
    if (host) { host.destroy(); }
    // Also release any instance lost by a failing ownership regression.
    Object.values(instances).forEach(behavior => behavior.destroy());
    el.remove();
    host = undefined;
  });

  function defineBehavior(name, properties = {}) {
    const { initialize, ...rest } = properties;
    return Behavior.extend({
      ...rest,
      events: {
        'click button'() { clicks.push(name); }
      },
      initialize() {
        instances[name] = this;
        if (initialize) { initialize.call(this); }
      },
      destroy() {
        destroyed.push(name);
        return Behavior.prototype.destroy.call(this);
      }
    });
  }

  function showBehaviors(behaviors) {
    host = new View({ el, behaviors });
    el.firstElementChild.click();
  }

  function expectHostCleanup(expectedClicks, expectedDestroyed) {
    host.destroy();
    // A detached but retained root must not keep a Behavior's listener alive.
    el.firstElementChild.click();
    expect(clicks).to.deep.equal(expectedClicks);
    expect(destroyed).to.have.members(expectedDestroyed);
    expect(destroyed).to.have.lengthOf(expectedDestroyed.length);
  }

  it('does not rebind a self-destroyed Behavior and retains both live siblings', function() {
    showBehaviors([
      defineBehavior('first'),
      defineBehavior('self', { initialize() { this.destroy(); } }),
      defineBehavior('last')
    ]);

    expect(clicks).to.deep.equal(['first', 'last']);
    expectHostCleanup(['first', 'last'], ['self', 'first', 'last']);
  });

  it('retains the later Behavior when its initializer destroys an earlier sibling', function() {
    showBehaviors([
      defineBehavior('first'),
      defineBehavior('last', { initialize() { instances.first.destroy(); } })
    ]);

    expect(clicks).to.deep.equal(['last']);
    expectHostCleanup(['last'], ['first', 'last']);
  });

  it('retains nested and outer siblings after a nested Behavior destroys itself', function() {
    showBehaviors([
      defineBehavior('outer', {
        behaviors: [
          defineBehavior('self', { initialize() { this.destroy(); } }),
          defineBehavior('nested')
        ]
      }),
      defineBehavior('last')
    ]);

    expect(clicks).to.deep.equal(['outer', 'nested', 'last']);
    expectHostCleanup(['outer', 'nested', 'last'], ['self', 'outer', 'nested', 'last']);
  });

  it('still constructs and owns the nested definitions of a self-destroyed Behavior', function() {
    showBehaviors([
      defineBehavior('self', {
        initialize() { this.destroy(); },
        behaviors: [defineBehavior('nested')]
      }),
      defineBehavior('last')
    ]);

    expect(clicks).to.deep.equal(['nested', 'last']);
    expectHostCleanup(['nested', 'last'], ['self', 'nested', 'last']);
  });

  it('preserves ordinary nested registration order and cleans each Behavior once', function() {
    showBehaviors([
      defineBehavior('first'),
      defineBehavior('outer', { behaviors: [defineBehavior('nested')] }),
      defineBehavior('last')
    ]);

    expect(clicks).to.deep.equal(['first', 'outer', 'nested', 'last']);
    expectHostCleanup(['first', 'outer', 'nested', 'last'], ['first', 'outer', 'nested', 'last']);
  });
});
