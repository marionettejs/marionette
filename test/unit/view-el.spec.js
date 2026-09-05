import { JSDOM } from 'jsdom';

import View from '../../src/modules/view';
import CollectionView from '../../src/modules/collection-view';
import MarionetteError from '../../src/modules/error';

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

  it('uses only own enumerable attributes and safely applies __proto__', function() {
    const symbol = Symbol('ignored');
    const protoValue = { polluted: true };
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
    const attributes = this.sinon.stub().returns(attributeHash);
    const AttributeView = View.extend({
      attributes,
      className: 'canonical-class',
      id: 'canonical-id'
    });
    const elementPrototype = Object.getPrototypeOf(document.createElement('div'));

    const view = new AttributeView();

    expect(attributes).to.have.been.calledOnce.and.calledOn(view);
    expect(view.el.title).to.equal('owned');
    expect(view.el.dataset.owned).to.equal('owned');
    expect(view.el.getAttribute('data-inherited')).to.be.null;
    expect(view.el.getAttribute('data-hidden')).to.be.null;
    expect(view.el[symbol]).to.be.undefined;
    expect(view.el.id).to.equal('canonical-id');
    expect(view.el.className).to.equal('canonical-class');
    expect(Object.getPrototypeOf(view.el)).to.equal(elementPrototype);
    expect(Object.hasOwn(view.el, '__proto__')).to.be.true;
    expect(Object.getOwnPropertyDescriptor(view.el, '__proto__').value).to.equal(protoValue);
  });

  it('accepts a function-valued el that returns a DOM element', function() {
    const rootEl = document.getElementById('root');
    const view = new View({ el: () => rootEl });

    expect(view.el).to.equal(rootEl);
  });

  function expectStringElThrow(action) {
    let error;
    try { action(); } catch (err) { error = err; }

    expect(error).to.be.instanceOf(MarionetteError);
    expect(error.code).to.equal('MN0001');
    expect(error.name).to.equal('ViewError');
    expect(error.message).to.contain('must be a DOM element');
    expect(error.message).to.contain('document.querySelector');
  }

  it('throws a ViewError with a migration hint when el is a selector string', function() {
    expectStringElThrow(() => new View({ el: '#root' }));
  });

  it('throws a ViewError when a function-valued el returns a string', function() {
    expectStringElThrow(() => new View({ el: () => '#root' }));
  });

  it('throws a ViewError when setElement receives a string', function() {
    const view = new View({ el: document.getElementById('root') });

    expectStringElThrow(() => view.setElement('#other'));
  });

  it('throws a ViewError when CollectionView setElement receives a string', function() {
    const cv = new CollectionView({ el: document.getElementById('root') });

    expectStringElThrow(() => cv.setElement('#other'));
  });
});
