import buildEventArgs from '../../../utils/build-event-args';

function defineEnumerable(object, name, value) {
  Object.defineProperty(object, name, {
    configurable: true,
    enumerable: true,
    value,
    writable: true
  });
}

describe('buildEventArgs', function() {
  it('preserves callback metadata for a single event name', function() {
    const callback = function() {};
    const context = {};
    const listener = {};

    expect(buildEventArgs('change', callback, context, listener)).to.deep.equal([
      { name: 'change', callback, context, listener }
    ]);
  });

  it('expands space-separated event names in source order', function() {
    const callback = function() {};
    const context = {};
    const listener = {};

    expect(buildEventArgs('first second third', callback, context, listener)).to.deep.equal([
      { name: 'first', callback, context, listener },
      { name: 'second', callback, context, listener },
      { name: 'third', callback, context, listener }
    ]);
  });

  it('expands event-map keys recursively in own-key order', function() {
    const first = function() {};
    const second = function() {};
    const context = {};
    const listener = {};
    const events = {
      'first second': first,
      third: second
    };

    expect(buildEventArgs(events, context, undefined, listener)).to.deep.equal([
      { name: 'first', callback: first, context, listener },
      { name: 'second', callback: first, context, listener },
      { name: 'third', callback: second, context, listener }
    ]);
  });

  it('uses explicit context and falls back to the callback for event maps', function() {
    const handler = function() {};
    const fallbackContext = {};
    const explicitContext = {};
    const listener = {};

    expect(buildEventArgs({ event: handler }, fallbackContext, explicitContext, listener))
      .to.deep.equal([
        { name: 'event', callback: handler, context: explicitContext, listener }
      ]);
    [false, 0, ''].forEach(explicitFalseyContext => {
      expect(buildEventArgs({ event: handler }, fallbackContext, explicitFalseyContext, listener))
        .to.deep.equal([
          { name: 'event', callback: handler, context: explicitFalseyContext, listener }
        ]);
    });
  });

  it('selects only own enumerable string event-map keys', function() {
    const inherited = function() {};
    const visible = function() {};
    const hidden = function() {};
    const symbol = Symbol('symbol');
    const events = Object.create({ inherited });
    events.visible = visible;
    events[symbol] = function() {};
    Object.defineProperty(events, 'hidden', { value: hidden });

    expect(buildEventArgs(events)).to.deep.equal([
      { name: 'visible', callback: visible, context: undefined, listener: undefined }
    ]);
  });

  it('preserves literal __proto__ event-map keys as data', function() {
    const callback = function() {};
    const events = {};
    defineEnumerable(events, '__proto__', callback);

    expect(buildEventArgs(events)).to.deep.equal([
      { name: '__proto__', callback, context: undefined, listener: undefined }
    ]);
    expect(Object.getPrototypeOf(events)).to.equal(Object.prototype);
  });

  it('treats arrays as event maps of their present enumerable keys', function() {
    const indexed = function() {};
    const extra = function() {};
    const events = [];
    events[1] = indexed;
    events.extra = extra;

    expect(buildEventArgs(events)).to.deep.equal([
      { name: '1', callback: indexed, context: undefined, listener: undefined },
      { name: 'extra', callback: extra, context: undefined, listener: undefined }
    ]);
  });

  it('preserves falsy names and callbacks in a single descriptor', function() {
    const cases = [
      [undefined, undefined],
      [null, null],
      ['', ''],
      [0, 0],
      [false, false]
    ];

    for (let i = 0; i < cases.length; i++) {
      const [name, callback] = cases[i];
      expect(buildEventArgs(name, callback)).to.deep.equal([
        { name, callback, context: undefined, listener: undefined }
      ]);
    }
  });

  it('preserves the event-name coercion error for symbols', function() {
    expect(() => buildEventArgs(Symbol('event'))).to.throw(TypeError);
  });

  it('preserves empty names created by surrounding whitespace', function() {
    const callback = function() {};

    expect(buildEventArgs(' first second ', callback)).to.deep.equal([
      { name: '', callback, context: undefined, listener: undefined },
      { name: 'first', callback, context: undefined, listener: undefined },
      { name: 'second', callback, context: undefined, listener: undefined },
      { name: '', callback, context: undefined, listener: undefined }
    ]);
  });
});
