import $ from 'jquery';
import compile from '../../build/babel.js';
import {
  CollectionView,
  Region,
  View
} from '../../src/index';
import JQueryDomApi from '../../packages/adapters/src/dom/jquery';

describe('jQuery DomApi adapter', function() {
  it('allows the core ESM graph to bundle without circular dependencies or importing jQuery', async function() {
    const bundler = require('rollup');
    const warnings = [];
    const jqueryBlocker = {
      name: 'jquery-blocker',
      resolveId(source) {
        if (source === 'jquery') {
          throw new Error('jquery should not be imported');
        }

        return null;
      }
    };

    const bundle = await bundler.rollup({
      input: 'src/index.ts',
      external: ['underscore'],
      plugins: [jqueryBlocker, compile()],
      onwarn(warning, warn) {
        warnings.push(warning);
        warn(warning);
      }
    });

    await bundle.close();

    expect(warnings).to.be.empty;
  });

  it('does not create $el with the native DomApi', function() {
    const view = new View();
    const collectionView = new CollectionView();

    expect(view).to.not.have.property('$el');
    expect(collectionView).to.not.have.property('$el');
  });

  it('configures jQuery DOM operations independently of $el', function() {
    const QueryView = View.extend();
    QueryView.setDomApi(JQueryDomApi);
    const view = new QueryView();
    expect(view.$('span')).to.be.instanceof($);
    expect(view).to.not.have.property('$el');
    view.destroy();
  });

  it('returns native results from view.$() with the native DomApi', function() {
    const view = new View({
      el: document.createElement('div')
    });
    const child = document.createElement('span');
    child.className = 'child';
    view.el.appendChild(child);

    const result = view.$('.child');

    expect(result).to.be.instanceof(window.NodeList);
    expect(result[0]).to.equal(child);
  });

  [
    ['View', View],
    ['CollectionView', CollectionView],
  ].forEach(([name, ViewClass]) => {
    it(`rejects a jQuery-wrapped ${ name } el with the migration diagnostic`, function() {
      const WrappedView = ViewClass.extend();
      WrappedView.setDomApi(JQueryDomApi);
      const wrappedEl = $(document.createElement('div'));

      let error;
      try { new WrappedView({ el: wrappedEl }); } catch (err) { error = err; }

      expect(error).to.be.instanceOf(Error);
      expect(error.code).to.equal('MN0001');
      expect(error.message).to.contain('must be a DOM element');
      expect(error.message).to.contain('wrappedEl[0]');
    });
  });

  it('detaches elements without removing listeners with the jQuery DomApi', function() {
    const parent = document.createElement('div');
    const child = document.createElement('button');
    const onClick = this.sinon.stub();
    child.addEventListener('click', onClick);
    parent.appendChild(child);
    document.body.appendChild(parent);

    JQueryDomApi.detachEl(child);
    child.click();

    expect(parent.childNodes).to.have.length(0);
    expect(document.body.contains(child)).to.be.false;
    expect(onClick).to.have.been.calledOnce;
  });

  it('replaces element contents with the jQuery DomApi', function() {
    const el = document.createElement('div');
    const oldChild = document.createElement('span');
    oldChild.className = 'old';
    el.appendChild(oldChild);

    JQueryDomApi.setContents(el, '<strong class="new">New</strong>');

    expect(el.querySelector('.old')).to.be.null;
    expect(el.querySelector('.new').textContent).to.equal('New');
  });

  it('appends contents with the jQuery DomApi', function() {
    const el = document.createElement('div');
    const child = document.createElement('span');
    child.className = 'child';

    JQueryDomApi.appendContents(el, child);

    expect(el.childNodes).to.have.length(1);
    expect(el.firstChild).to.equal(child);
  });

  it('preserves detached content listeners with the jQuery DomApi', function() {
    const el = document.createElement('div');
    const child = document.createElement('button');
    const onClick = this.sinon.stub();
    child.addEventListener('click', onClick);
    el.appendChild(child);

    JQueryDomApi.detachContents(el);
    child.click();

    expect(el.childNodes).to.have.length(0);
    expect(onClick).to.have.been.calledOnce;
  });

  it('allows Region selector resolution with the jQuery DomApi findEl shape', function() {
    const root = document.createElement('div');
    root.id = 'region-root';
    document.body.appendChild(root);
    const JQueryRegion = Region.extend();
    JQueryRegion.setDomApi(JQueryDomApi);

    const region = new JQueryRegion({ el: '#region-root' });
    region.empty();

    expect(region.el).to.equal(root);
  });
});

// Applications can keep a wrapper because the root identity does not change.
it('supports an application-owned $el initialized once', function() {
  const JQueryView = View.extend({ initialize() { this.$el = $(this.el); } });
  JQueryView.setDomApi(JQueryDomApi);
  const view = new JQueryView({ template: () => '<button>Action</button>' });
  const wrapped = view.$el;
  view.render();
  view.render();
  expect(view.$('button')).to.be.instanceof($);
  expect(view.$el).to.equal(wrapped);
  expect(wrapped[0]).to.equal(view.el);
  view.destroy();
});
