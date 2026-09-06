import $ from 'jquery';
import compile from '../../build/babel.js';
import {
  Behavior,
  CollectionView,
  DomApi,
  Region,
  View
} from '../../src/index';
import JQueryDomApi from '../../packages/adapters/src/dom/jquery';
import withJQuery from '../../packages/adapters/src/dom/jquery-view';

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

  it('leaves the original classes and DOM methods unchanged', function() {
    const delegateEvents = View.prototype.delegateEvents;
    const JQueryView = withJQuery(View);
    const view = new JQueryView();
    expect(View.prototype).to.not.have.property('$el');
    expect(JQueryView.prototype.delegateEvents).to.equal(delegateEvents);
    expect(DomApi).to.not.have.property('wrapEl');
    expect(view.$el).to.equal(view.$el);
    view.destroy();
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

  it('returns a jQuery collection from view.$() with the jQuery DomApi', function() {
    const JQueryView = withJQuery(View);
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
    const JQueryCollectionView = withJQuery(CollectionView);

    const view = new JQueryCollectionView();

    expect(view.$el).to.be.instanceof($);
    expect(view.$el[0]).to.equal(view.el);
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

  it('mirrors the host view $el on behaviors', function() {
    let behavior;
    let initializedEl;
    let initialized$El;
    const JQueryView = withJQuery(View).extend({
      behaviors: [withJQuery(Behavior).extend({
        initialize() {
          behavior = this;
          initializedEl = this.el;
          initialized$El = this.$el;
        },
      })],
    });

    const view = new JQueryView();

    expect(behavior.$el).to.equal(view.$el);
    expect(behavior.$el[0]).to.equal(view.el);
    expect(initializedEl).to.equal(view.el);
    expect(initialized$El).to.equal(view.$el);


    expect(behavior.$el).to.equal(view.$el);
    expect(behavior.$el[0]).to.equal(view.el);
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
