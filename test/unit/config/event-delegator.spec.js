import { JSDOM } from 'jsdom';
import { vi } from 'vitest';

import EventDelegator, { setEventDelegator } from '../../../config/event-delegator';
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

  it('handles delegated clicks on matching elements and their descendants', function() {
    const handler = vi.fn();

    rootEl.innerHTML = '<button class="foo"><span>click</span></button>';
    delegate('click', '.foo', handler);

    const button = rootEl.querySelector('.foo');
    dispatchClick(button);
    dispatchClick(button.querySelector('span'));

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[0][0].delegateTarget).to.equal(button);
    expect(handler.mock.calls[1][0].delegateTarget).to.equal(button);
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
