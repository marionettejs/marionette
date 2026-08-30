import { JSDOM } from 'jsdom';
import { vi } from 'vitest';

import EventDelegator, { setEventDelegator } from '../../../runtime/event-delegator';
import View from '../../../modules/view';

describe('EventDelegator', function() {
  let dom;
  let events;
  let rootEl;

  beforeEach(function() {
    dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
    events = [];
    rootEl = dom.window.document.getElementById('root');
  });

  afterEach(function() {
    EventDelegator.undelegateAll({ events, rootEl });
  });

  function delegate(eventName, selector, handler) {
    EventDelegator.delegate({
      eventName,
      selector,
      handler,
      events,
      rootEl
    });
  }

  function dispatchClick(node) {
    node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  }

  describe('#setEventDelegator', function() {
    it('overlays own enumerable string properties and returns the current class', function() {
      const inherited = { inheritedMixin: true };
      const mixin = Object.assign(Object.create(inherited), { shared: 'mixin', mixin: true });
      const symbol = Symbol('ignored');
      const protoValue = { polluted: true };
      mixin[symbol] = true;
      Object.defineProperty(mixin, 'hidden', { enumerable: false, value: true });
      Object.defineProperty(mixin, '__proto__', { enumerable: true, value: protoValue });

      const MyObject = function() {};
      MyObject.prototype.EventDelegator = Object.assign(
        Object.create({ inheritedBase: true }),
        { base: true, shared: 'base' }
      );
      MyObject.setEventDelegator = setEventDelegator;

      expect(MyObject.setEventDelegator(mixin)).to.equal(MyObject);
      expect(MyObject.prototype.EventDelegator)
        .to.include({ base: true, shared: 'mixin', mixin: true });
      expect(MyObject.prototype.EventDelegator).to.not.have.property('inheritedBase');
      expect(MyObject.prototype.EventDelegator).to.not.have.property('inheritedMixin');
      expect(MyObject.prototype.EventDelegator).to.not.have.property('hidden');
      expect(MyObject.prototype.EventDelegator).to.not.have.property(symbol);
      expect(Object.getPrototypeOf(MyObject.prototype.EventDelegator)).to.equal(Object.prototype);
      expect(Object.hasOwn(MyObject.prototype.EventDelegator, '__proto__')).to.be.true;
      expect(Object.getOwnPropertyDescriptor(MyObject.prototype.EventDelegator, '__proto__').value)
        .to.equal(protoValue);
    });

    it('isolates repeated overlays to the receiving class', function() {
      const Parent = function() {};
      Parent.prototype.EventDelegator = { base: true };

      const Child = function() {};
      Child.prototype = Object.create(Parent.prototype);
      Child.setEventDelegator = setEventDelegator;

      Child.setEventDelegator({ first: true });
      const firstOverlay = Child.prototype.EventDelegator;
      Child.setEventDelegator({ second: true });

      expect(Child.prototype.EventDelegator).to.include({ base: true, first: true, second: true });
      expect(Child.prototype.EventDelegator).to.not.equal(firstOverlay);
      expect(Parent.prototype.EventDelegator).to.deep.equal({ base: true });
    });
  });

  describe('#undelegateAll', function() {
    it('removes each registered handler in order with the expected capture flag', function() {
      const clickHandler = vi.fn();
      const focusHandler = vi.fn();
      const removeEventListener = vi.fn();
      const eventRoot = { removeEventListener };
      const registeredEvents = [
        { eventName: 'click', handler: clickHandler },
        { eventName: 'focus', handler: focusHandler }
      ];

      EventDelegator.undelegateAll({ events: registeredEvents, rootEl: eventRoot });

      expect(removeEventListener.mock.calls).to.deep.equal([
        ['click', clickHandler, false],
        ['focus', focusHandler, true]
      ]);
      expect(removeEventListener.mock.instances).to.deep.equal([eventRoot, eventRoot]);
      expect(registeredEvents).to.have.lengthOf(0);
    });

    it('uses the initial length while reading later registrations at removal time', function() {
      const firstHandler = vi.fn();
      const originalSecondHandler = vi.fn();
      const replacementHandler = vi.fn();
      const appendedHandler = vi.fn();
      const registeredEvents = [
        { eventName: 'first', handler: firstHandler },
        { eventName: 'second', handler: originalSecondHandler }
      ];
      const removeEventListener = vi.fn(function() {
        if (removeEventListener.mock.calls.length === 1) {
          registeredEvents[1] = { eventName: 'replacement', handler: replacementHandler };
          registeredEvents.push({ eventName: 'appended', handler: appendedHandler });
        }
      });

      EventDelegator.undelegateAll({
        events: registeredEvents,
        rootEl: { removeEventListener }
      });

      expect(removeEventListener.mock.calls).to.deep.equal([
        ['first', firstHandler, false],
        ['replacement', replacementHandler, false]
      ]);
      expect(registeredEvents).to.have.lengthOf(0);
    });

    it('treats sparse registrations as dense and leaves the registry on failure', function() {
      const firstHandler = vi.fn();
      const lastHandler = vi.fn();
      const registeredEvents = new Array(3);
      registeredEvents[0] = { eventName: 'first', handler: firstHandler };
      registeredEvents[2] = { eventName: 'last', handler: lastHandler };
      const removeEventListener = vi.fn();

      expect(() => EventDelegator.undelegateAll({
        events: registeredEvents,
        rootEl: { removeEventListener }
      })).to.throw(TypeError);

      expect(removeEventListener.mock.calls).to.deep.equal([
        ['first', firstHandler, false]
      ]);
      expect(registeredEvents).to.have.lengthOf(3);
    });

    it('stops at a removal error and leaves the registry intact for retry', function() {
      const registeredEvents = [
        { eventName: 'first', handler: vi.fn() },
        { eventName: 'second', handler: vi.fn() },
        { eventName: 'third', handler: vi.fn() }
      ];
      const failure = new Error('remove failed');
      const removeEventListener = vi.fn(function(eventName) {
        if (eventName === 'second') { throw failure; }
      });

      expect(() => EventDelegator.undelegateAll({
        events: registeredEvents,
        rootEl: { removeEventListener }
      })).to.throw(failure);

      expect(removeEventListener).toHaveBeenCalledTimes(2);
      expect(registeredEvents).to.have.lengthOf(3);
    });
  });

  it('handles delegated clicks on matching elements and their descendants', function() {
    const handler = vi.fn(function(event) {
      expect(event.currentTarget).to.equal(rootEl);
    });

    rootEl.innerHTML = '<button class="foo"><span>click</span></button>';
    delegate('click', '.foo', handler);

    const button = rootEl.querySelector('.foo');
    dispatchClick(button);
    dispatchClick(button.querySelector('span'));

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[0][0].delegateTarget).to.equal(button);
    expect(handler.mock.calls[1][0].delegateTarget).to.equal(button);
  });

  it('does not emulate delegated mouseenter bubbling', function() {
    const handler = vi.fn();

    rootEl.innerHTML = '<button class="foo">enter</button>';
    delegate('mouseenter', '.foo', handler);

    rootEl.querySelector('.foo').dispatchEvent(new dom.window.MouseEvent('mouseenter'));

    expect(handler).not.toHaveBeenCalled();
  });

  it('treats a jQuery-style namespace as part of the native event type', function() {
    const handler = vi.fn();

    rootEl.innerHTML = '<button class="foo">click</button>';
    delegate('click.menu', '.foo', handler);

    const button = rootEl.querySelector('.foo');
    dispatchClick(button);
    button.dispatchEvent(new dom.window.Event('click.menu', { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not interpret a false return or add trigger arguments', function() {
    const handler = vi.fn(() => false);

    rootEl.innerHTML = '<button class="foo">click</button>';
    delegate('click', '.foo', handler);

    const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
    const dispatched = rootEl.querySelector('.foo').dispatchEvent(event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]).to.have.lengthOf(1);
    expect(handler.mock.calls[0][0]).to.equal(event);
    expect(dispatched).to.be.true;
    expect(event.defaultPrevented).to.be.false;
  });

  it('handles delegated events with text-node targets', function() {
    const handler = vi.fn();

    rootEl.innerHTML = '<button class="foo">click text</button>';
    delegate('click', '.foo', handler);

    expect(function() {
      dispatchClick(rootEl.querySelector('.foo').firstChild);
    }).to.not.throw();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('fires once when nested ancestors match the selector', function() {
    const handler = vi.fn();

    rootEl.innerHTML = '<div class="foo"><button class="foo">click</button></div>';
    delegate('click', '.foo', handler);

    dispatchClick(rootEl.querySelector('button'));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].delegateTarget).to.equal(rootEl.querySelector('button'));
  });

  it('delegates focus events during capture', function() {
    const handler = vi.fn();

    rootEl.innerHTML = '<input class="foo">';
    delegate('focus', '.foo', handler);

    rootEl.querySelector('input').dispatchEvent(new dom.window.FocusEvent('focus'));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('delegates blur events during capture', function() {
    const handler = vi.fn();

    rootEl.innerHTML = '<input class="foo">';
    delegate('blur', '.foo', handler);

    rootEl.querySelector('input').dispatchEvent(new dom.window.FocusEvent('blur'));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('removes handlers without leaks across setElement swaps', function() {
    const handler = vi.fn();

    rootEl.innerHTML = '<button class="foo">first</button>';
    const otherEl = dom.window.document.createElement('div');
    otherEl.innerHTML = '<button class="foo">second</button>';

    const view = new View({
      el: rootEl,
      events: {
        'click .foo': handler
      }
    });

    view.setElement(otherEl);
    dispatchClick(rootEl.querySelector('.foo'));
    dispatchClick(otherEl.querySelector('.foo'));

    view.setElement(rootEl);
    dispatchClick(otherEl.querySelector('.foo'));
    dispatchClick(rootEl.querySelector('.foo'));

    expect(handler).toHaveBeenCalledTimes(2);

    view._undelegateViewEvents();
    dispatchClick(rootEl.querySelector('.foo'));

    expect(handler).toHaveBeenCalledTimes(2);
    expect(view._domEvents).to.have.lengthOf(0);
  });
});
