import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  chai,
  it,
  test
} from 'vitest';
import _ from 'underscore';
import $ from 'jquery';
import Backbone from 'backbone';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as Marionette from '../../index.js';

chai.use(sinonChai);

chai.use(function(chaiInstance, utils) {
  chaiInstance.Assertion.addMethod('$text', function(expectedText) {
    const obj = utils.flag(this, 'object');
    this.assert(
      $(obj).text() === expectedText,
      'expected #{this} to have text #{exp}',
      'expected #{this} not to have text #{exp}',
      expectedText
    );
  });

  chaiInstance.Assertion.addMethod('$html', function(expectedHtml) {
    const obj = utils.flag(this, 'object');
    const html = $(obj).html() || '';
    this.assert(
      html.indexOf(expectedHtml) !== -1,
      'expected #{this} to contain html #{exp}',
      'expected #{this} not to contain html #{exp}',
      expectedHtml
    );
  });
});

let $fixtures;

function setFixtures(...contents) {
  contents.forEach(content => $fixtures.append(content));
}

function clearFixtures() {
  $fixtures.empty();
}

globalThis.sinon = sinon;
globalThis._ = _;
globalThis.Backbone = Backbone;
globalThis.Marionette = Marionette;
globalThis.Radio = Marionette.Radio;
globalThis.before = beforeAll;
globalThis.after = afterAll;

// Specs use Mocha-style `function() { this.sinon, this.setFixtures }`.
// Vitest passes context as an argument; bridge it to `this`.
globalThis.beforeEach = fn => beforeEach(ctx => fn.call(ctx, ctx));
globalThis.afterEach = fn => afterEach(ctx => fn.call(ctx, ctx));

function wrap(api) {
  return (name, options, fn) => {
    if (typeof options === 'function') {
      return api(name, ctx => options.call(ctx, ctx));
    }
    return api(name, options, ctx => fn.call(ctx, ctx));
  };
}

function wrapTest(api) {
  const wrapped = wrap(api);
  wrapped.only = wrap(api.only);
  wrapped.skip = wrap(api.skip);
  wrapped.todo = api.todo;
  return wrapped;
}

globalThis.it = wrapTest(it);
globalThis.test = wrapTest(test);

beforeAll(function() {
  $fixtures = $('<div id="fixtures">');
  $('body').append($fixtures);
});

afterAll(function() {
  if ($fixtures) {
    $fixtures.remove();
    $fixtures = null;
  }
});

globalThis.beforeEach(function() {
  this.sinon = sinon.createSandbox();
  this.setFixtures = setFixtures;
  this.clearFixtures = clearFixtures;
});

globalThis.afterEach(function() {
  this.sinon.restore();
  // Restores bare `sinon.spy(obj, m)` / `sinon.stub(obj, m)` calls that
  // bypass the per-test sandbox.
  sinon.restore();
  if (globalThis.window) {
    window.location.hash = '';
  }
  Backbone.history.stop();
  Backbone.history.handlers.length = 0;
  if ($fixtures) {
    clearFixtures();
  }
});
