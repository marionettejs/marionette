module.exports = function() {

  if (process.env.USE_LODASH) {
    const pathScore = require.resolve('underscore');
    const pathDash = require.resolve('lodash');
    require(pathDash);

    require.cache[pathScore] = require.cache[pathDash];
  }

  const lib = process.env.USE_LODASH ? 'lodash' : 'underscore';

  const _ = require('underscore');

  // eslint-disable-next-line
  console.log('Using ' + lib + ': ' + _.VERSION);

  const Backbone = require('backbone');
  const jQuery = require('jquery');
  Backbone.$ = jQuery;
  Backbone.Radio = require('backbone.radio');
  let Marionette = require('../../src/backbone.marionette');

  Marionette = 'default' in Marionette ? Marionette.default : Marionette;

  global.$ = global.jQuery = jQuery;
  global._ = _;
  global.Backbone = Backbone;
  global.Marionette = Backbone.Marionette = Marionette;

  global.expect = global.chai.expect;

  let $fixtures;

  function setFixtures() {
    _.each(arguments, function(content) {
      $fixtures.append(content);
    });
  }

  function clearFixtures() {
    $fixtures.empty();
  }

  before(function() {
    $fixtures = $('<div id="fixtures">');
    $('body').append($fixtures);
    this.setFixtures = setFixtures;
    this.clearFixtures = clearFixtures;
  });

  beforeEach(function() {
    this.sinon = global.sinon.createSandbox();
  });

  afterEach(function() {
    this.sinon.restore();
    window.location.hash = '';
    Backbone.history.stop();
    Backbone.history.handlers.length = 0;
    clearFixtures();
  });
};
