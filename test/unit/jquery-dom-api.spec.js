import $ from 'jquery';
import {
  Behavior,
  CollectionView,
  DomApi,
  Region,
  View
} from '../../index';
import JQueryDomApi from '../../jquery-dom-api';

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
      input: 'index.js',
      external: ['underscore'],
      plugins: [jqueryBlocker],
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

    expect(DomApi.wrapEl).to.be.undefined;
    expect(view).to.not.have.property('$el');
    expect(collectionView).to.not.have.property('$el');
  });

  it('provides wrapEl on the jQuery DomApi adapter', function() {
    const el = document.createElement('div');

    expect(JQueryDomApi.wrapEl(el)).to.be.instanceof($);
    expect(JQueryDomApi.wrapEl(el)[0]).to.equal(el);
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

  it('returns a jQuery collection from view.$() with the jQuery DomApi', function() {
    const JQueryView = View.extend();
    JQueryView.setDomApi(JQueryDomApi);
    const view = new JQueryView({
      el: document.createElement('div')
    });
    const child = document.createElement('span');
    child.className = 'child';
    view.el.appendChild(child);

    const result = view.$('.child');

    expect(result).to.be.instanceof($);
    expect(result[0]).to.equal(child);
    expect(view.$el).to.be.instanceof($);
    expect(view.$el[0]).to.equal(view.el);
  });

  it('creates $el for CollectionView when the jQuery DomApi is active', function() {
    const JQueryCollectionView = CollectionView.extend();
    JQueryCollectionView.setDomApi(JQueryDomApi);

    const view = new JQueryCollectionView();

    expect(view.$el).to.be.instanceof($);
    expect(view.$el[0]).to.equal(view.el);
  });

  it('refreshes $el when setElement changes the view element', function() {
    const JQueryView = View.extend();
    JQueryView.setDomApi(JQueryDomApi);
    const firstEl = document.createElement('div');
    const secondEl = document.createElement('section');
    const view = new JQueryView({ el: firstEl });

    view.setElement(secondEl);

    expect(view.el).to.equal(secondEl);
    expect(view.$el[0]).to.equal(secondEl);
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

  it('does not mutate a view when wrapEl throws', function() {
    const oldEl = document.createElement('div');
    const newEl = document.createElement('section');
    const error = new Error('wrap failed');
    const onClick = this.sinon.stub();
    const view = new View({
      el: oldEl,
      events: { click: onClick },
    });
    view.Dom = Object.assign({}, view.Dom, {
      wrapEl() {
        throw error;
      },
    });

    expect(() => view.setElement(newEl)).to.throw(error);
    expect(view.el).to.equal(oldEl);
    expect(view).to.not.have.property('$el');

    oldEl.click();

    expect(onClick).to.have.been.calledOnce;
  });

  it('mirrors the host view $el on behaviors', function() {
    let behavior;
    const JQueryView = View.extend({
      behaviors: [Behavior.extend({
        initialize() {
          behavior = this;
        },
      })],
    });
    JQueryView.setDomApi(JQueryDomApi);

    const view = new JQueryView();
    const nextEl = document.createElement('section');

    expect(behavior.$el).to.equal(view.$el);
    expect(behavior.$el[0]).to.equal(view.el);

    view.setElement(nextEl);

    expect(behavior.$el).to.equal(view.$el);
    expect(behavior.$el[0]).to.equal(nextEl);
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
