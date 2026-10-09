import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

import { View } from 'marionette';

describe('View el policy', function() {
  let document;
  let previousDocument;
  let previousWindow;

  beforeEach(function() {
    previousDocument = global.document;
    previousWindow = global.window;

    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div><div id="other"></div></body></html>');
    document = dom.window.document;
    global.document = document;
    global.window = dom.window;
  });

  afterEach(function() {
    global.document = previousDocument;
    global.window = previousWindow;
  });

  it('accepts a DOM element el', function() {
    const rootEl = document.getElementById('root');
    const view = new View({ el: rootEl });

    expect(view.el).to.equal(rootEl);
  });

  it('creates a new element when no el option is provided', function() {
    const view = new View({ tagName: 'section', className: 'foo' });

    expect(view.el.tagName).to.equal('SECTION');
    expect(view.el.className).to.equal('foo');
  });

  it('uses own enumerable attributes without changing element properties', function() {
    const symbol = Symbol('ignored');
    const protoValue = 'ordinary attribute';
    const attributeHash = Object.assign(Object.create({ 'data-inherited': 'ignored' }), {
      class: 'attribute-class',
      id: 'attribute-id',
      title: 'owned',
      'data-owned': 'owned',
      [symbol]: 'ignored'
    });
    Object.defineProperty(attributeHash, 'data-hidden', { value: 'ignored' });
    Object.defineProperty(attributeHash, '__proto__', {
      enumerable: true,
      value: protoValue
    });
    const attributes = vi.fn().mockReturnValue(attributeHash);
    const AttributeView = View.extend({
      attributes,
      className: 'canonical-class',
      id: 'canonical-id'
    });
    const elementPrototype = Object.getPrototypeOf(document.createElement('div'));

    const view = new AttributeView();

    expect(attributes).toHaveBeenCalledTimes(1);
    expect(attributes.mock.contexts).toContain(view);
    expect(view.el.title).to.equal('owned');
    expect(view.el.dataset.owned).to.equal('owned');
    expect(view.el.getAttribute('data-inherited')).toBeNull();
    expect(view.el.getAttribute('data-hidden')).toBeNull();
    expect(view.el[symbol]).toBeUndefined();
    expect(view.el.id).to.equal('canonical-id');
    expect(view.el.className).to.equal('canonical-class');
    expect(Object.getPrototypeOf(view.el)).to.equal(elementPrototype);
    expect(Object.hasOwn(view.el, '__proto__')).toBe(false);
    expect(view.el.getAttribute('__proto__')).to.equal(protoValue);
  });

  it('accepts a function-valued el that returns a DOM element', function() {
    const rootEl = document.getElementById('root');
    const view = new View({ el: () => rootEl });

    expect(view.el).to.equal(rootEl);
  });

});
