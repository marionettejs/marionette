import { JSDOM } from 'jsdom';
import { vi } from 'vitest';

import EventDelegator, { setEventDelegator } from '../../../runtime/event-delegator';
import Behavior from '../../../modules/behavior';
import CollectionView from '../../../modules/collection-view';
import View from '../../../modules/view';

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

    it('rejects an incomplete adapter without changing the current adapter', function() {
      const MyObject = function() {};
      const original = { delegate() {} };
      MyObject.prototype.EventDelegator = original;
      MyObject.setEventDelegator = setEventDelegator;

      for (const invalid of [undefined, null, {}, { delegate: true }]) {
        expect(() => MyObject.setEventDelegator(invalid))
          .to.throw('EventDelegator must provide a delegate method.')
          .with.property('code', 'MN0036');
        expect(MyObject.prototype.EventDelegator).to.equal(original);
      }
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
      ['focus', registeredHandler, true],
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

  it('rolls back earlier registrations when a later registration fails', function() {
    const registrationError = new Error('registration failed');
    const cleanup = vi.fn();
    const adapter = {
      delegate: vi.fn()
        .mockReturnValueOnce(cleanup)
        .mockImplementationOnce(() => { throw registrationError; })
    };
    const TestView = View.extend({
      events: {
        click() {},
        focus() {}
      }
    });
    TestView.setEventDelegator(adapter);

    expect(() => new TestView({ el: rootEl })).to.throw(registrationError);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('preserves a construction error when its DOM cleanup throws', function() {
    const constructionError = new Error('construction failed');
    const cleanupError = new Error('cleanup failed');
    const cleanup = vi.fn(() => { throw cleanupError; });
    const TestView = View.extend({
      events: { click() {} },
      initialize() {
        throw constructionError;
      }
    });
    TestView.setEventDelegator({ delegate: () => cleanup });

    expect(() => new TestView({ el: rootEl })).to.throw(constructionError);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('rolls back View and Behavior events when Behavior registration fails', function() {
    const registrationError = new Error('registration failed');
    const viewCleanups = [vi.fn(), vi.fn()];
    const firstBehaviorCleanups = [vi.fn(), vi.fn()];
    const secondBehaviorCleanup = vi.fn();
    const viewAdapter = {
      delegate: vi.fn()
        .mockReturnValueOnce(viewCleanups[0])
        .mockReturnValueOnce(viewCleanups[1])
    };
    const firstBehaviorAdapter = {
      delegate: vi.fn()
        .mockReturnValueOnce(firstBehaviorCleanups[0])
        .mockReturnValueOnce(firstBehaviorCleanups[1])
    };
    const secondBehaviorAdapter = {
      delegate: vi.fn()
        .mockReturnValueOnce(secondBehaviorCleanup)
        .mockImplementationOnce(() => { throw registrationError; })
    };
    const FirstBehavior = Behavior.extend({ events: { click() {} } });
    const SecondBehavior = Behavior.extend({ events: { click() {} } });
    FirstBehavior.setEventDelegator(firstBehaviorAdapter);
    SecondBehavior.setEventDelegator(secondBehaviorAdapter);
    const TestView = View.extend({
      behaviors: [FirstBehavior, SecondBehavior],
      events: { click() {} }
    });
    TestView.setEventDelegator(viewAdapter);
    const view = new TestView({ el: rootEl });

    expect(() => view.setElement(dom.window.document.createElement('section')))
      .to.throw(registrationError);

    expect(viewCleanups[1]).toHaveBeenCalledTimes(1);
    expect(firstBehaviorCleanups[1]).toHaveBeenCalledTimes(1);
    expect(view._domEvents).to.have.lengthOf(0);
    expect(view._behaviors[0]._domEvents).to.have.lengthOf(0);
    expect(view._behaviors[1]._domEvents).to.have.lengthOf(0);

    view.destroy();
  });

  it('attempts every cleanup once and clears failed registrations', function() {
    const cleanupError = new Error('cleanup failed');
    const firstCleanup = vi.fn(() => { throw cleanupError; });
    const secondCleanup = vi.fn();
    const adapter = {
      delegate: vi.fn()
        .mockReturnValueOnce(firstCleanup)
        .mockReturnValueOnce(secondCleanup)
    };
    const TestView = View.extend({
      events: {
        click() {},
        focus() {}
      }
    });
    TestView.setEventDelegator(adapter);
    const view = new TestView({ el: rootEl });

    expect(() => view.undelegateEvents()).to.throw(cleanupError);
    expect(secondCleanup).toHaveBeenCalledTimes(1);
    expect(firstCleanup).toHaveBeenCalledTimes(1);
    expect(view._domEvents).to.have.lengthOf(0);

    view.undelegateEvents();

    expect(firstCleanup).toHaveBeenCalledTimes(1);
    expect(view._domEvents).to.have.lengthOf(0);
  });

  it('continues undelegating Behavior events when View cleanup throws', function() {
    const cleanupError = new Error('cleanup failed');
    const viewCleanup = vi.fn(() => { throw cleanupError; });
    const behaviorCleanup = vi.fn();
    const TestBehavior = Behavior.extend({ events: { click() {} } });
    TestBehavior.setEventDelegator({ delegate: () => behaviorCleanup });
    const TestView = View.extend({
      behaviors: [TestBehavior],
      events: { click() {} }
    });
    TestView.setEventDelegator({ delegate: () => viewCleanup });
    const view = new TestView({ el: rootEl });

    expect(() => view.undelegateEvents()).to.throw(cleanupError);
    expect(viewCleanup).toHaveBeenCalledTimes(1);
    expect(behaviorCleanup).toHaveBeenCalledTimes(1);

    view.destroy();
  });

  it('finishes View teardown when its DOM cleanup throws', function() {
    const cleanupError = new Error('cleanup failed');
    const behaviorCleanup = vi.fn();
    const TestBehavior = Behavior.extend({ events: { click() {} } });
    TestBehavior.setEventDelegator({ delegate: () => behaviorCleanup });
    const TestView = View.extend({
      behaviors: [TestBehavior],
      events: { click() {} }
    });
    TestView.setEventDelegator({
      delegate: () => () => { throw cleanupError; }
    });
    const view = new TestView({ el: rootEl });
    const behavior = view._behaviors[0];
    const stopListening = vi.spyOn(view, 'stopListening');

    expect(() => view.destroy()).to.throw(cleanupError);
    expect(view.isDestroyed()).to.equal(true);
    expect(behavior._isDestroyed).to.equal(true);
    expect(behaviorCleanup).toHaveBeenCalledTimes(1);
    expect(stopListening).toHaveBeenCalledTimes(1);
    expect(rootEl.isConnected).to.equal(false);
  });

  it('finishes Behavior teardown when its DOM cleanup throws', function() {
    const cleanupError = new Error('cleanup failed');
    const TestBehavior = Behavior.extend({ events: { click() {} } });
    TestBehavior.setEventDelegator({
      delegate: () => () => { throw cleanupError; }
    });
    const view = new View({ el: rootEl });
    const behavior = new TestBehavior({}, view);
    const destroyState = vi.spyOn(behavior, '_destroyState');
    const stopListening = vi.spyOn(behavior, 'stopListening');
    const removeBehavior = vi.spyOn(view, '_removeBehavior');
    const deleteEntityEventHandlers = vi.spyOn(behavior, '_deleteEntityEventHandlers');

    expect(() => behavior.destroy()).to.throw(cleanupError);
    expect(destroyState).toHaveBeenCalledTimes(1);
    expect(stopListening).toHaveBeenCalledTimes(1);
    expect(removeBehavior).toHaveBeenCalledWith(behavior);
    expect(deleteEntityEventHandlers).toHaveBeenCalledTimes(1);

    view.destroy();
  });

  it('finishes View teardown when Behavior DOM cleanup throws', function() {
    const cleanupError = new Error('cleanup failed');
    const TestBehavior = Behavior.extend({ events: { click() {} } });
    TestBehavior.setEventDelegator({
      delegate: () => () => { throw cleanupError; }
    });
    const TestView = View.extend({ behaviors: [TestBehavior] });
    const view = new TestView({ el: rootEl });
    const state = view.getState();
    const onDestroy = vi.fn();
    const stopListening = vi.spyOn(view, 'stopListening');
    view.on('destroy', onDestroy);

    expect(() => view.destroy()).to.throw(cleanupError);
    expect(view.isDestroyed()).to.equal(true);
    expect(state.isDestroyed()).to.equal(true);
    expect(onDestroy).toHaveBeenCalledTimes(1);
    expect(stopListening).toHaveBeenCalled();
    expect(rootEl.isConnected).to.equal(false);
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

    expect(adapter.delegate).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('rejects an adapter that does not return cleanup', function() {
    const TestView = View.extend({ events: { click() {} } });
    TestView.setEventDelegator({ delegate() {} });

    expect(() => new TestView({ el: rootEl }))
      .to.throw('EventDelegator.delegate must return a cleanup function.')
      .with.property('code', 'MN0036');
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
