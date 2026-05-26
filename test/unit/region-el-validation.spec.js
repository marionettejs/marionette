import { JSDOM } from 'jsdom';

import Region from '../../modules/region';
import MarionetteError from '../../utils/error';

describe('Region el validation', function() {
  let document;
  let previousDocument;
  let previousWindow;

  beforeEach(function() {
    previousDocument = global.document;
    previousWindow = global.window;

    const dom = new JSDOM('<!doctype html><html><body><div id="region"></div></body></html>');
    document = dom.window.document;
    global.document = document;
    global.window = dom.window;
  });

  afterEach(function() {
    global.document = previousDocument;
    global.window = previousWindow;
  });

  it('accepts a DOM element', function() {
    const el = document.createElement('div');
    const region = new Region({ el });

    expect(region.el).to.equal(el);
  });

  it('accepts a selector string and resolves it via DomApi', function() {
    const el = document.getElementById('region');
    const region = new Region({ el: '#region' });

    expect(region._ensureElement()).to.equal(true);
    expect(region.el).to.equal(el);
  });

  it('accepts construction without an el option', function() {
    expect(() => new Region()).to.not.throw();
    expect(() => new Region({})).to.not.throw();
  });

  [
    ['array', []],
    ['plain object', {}],
    ['NodeList', null] // built in test body — NodeList requires document
  ].forEach(([label, value]) => {
    it(`rejects ${label} el with a RegionError`, function() {
      const el = value === null ? document.querySelectorAll('#region') : value;

      expect(() => new Region({ el })).to.throw(MarionetteError).with.property('name', 'RegionError');
    });
  });

  it('validates el on _setEl as well as construction', function() {
    const region = new Region({ el: document.createElement('div') });

    expect(() => region._setEl([])).to.throw(MarionetteError).with.property('name', 'RegionError');
  });
});
