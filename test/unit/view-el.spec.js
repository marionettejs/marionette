import { JSDOM } from 'jsdom';

import View from '../../modules/view';
import CollectionView from '../../modules/collection-view';
import MarionetteError from '../../utils/error';

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

  it('accepts a function-valued el that returns a DOM element', function() {
    const rootEl = document.getElementById('root');
    const view = new View({ el: () => rootEl });

    expect(view.el).to.equal(rootEl);
  });

  function expectStringElThrow(action) {
    let error;
    try { action(); } catch (err) { error = err; }

    expect(error).to.be.instanceOf(MarionetteError);
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
