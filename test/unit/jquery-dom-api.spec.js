import { execFileSync } from 'child_process';
import $ from 'jquery';
import {
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

  it('does not provide wrapEl on the jQuery DomApi adapter', function() {
    expect(JQueryDomApi.wrapEl).to.be.undefined;
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
    expect(view).to.not.have.property('$el');
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
