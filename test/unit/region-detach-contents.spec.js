import { expect } from 'chai';
import { JSDOM } from 'jsdom';

import Region from '../../modules/region';

// Locks the v5 native `detachContents` policy: `Region.empty()` clears the
// region element when no view is shown. The contrasting jQuery DomApi behavior
// is covered by `test/unit/jquery-dom-api.spec.js`
// ("preserves detached content listeners with the jQuery DomApi"). Together
// these tests document the v5 policy: native default clears via
// `el.textContent = ''`; the optional jQuery adapter calls
// `$(el).contents().detach()` for v4-compatible detach-for-reinsertion
// semantics.

describe('Region.empty() with the native DomApi', function() {
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

  it('clears the region element contents when no view is shown', function() {
    const root = document.getElementById('region');
    root.appendChild(document.createElement('span'));
    root.appendChild(document.createTextNode('inner'));

    const region = new Region({ el: root });
    region.empty();

    expect(root.childNodes).to.have.length(0);
    expect(root.textContent).to.equal('');
  });
});
