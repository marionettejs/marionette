import { JSDOM } from 'jsdom';
import { vi } from 'vitest';

import EventDelegator, { setEventDelegator } from '../../../src/runtime/event-delegator';
import Behavior from '../../../src/modules/behavior';
import CollectionView from '../../../src/modules/collection-view';
import View from '../../../src/modules/view';

describe('EventDelegator', function() {
  let cleanups;
  let dom;
  let rootEl;

  beforeEach(function() {
    dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
    cleanups = [];
    rootEl = dom.window.document.getElementById('root');
  });

  afterEach(function() {
    for (let index = cleanups.length - 1; index >= 0; index--) {
      cleanups[index]();
    }
  });

  function delegate(eventName, selector, handler) {
    const cleanup = EventDelegator.delegate({ eventName, selector, handler, rootEl });
    cleanups.push(cleanup);
    return cleanup;
  }

  function dispatchClick(node) {
    node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  }

  describe('#setEventDelegator', function() {
    it('installs a complete adapter as an own data property and returns the class', function() {
      const Parent = function() {};
      const original = { delegate() {} };
      const replacement = { delegate() {} };
      Parent.prototype.EventDelegator = original;
      Parent.setEventDelegator = setEventDelegator;

      const Child = function() {};
      Child.prototype = Object.create(Parent.prototype);
      Child.setEventDelegator = setEventDelegator;

      expect(Child.setEventDelegator(replacement)).to.equal(Child);
      expect(Object.getOwnPropertyDescriptor(Child.prototype, 'EventDelegator')).to.deep.equal({
        configurable: true,
        enumerable: true,
        value: replacement,
        writable: false
      });
      expect(Parent.prototype.EventDelegator).to.equal(original);
    });

  });

  it('returns idempotent cleanup with the registration-time capture mode', function() {
    const handler = vi.fn();
    const addEventListener = vi.spyOn(rootEl, 'addEventListener');
    const removeEventListener = vi.spyOn(rootEl, 'removeEventListener');
    const cleanup = delegate('focus', '.foo', handler);
    const registeredHandler = addEventListener.mock.calls[0][1];

    cleanup();
    cleanup();

    expect(addEventListener).toHaveBeenCalledWith('focus', registeredHandler, true);
    expect(removeEventListener.mock.calls).to.deep.equal([
      ['focus', registeredHandler, true]
    ]);
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

  it('handles direct events without changing delegateTarget', function() {
    const handler = vi.fn();
    const event = new dom.window.MouseEvent('click', { bubbles: true });
    delegate('click', '', handler);

    rootEl.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith(event);
    expect(event.delegateTarget).to.be.undefined;
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

    expect(() => dispatchClick(rootEl.querySelector('.foo').firstChild)).to.not.throw();
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

  ['focus', 'blur'].forEach(eventName => {
    it(`delegates ${ eventName } events during capture`, function() {
      const handler = vi.fn();

      rootEl.innerHTML = '<input class="foo">';
      delegate(eventName, '.foo', handler);

      rootEl.querySelector('input').dispatchEvent(new dom.window.FocusEvent(eventName));

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  function testFailedConstructionListeners(name, ViewClass) {

  }

  testFailedConstructionListeners('View', View);
  testFailedConstructionListeners('CollectionView', CollectionView);

  it('cleans Behavior events in registration order', function() {
    const order = [];
    const behaviors = [0, 1, 2].map(index => {
      const TestBehavior = Behavior.extend({ events: { click() {} } });
      TestBehavior.setEventDelegator({
        delegate: () => () => order.push(index)
      });
      return TestBehavior;
    });
    const TestView = View.extend({ behaviors });
    const view = new TestView({ el: rootEl });

    view.undelegateEvents();

    expect(order).to.deep.equal([0, 1, 2]);
    view.destroy();
  });

  it('uses the current adapter for new registrations and the original cleanup for old ones', function() {
    const firstCleanup = vi.fn();
    const secondCleanup = vi.fn();
    const firstAdapter = { delegate: vi.fn(() => firstCleanup) };
    const secondAdapter = { delegate: vi.fn(() => secondCleanup) };
    const TestView = View.extend({ events: { click() {} } });
    TestView.setEventDelegator(firstAdapter);
    const view = new TestView({ el: rootEl });

    TestView.setEventDelegator(secondAdapter);
    view.undelegateEvents();
    view.delegateEvents();

    expect(firstCleanup).toHaveBeenCalledTimes(1);
    expect(firstAdapter.delegate).toHaveBeenCalledTimes(1);
    expect(secondAdapter.delegate).toHaveBeenCalledTimes(1);
    expect(view._domEvents).to.deep.equal([secondCleanup]);
  });

  it('uses a class adapter for CollectionView registration and destruction', function() {
    const cleanup = vi.fn();
    const adapter = { delegate: vi.fn(() => cleanup) };
    const TestCollectionView = CollectionView.extend({ events: { click() {} } });
    TestCollectionView.setEventDelegator(adapter);
    const view = new TestCollectionView({ el: rootEl });

    view.destroy();
    view.destroy();

    expect(adapter.delegate).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('removes handlers without leaks across repeated delegation', function() {
    const handler = vi.fn();
    rootEl.innerHTML = '<button class="foo">first</button>';
    const view = new View({ el: rootEl, events: { 'click .foo': handler } });
    view.delegateEvents();
    dispatchClick(rootEl.querySelector('.foo'));
    view.delegateEvents();
    dispatchClick(rootEl.querySelector('.foo'));
    expect(handler).toHaveBeenCalledTimes(2);
    view.undelegateEvents();
    dispatchClick(rootEl.querySelector('.foo'));
    expect(handler).toHaveBeenCalledTimes(2);
    expect(view._domEvents).to.have.lengthOf(0);
    view.destroy();
  });
});
