import './setup.mjs';
import {test, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {html, svg, render, nothing, noChange} from '@mnjs/html';
import {directive, Directive} from '@mnjs/html/directive';
import {AsyncDirective} from '@mnjs/html/async-directive';
import {createRef, ref} from '@mnjs/html/directives/ref.js';
import {templateContent} from '@mnjs/html/directives/template-content.js';
import {unsafeHTML} from '@mnjs/html/directives/unsafe-html.js';
import {unsafeSVG} from '@mnjs/html/directives/unsafe-svg.js';
import {unsafeMathML} from '@mnjs/html/directives/unsafe-mathml.js';
import {html as staticHtml, literal, unsafeStatic} from '@mnjs/html/static';
import * as lit from 'lit-html';
import {directive as litDirective, Directive as LitDirective} from 'lit-html/directive.js';

const roots = [];
function fixture() {
  const el = document.createElement('div');
  document.body.append(el);
  roots.push(el);
  return el;
}
afterEach(() => {
  for (const el of roots.splice(0)) {
    render(nothing, el).setConnected(false);
    el.remove();
  }
});

test('non-event on-prefix attributes and properties work normally', () => {
  const el = fixture();
  const data = {enabled: true};
  render(html`<div .one=${1} ?online=${true} .onboarding=${data} data-onward=${'yes'}></div>`, el);
  const child = el.firstElementChild;
  assert.equal(child.one, 1);
  assert.equal(child.hasAttribute('online'), true);
  assert.equal(child.onboarding, data);
  assert.equal(child.getAttribute('data-onward'), 'yes');
});

let foreignCalls = 0;
const development = process.execArgv.includes('--conditions=development');
class Foreign extends LitDirective {
  render() { foreignCalls++; return 'foreign'; }
}
const foreign = litDirective(Foreign);
const positions = {
  child: value => html`<div>${value}</div>`,
  attribute: value => html`<div title=${value}></div>`,
  compound: value => html`<div title="before ${value} after"></div>`,
  property: value => html`<div .payload=${value}></div>`,
  boolean: value => html`<div ?hidden=${value}></div>`,
  element: value => html`<div ${value}></div>`,
};
for (const [name, template] of Object.entries(positions)) {
  test(`foreign directives are not executed as local ${name} directives`, () => {
    const el = fixture();
    let disconnects = 0;
    class Local extends AsyncDirective {
      render() { return noChange; }
      disconnected() { disconnects++; }
    }
    render(template(directive(Local)()), el);
    if (development) {
      assert.throws(() => render(template(foreign()), el), /MN_HTML_FOREIGN_VALUE/);
      assert.equal(disconnects, 0);
    } else {
      render(template(foreign()), el);
      assert.equal(disconnects, 1);
    }
    assert.equal(foreignCalls, 0);
    render(nothing, el);
    assert.equal(disconnects, 1);
  });
}
test('nested local directives cannot smuggle a foreign result', () => {
  const el = fixture();
  class PassThrough extends Directive {
    render(value) { return value; }
  }
  const pass = directive(PassThrough);
  for (const value of [foreign(), lit.html`<b>foreign</b>`]) {
    if (development) assert.throws(() => render(pass(value), el), /MN_HTML_FOREIGN_VALUE/);
    else {
      render(pass(value), el);
      assert.equal(el.querySelector('b'), null);
      assert.equal(foreignCalls, 0);
    }
  }
});

test('ref objects track attach, disconnect, reconnect and removal', () => {
  const el = fixture();
  const element = createRef();
  const part = render(html`<input ${ref(element)}>`, el, {isConnected: false});
  const input = el.firstElementChild;
  assert.equal(element.value, undefined);
  part.setConnected(true);
  assert.equal(element.value, input);
  part.setConnected(false);
  assert.equal(element.value, undefined);
  part.setConnected(true);
  assert.equal(element.value, input);
  render(nothing, el);
  assert.equal(element.value, undefined);
});

test('ref callbacks preserve host context and clear when replaced', () => {
  const el = fixture();
  const host = {};
  const calls = [];
  function callback(value) { calls.push([this, value]); }
  const template = useRef => html`<input ${useRef ? ref(callback) : nothing}>`;
  render(template(true), el, {host});
  const input = el.firstElementChild;
  render(template(false), el);
  assert.deepEqual(calls, [[host, input], [host, undefined]]);
});

test('trusted templateContent is cloned, cached and replaced', () => {
  const el = fixture();
  const source = document.createElement('template');
  source.innerHTML = '<input value="authored">';
  const template = () => html`${templateContent(source)}`;
  render(template(), el);
  const input = el.firstElementChild;
  assert.notEqual(input, source.content.firstElementChild);
  input.value = 'edited';
  render(template(), el);
  assert.equal(el.firstElementChild, input);
  assert.equal(input.value, 'edited');
});

for (const [name, use, markup, tag, namespace] of [
  ['HTML', unsafeHTML, '<b>trusted</b>', 'b', 'http://www.w3.org/1999/xhtml'],
  ['SVG', unsafeSVG, '<circle cx="5"></circle>', 'circle', 'http://www.w3.org/2000/svg'],
  ['MathML', unsafeMathML, '<mn>3</mn>', 'mn', 'http://www.w3.org/1998/Math/MathML'],
]) {
  test(`explicit unsafe${name} renders trusted markup and clears`, () => {
    const el = fixture();
    const template = value => html`${use(value)}`;
    render(template(markup), el);
    const node = el.querySelector(tag);
    assert.equal(node.namespaceURI, namespace);
    render(template(markup), el);
    assert.equal(el.querySelector(tag), node);
    render(template(noChange), el);
    assert.equal(el.querySelector(tag), node);
    render(template(nothing), el);
    assert.equal(el.querySelector(tag), null);
    assert.throws(() => render(template(123), el), /non-string/);
  });
}

test('static literals change tag names without changing normal interpolation escaping', () => {
  const el = fixture();
  const tag = literal`section`;
  render(staticHtml`<${tag} title=${'<b>text</b>'}>${'<b>text</b>'}</${tag}>`, el);
  assert.equal(el.firstElementChild.tagName, 'SECTION');
  assert.equal(el.querySelector('b'), null);
  assert.equal(el.textContent, '<b>text</b>');
  render(staticHtml`<${unsafeStatic('article')}>trusted tag</${unsafeStatic('article')}>`, el);
  assert.equal(el.firstElementChild.tagName, 'ARTICLE');
});

test('production internals cannot overwrite ordinary custom directive fields', () => {
  const el = fixture();
  class Custom extends Directive {
    p = 'p';
    t = 't';
    $ = '$';
    render() { return this.p + this.t + this.$; }
  }
  render(directive(Custom)(), el);
  assert.equal(el.textContent, 'pt$');
});

for (const template of [
  svg`<animate onbegin=${'alert(1)'}></animate>`,
  svg`<animate onend=${'alert(1)'}></animate>`,
  svg`<animate onrepeat=${'alert(1)'}></animate>`,
]) {
  test('SVG animation event attributes reject even without IDL handler properties', () => {
    assert.throws(() => render(template, fixture()), /MN_HTML_EVENT_BINDING/);
  });
}

for (const template of [
  html`<input onfocusin=${'alert(1)'}>`,
  html`<input onfocusout=${'alert(1)'}>`,
  html`<div onbeforeload=${'alert(1)'}></div>`,
]) {
  test('inline handler attributes reject without an IDL property', () => {
    assert.throws(() => render(template, fixture()), /MN_HTML_EVENT_BINDING/);
  });
}

test('Lit-style helper entrypoint aliases resolve to the same implementation', async () => {
  const {directive: aliasDirective} = await import('@mnjs/html/directive.js');
  const {AsyncDirective: aliasAsync} = await import('@mnjs/html/async-directive.js');
  const {html: aliasStatic} = await import('@mnjs/html/static.js');
  const {isServer} = await import('@mnjs/html/is-server.js');
  assert.equal(aliasDirective, directive);
  assert.equal(aliasAsync, AsyncDirective);
  assert.equal(aliasStatic, staticHtml);
  assert.equal(isServer, false);
});
