import { execFileSync } from 'child_process';
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
  it('allows core Marionette to require without importing jQuery', function() {
    const script = `
      require('@babel/register');
      const Module = require('module');
      const load = Module._load;
      Module._load = function(request) {
        if (request === 'jquery') {
          throw new Error('jquery should not be imported');
        }
        return load.apply(this, arguments);
      };
      require('./index');
    `;

    expect(() => execFileSync(process.execPath, ['-e', script], { cwd: process.cwd() }))
      .to.not.throw();
  });

  it('allows the core ESM graph to bundle without importing jQuery', function() {
    const bundler = require('rollup');
    const jqueryBlocker = {
      name: 'jquery-blocker',
      resolveId(source) {
        if (source === 'jquery') {
          throw new Error('jquery should not be imported');
        }

        return null;
      }
    };

    return bundler.rollup({
      input: 'index.js',
      external: ['underscore'],
      plugins: [jqueryBlocker]
    });
  });

  it('does not create $el with the native DomApi', function() {
    const view = new View();
    const collectionView = new CollectionView();

    expect(DomApi.wrapEl).to.be.undefined;
    expect(view).to.not.have.property('$el');
    expect(collectionView).to.not.have.property('$el');
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

  it('creates a jQuery $el when the jQuery DomApi is active before construction', function() {
    const JQueryView = View.extend();
    JQueryView.setDomApi(JQueryDomApi);

    const view = new JQueryView();

    expect(view.$el).to.be.instanceof($);
    expect(view.$el[0]).to.equal(view.el);
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
  });

  it('does not retro-mutate existing views when a subclass switches DomApi', function() {
    const NativeView = View.extend();
    const existingView = new NativeView();

    NativeView.setDomApi(JQueryDomApi);
    const jqueryView = new NativeView();

    expect(existingView).to.not.have.property('$el');
    expect(existingView.Dom.wrapEl).to.be.undefined;
    expect(jqueryView.$el).to.be.instanceof($);
  });

  it('does not mutate an existing view when wrapEl throws', function() {
    const oldEl = document.createElement('div');
    const newEl = document.createElement('section');
    const error = new Error('wrap failed');
    const view = new View({ el: oldEl });
    view.Dom = Object.assign({}, view.Dom, {
      wrapEl() {
        throw error;
      }
    });

    expect(() => view.setElement(newEl)).to.throw(error);
    expect(view.el).to.equal(oldEl);
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

    const region = new JQueryRegion({ el: root });
    region._setElement('#region-root');

    expect(region.el).to.equal(root);
  });

  it('mirrors host view $el on behaviors when present', function() {
    let behavior;
    const JQueryView = View.extend({
      behaviors: [Behavior.extend({
        initialize() {
          behavior = this;
        }
      })]
    });
    JQueryView.setDomApi(JQueryDomApi);

    const view = new JQueryView();

    expect(behavior.$el).to.equal(view.$el);
    expect(behavior.$el[0]).to.equal(view.el);
  });
});
