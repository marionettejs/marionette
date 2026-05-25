const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const JSDOM = require('jsdom').JSDOM;

chai.use(sinonChai);

global.chai = chai;
global.expect = chai.expect;
global.sinon = sinon;

if (!global.document || !global.window) {
  const dom = new JSDOM(`
    <html>
      <head></head>
      <body></body>
    </html>
  `, {
    url: 'http://localhost'
  });

  global.window = dom.window;
  global.document = global.window.document;
  Object.defineProperty(global, 'navigator', {
    configurable: true,
    value: global.window.navigator
  });
}

beforeEach(function() {
  this.sinon = global.sinon.createSandbox();
});

afterEach(function() {
  this.sinon.restore();
  document.body.innerHTML = '';
});
