import { JSDOM } from 'jsdom';

import CollectionView from '../../modules/collection-view';
import View from '../../modules/view';

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
    it(`refreshes ${ name } root declarations with explicit nullish removal`, function() {
      const state = {
        className: 'initial-class',
        empty: 'initial',
        falseValue: 'initial',
        id: 'initial-id',
        includeOmitted: true,
        nullValue: 'remove-with-null',
        title: 'initial-title',
        undefinedValue: 'remove-with-undefined',
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
      expect(root.hasAttribute('data-undefined')).to.be.false;
      expect(root.getAttribute('data-omitted')).to.equal('keep');
      expect(root.getAttribute('data-false')).to.equal('false');
      expect(root.getAttribute('data-zero')).to.equal('0');
      expect(root.getAttribute('data-empty')).to.equal('');
      expect(root.getAttribute('data-external')).to.equal('untouched');
      expect(view.isRendered()).to.be.false;
      expect(view).not.to.have.property('_renderedAttributeNames');

      state.id = undefined;
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
    const attributes = this.sinon.spy(function() {
      return { 'data-managed': state.managed };
    });
    const id = this.sinon.spy(() => 'applied-id');
    const className = this.sinon.spy(() => 'applied-class');
    const SuppliedElView = View.extend({ attributes, className, id });

    const view = new SuppliedElView({ el: root });

    expect(attributes).not.to.have.been.called;
    expect(id).not.to.have.been.called;
    expect(className).not.to.have.been.called;
    expect(root.id).to.equal('external-id');
    expect(root.className).to.equal('external-class');
    expect(root.getAttribute('data-managed')).to.equal('external');

    view.renderAttributes();

    expect(root.id).to.equal('applied-id');
    expect(root.className).to.equal('applied-class');
    expect(root.getAttribute('data-managed')).to.equal('applied');
    expect(root.getAttribute('data-unrelated')).to.equal('keep');

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

  it('safely refreshes and removes an own __proto__ declaration', function() {
    const elementPrototype = Object.getPrototypeOf(document.createElement('div'));
    let protoValue = { polluted: true };
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
    expect(Object.hasOwn(view.el, '__proto__')).to.be.true;
    expect(Object.getOwnPropertyDescriptor(view.el, '__proto__').value).to.equal(protoValue);

    protoValue = null;
    view.renderAttributes();

    expect(Object.getPrototypeOf(view.el)).to.equal(elementPrototype);
    expect(Object.hasOwn(view.el, '__proto__')).to.be.false;
    expect(Object.prototype).not.to.have.property('polluted');
  });

  it('does not evaluate declarations while destroying or destroyed', function() {
    const attributes = this.sinon.stub().returns({ title: 'resolved' });
    const AttributeView = View.extend({ attributes });
    const view = new AttributeView();
    const returns = [];
    attributes.resetHistory();
    view.on('before:destroy', () => returns.push(view.renderAttributes()));

    view.destroy();
    returns.push(view.renderAttributes());

    expect(returns).to.deep.equal([view, view]);
    expect(attributes).not.to.have.been.called;
  });

  it('does not render templates, emit lifecycle events, or rebind composition', function() {
    let title = 'initial';
    const attributes = this.sinon.spy(() => ({ title }));
    const template = this.sinon.stub().returns('<span>rendered</span>');
    const AttributeView = View.extend({ attributes, template });
    const view = new AttributeView();
    const events = [];
    const bindUIElements = this.sinon.spy(view, 'bindUIElements');
    const delegateEvents = this.sinon.spy(view, 'delegateEvents');
    const reInitRegions = this.sinon.spy(view, '_reInitRegions');
    view.on('all', eventName => events.push(eventName));
    attributes.resetHistory();

    title = 'refreshed';
    view.renderAttributes();

    expect(view.el.title).to.equal('refreshed');
    expect(view.isRendered()).to.be.false;
    expect(template).not.to.have.been.called;
    expect(events).to.deep.equal([]);
    expect(bindUIElements).not.to.have.been.called;
    expect(delegateEvents).not.to.have.been.called;
    expect(reInitRegions).not.to.have.been.called;

    attributes.resetHistory();
    title = 'not-automatically-refreshed';
    view.render();

    expect(attributes).not.to.have.been.called;
    expect(view.el.title).to.equal('refreshed');
  });

  it('uses the configured DOM API for each refresh', function() {
    let title = 'initial';
    const setAttributes = this.sinon.stub();
    const CustomDomView = View.extend({
      attributes() {
        return { title };
      }
    });
    CustomDomView.setDomApi({ setAttributes });
    const view = new CustomDomView();
    setAttributes.resetHistory();

    title = 'updated';
    view.renderAttributes();

    expect(setAttributes).to.have.been.calledOnce
      .and.calledOn(view.Dom)
      .and.calledWithExactly(view.el, { title: 'updated' });
  });
});
