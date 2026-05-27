import { JSDOM } from 'jsdom';
import { vi } from 'vitest';

import EventDelegator from '../../../config/event-delegator';

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
});
