import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

import { CollectionView, View } from 'marionette';

describe('View#renderAttributes', function() {
  let document;
  let previousDocument;
  let previousWindow;

  beforeEach(function() {
    previousDocument = global.document;
    previousWindow = global.window;

    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    document = dom.window.document;
    global.document = document;
    global.window = dom.window;
  });

  afterEach(function() {
    global.document = previousDocument;
    global.window = previousWindow;
  });

  [
    ['View', View],
    ['CollectionView', CollectionView]
  ].forEach(([name, ViewClass]) => {
    it(`refreshes ${ name } root declarations with explicit null removal`, function() {
      const state = {
        className: 'initial-class',
        empty: 'initial',
        falseValue: 'initial',
        id: 'initial-id',
        includeOmitted: true,
        nullValue: 'remove-with-null',
        title: 'initial-title',
        undefinedValue: 'keep-with-undefined',
        zero: 'initial'
      };
      const DynamicView = ViewClass.extend({
        attributes() {
          const attrs = {
            class: 'attributes-class',
            id: 'attributes-id',
            title: state.title,
            'data-null': state.nullValue,
            'data-undefined': state.undefinedValue,
            'data-false': state.falseValue,
            'data-zero': state.zero,
            'data-empty': state.empty
          };
          if (state.includeOmitted) { attrs['data-omitted'] = 'keep'; }
          return attrs;
        },

        className() {
          return state.className;
        },

        id() {
          return state.id;
        }
      });
      const view = new DynamicView();
      const root = view.el;
      root.setAttribute('data-external', 'untouched');

      expect(root.title).to.equal('initial-title');
      expect(root.id).to.equal('initial-id');
      expect(root.className).to.equal('initial-class');

      Object.assign(state, {
        className: null,
        empty: '',
        falseValue: false,
        id: 0,
        includeOmitted: false,
        nullValue: null,
        title: 'updated-title',
        undefinedValue: undefined,
        zero: 0
      });

      expect(view.renderAttributes()).to.equal(view);
      expect(view.el).to.equal(root);
      expect(root.title).to.equal('updated-title');
      expect(root.id).to.equal('0');
      expect(root.hasAttribute('class')).to.be.false;
      expect(root.hasAttribute('data-null')).to.be.false;
      expect(root.getAttribute('data-undefined')).to.equal('keep-with-undefined');
      expect(root.getAttribute('data-omitted')).to.equal('keep');
      expect(root.getAttribute('data-false')).to.equal('false');
      expect(root.getAttribute('data-zero')).to.equal('0');
      expect(root.getAttribute('data-empty')).to.equal('');
      expect(root.getAttribute('data-external')).to.equal('untouched');
      expect(view.isRendered()).to.be.false;


      state.id = null;
      state.className = '';
      view.renderAttributes();

      expect(root.hasAttribute('id')).to.be.false;
      expect(root.className).to.equal('');
      expect(root.hasAttribute('class')).to.be.true;
    });
  });

  it('leaves a supplied element unchanged until an explicit refresh', function() {
    const root = document.createElement('article');
    root.id = 'external-id';
    root.className = 'external-class';
    root.setAttribute('data-managed', 'external');
    root.setAttribute('data-unrelated', 'keep');
    const state = { managed: 'applied' };
    const attributes = vi.fn(function() {
      return { 'data-managed': state.managed };
    });
    const id = vi.fn(() => 'applied-id');
    const className = vi.fn(() => 'applied-class');
    const SuppliedElView = View.extend({ attributes, className, id });

    const view = new SuppliedElView({ el: root });

    expect(attributes).not.toHaveBeenCalled();
    expect(id).not.toHaveBeenCalled();
    expect(className).not.toHaveBeenCalled();
    expect(root.id).to.equal('external-id');
    expect(root.className).to.equal('external-class');
    expect(root.getAttribute('data-managed')).to.equal('external');

    view.renderAttributes();

    expect(root.id).to.equal('applied-id');
    expect(root.className).to.equal('applied-class');
    expect(root.getAttribute('data-managed')).to.equal('applied');
    expect(root.getAttribute('data-unrelated')).to.equal('keep');

    state.managed = undefined;
    view.renderAttributes();
    expect(root.getAttribute('data-managed')).to.equal('applied');

    state.managed = null;
    view.renderAttributes();

    expect(root.hasAttribute('data-managed')).to.be.false;
    expect(root.getAttribute('data-unrelated')).to.equal('keep');
  });

  it('applies and removes className on a supplied SVG root through the class attribute', function() {
    const root = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    let className = 'selected';
    const SvgView = View.extend({
      className() {
        return className;
      }
    });
    const view = new SvgView({ el: root });

    view.renderAttributes();

    expect(root.getAttribute('class')).to.equal('selected');
    expect(root.className.baseVal).to.equal('selected');

    className = null;
    view.renderAttributes();

    expect(root.hasAttribute('class')).to.be.false;
    expect(root.className.baseVal).to.equal('');
  });

  it('refreshes an own __proto__ attribute without changing element properties', function() {
    const elementPrototype = Object.getPrototypeOf(document.createElement('div'));
    let protoValue = 'ordinary attribute';
    const AttributeView = View.extend({
      attributes() {
        return Object.defineProperty({}, '__proto__', {
          enumerable: true,
          value: protoValue
        });
      }
    });
    const view = new AttributeView();

    expect(Object.getPrototypeOf(view.el)).to.equal(elementPrototype);
    expect(Object.hasOwn(view.el, '__proto__')).to.be.false;
    expect(view.el.getAttribute('__proto__')).to.equal(protoValue);

    protoValue = null;
    view.renderAttributes();

    expect(Object.getPrototypeOf(view.el)).to.equal(elementPrototype);
    expect(Object.hasOwn(view.el, '__proto__')).to.be.false;
    expect(view.el.hasAttribute('__proto__')).to.be.false;
  });

  it('does not evaluate declarations while destroying or destroyed', function() {
    const attributes = vi.fn().mockReturnValue({ title: 'resolved' });
    const AttributeView = View.extend({ attributes });
    const view = new AttributeView();
    const returns = [];
    attributes.mockClear();
    view.on('before:destroy', () => returns.push(view.renderAttributes()));

    view.destroy();
    returns.push(view.renderAttributes());

    expect(returns).to.deep.equal([view, view]);
    expect(attributes).not.toHaveBeenCalled();
  });

  it('does not render templates, emit lifecycle events, or rebind composition', function() {
    let title = 'initial';
    const attributes = vi.fn(() => ({ title }));
    const template = vi.fn().mockReturnValue('<span>rendered</span>');
    const AttributeView = View.extend({ attributes, template });
    const view = new AttributeView();
    const events = [];
    const bindUIElements = vi.spyOn(view, 'bindUIElements');
    const delegateEvents = vi.spyOn(view, 'delegateEvents');
    const region = view.addRegion('content', { el: document.createElement('div') });
    view.on('all', eventName => events.push(eventName));
    attributes.mockClear();

    title = 'refreshed';
    view.renderAttributes();

    expect(view.el.title).to.equal('refreshed');
    expect(view.isRendered()).to.be.false;
    expect(template).not.toHaveBeenCalled();
    expect(events).to.deep.equal([]);
    expect(bindUIElements).not.toHaveBeenCalled();
    expect(delegateEvents).not.toHaveBeenCalled();
    expect(view.getRegion('content')).to.equal(region);
    expect(region.isDestroyed()).to.be.false;

    attributes.mockClear();
    title = 'not-automatically-refreshed';
    view.render();

    expect(attributes).not.toHaveBeenCalled();
    expect(view.el.title).to.equal('refreshed');
  });

  it('uses the configured DOM API for each refresh', function() {
    let title = 'initial';
    const setAttributes = vi.fn();
    const CustomDomView = View.extend({
      attributes() {
        return { title };
      }
    });
    CustomDomView.setDomApi({ setAttributes });
    const view = new CustomDomView();
    setAttributes.mockClear();

    title = 'updated';
    view.renderAttributes();

    expect(setAttributes).toHaveBeenCalledTimes(1);
    expect(setAttributes.mock.contexts[0] === view.Dom).toBe(true);
    expect(setAttributes.mock.calls[0]).toHaveLength(2);
    expect(setAttributes.mock.calls[0][0] === view.el).toBe(true);
    expect(setAttributes.mock.calls[0][1]).toEqual({ title: 'updated' });
  });
});
