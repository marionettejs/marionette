import State from '../../modules/state';
import MarionetteError from '../../utils/error';

describe('State', function() {
  describe('constructor', function() {
    it('initializes with defaults, attributes, a cid, and Marionette Events', function() {
      const onChange = this.sinon.spy();
      const TestState = State.extend({
        defaults: {
          enabled: false,
          count: 0
        },

        initialize(attributes, marker) {
          this.marker = marker;
        }
      });
      const state = new TestState({ count: 2 }, 'initialized');

      state.on('change', onChange);
      state.set('enabled', true);

      expect(state.cid).to.match(/^mns\d+$/);
      expect(state.isDestroyed()).to.be.false;
      expect(state.marker).to.equal('initialized');
      expect(state.toJSON()).to.deep.equal({ enabled: true, count: 2 });
      expect(onChange).to.have.been.calledOnce;
    });

    it('supports function-valued defaults', function() {
      const TestState = State.extend({
        defaults() {
          return {
            enabled: this.enabled,
            count: 0
          };
        }
      });
      TestState.prototype.enabled = true;

      const state = new TestState({ count: 2 });

      expect(state.toJSON()).to.deep.equal({ enabled: true, count: 2 });
    });

    it('supports native class inheritance and Marionette extend', function() {
      class NativeState extends State {
        defaults() {
          return { enabled: true };
        }

        getValue() {
          return this.get('value');
        }
      }
      const ExtendedState = State.extend({
        getValue() {
          return this.get('value');
        }
      });

      const nativeState = new NativeState({ value: 'native' });

      expect(nativeState.toJSON()).to.deep.equal({ enabled: true, value: 'native' });
      expect(nativeState.getValue()).to.equal('native');
      expect(new ExtendedState({ value: 'extended' }).getValue()).to.equal('extended');
    });

    it('rejects whitespace-bearing keys', function() {
      expect(() => new State({ 'invalid key': true }))
        .to.throw(MarionetteError)
        .and.include({ code: 'MN0034' });
    });

    it('rejects whitespace-bearing default keys', function() {
      const InvalidState = State.extend({
        defaults: {
          'invalid key': true
        }
      });

      expect(() => new InvalidState())
        .to.throw(MarionetteError)
        .and.include({ code: 'MN0034' });
    });
  });

  describe('#get', function() {
    it('reads own values without exposing inherited values', function() {
      const state = new State({ value: 1 });

      expect(state.get('value')).to.equal(1);
      expect(state.get('constructor')).to.be.undefined;
      expect(state.get('__proto__')).to.be.undefined;
    });

    it('reads stored prototype-collision names as own values', function() {
      const attributes = JSON.parse('{"constructor":"constructor","toString":"toString","__proto__":"prototype"}');
      const state = new State(attributes);

      expect(state.get('constructor')).to.equal('constructor');
      expect(state.get('toString')).to.equal('toString');
      expect(state.get('__proto__')).to.equal('prototype');
    });
  });

  describe('#has', function() {
    it('distinguishes own undefined values from absent values', function() {
      const state = new State({ value: 1, missing: undefined });

      expect(state.has('value')).to.be.true;
      expect(state.has('missing')).to.be.true;
      expect(state.has('other')).to.be.false;
    });
  });

  describe('#toJSON', function() {
    it('returns a shallow snapshot with safe prototype-collision values', function() {
      const attributes = JSON.parse('{"value":1,"__proto__":"prototype"}');
      const state = new State(attributes);
      const snapshot = state.toJSON();

      expect(snapshot).to.deep.equal(attributes);
      expect(Object.getPrototypeOf(snapshot)).to.equal(Object.prototype);
      expect(Object.getOwnPropertyDescriptor(snapshot, '__proto__').value).to.equal('prototype');

      snapshot.value = 2;

      expect(state.get('value')).to.equal(1);
    });
  });

  describe('#set', function() {
    it('commits a multi-key write before ordered key and aggregate events', function() {
      const state = new State({ first: 0, second: 0 });
      const calls = [];

      state.on('change:first', (currentState, value, change) => {
        calls.push(['first', currentState.get('second'), value, change]);
      });
      state.on('change:second', (currentState, value, change) => {
        calls.push(['second', currentState.get('first'), value, change]);
      });
      state.on('change', (currentState, change) => {
        calls.push(['change', currentState.toJSON(), change]);
      });

      state.set({ first: 1, second: 2 }, { source: 'test' });

      const expectedChange = {
        source: 'test',
        changed: { first: 1, second: 2 },
        previous: { first: 0, second: 0 }
      };
      expect(calls).to.deep.equal([
        ['first', 2, 1, expectedChange],
        ['second', 1, 2, expectedChange],
        ['change', { first: 1, second: 2 }, expectedChange]
      ]);
    });

    it('does not emit for no-op or silent writes', function() {
      const state = new State({ value: 1 });
      const onChange = this.sinon.spy();

      state.on('change', onChange);
      state.set();
      state.set('value', 1);
      state.set('value', 2, { silent: true });

      expect(state.get('value')).to.equal(2);
      expect(onChange).not.to.have.been.called;
    });

    it('completes nested writes synchronously as independent changes', function() {
      const state = new State({ first: 0, second: 0 });
      const calls = [];

      state.on('change:first', () => {
        calls.push('first');
        state.set('second', 2);
      });
      state.on('change:second', () => calls.push('second'));
      state.on('change', (currentState, change) => {
        calls.push(`change:${ Object.keys(change.changed).join(',') }`);
      });

      state.set('first', 1);

      expect(calls).to.deep.equal([
        'first',
        'second',
        'change:second',
        'change:first'
      ]);
    });

    it('rejects whitespace-bearing keys before changing state', function() {
      const state = new State({ value: 1 });

      expect(() => state.set({ value: 2, 'invalid key': true }))
        .to.throw(MarionetteError)
        .and.include({ code: 'MN0034' });
      expect(state.toJSON()).to.deep.equal({ value: 1 });
    });
  });

  describe('#unset', function() {
    it('unsets own values with the same change contract', function() {
      const state = new State({ value: 1 });
      const onValue = this.sinon.spy();
      const onChange = this.sinon.spy();

      state.on('change:value', onValue);
      state.on('change', onChange);
      state.unset('missing');
      state.unset('value', { source: 'unset' });

      const expectedChange = {
        source: 'unset',
        changed: { value: undefined },
        previous: { value: 1 }
      };
      expect(state.has('value')).to.be.false;
      expect(onValue).to.have.been.calledOnceWith(state, undefined, expectedChange);
      expect(onChange).to.have.been.calledOnceWith(state, expectedChange);
    });

    it('does not emit for nullish keys', function() {
      const state = new State({ value: 1 });
      const onChange = this.sinon.spy();

      state.on('change', onChange);
      state.unset();
      state.unset(null);

      expect(state.toJSON()).to.deep.equal({ value: 1 });
      expect(onChange).not.to.have.been.called;
    });

    it('rejects whitespace-bearing keys', function() {
      const state = new State({ value: 1 });

      expect(() => state.unset('invalid key'))
        .to.throw(MarionetteError)
        .and.include({ code: 'MN0034' });
      expect(state.toJSON()).to.deep.equal({ value: 1 });
    });
  });

  describe('#reset', function() {
    it('resets to defaults plus replacement attributes', function() {
      const ResetState = State.extend({
        defaults: {
          enabled: false,
          count: 0
        }
      });
      const state = new ResetState({ count: 2, extra: true });

      state.reset({ enabled: true });

      expect(state.toJSON()).to.deep.equal({ enabled: true, count: 0 });
    });

    it('rejects whitespace-bearing keys before changing state', function() {
      const state = new State({ value: 1 });

      expect(() => state.reset({ 'invalid key': true }))
        .to.throw(MarionetteError)
        .and.include({ code: 'MN0034' });
      expect(state.toJSON()).to.deep.equal({ value: 1 });
    });
  });

  describe('#destroy', function() {
    it('destroys idempotently and makes later writes lifecycle-safe no-ops', function() {
      const state = new State({ value: 1 });
      const source = new State();
      const onChange = this.sinon.spy();
      const onSource = this.sinon.spy();
      const snapshot = state.toJSON();

      state.on('change', onChange);
      state.listenTo(source, 'change', onSource);

      expect(state.destroy()).to.equal(state);
      expect(state.destroy()).to.equal(state);
      state.set('invalid key', 2);
      state.unset('invalid key');
      state.reset({ 'invalid key': 3 });
      source.set('value', 1);

      expect(state.isDestroyed()).to.be.true;
      expect(state.get('value')).to.equal(1);
      expect(state.toJSON()).to.deep.equal(snapshot);
      expect(onChange).not.to.have.been.called;
      expect(onSource).not.to.have.been.called;
    });
  });
});
