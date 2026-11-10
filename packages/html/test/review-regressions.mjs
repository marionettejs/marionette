import {html, render, nothing, noChange} from '@mnjs/html';
import {html as staticHtml, svg as staticSvg, mathml as staticMathml, literal, unsafeStatic} from '@mnjs/html/static';
import {directive} from '@mnjs/html/directive';
import {AsyncDirective} from '@mnjs/html/async-directive';
import {keyed} from '@mnjs/html/directives/keyed.js';
import {until} from '@mnjs/html/directives/until.js';
import {range} from '@mnjs/html/directives/range.js';
import {classMap} from '@mnjs/html/directives/class-map.js';
import {styleMap} from '@mnjs/html/directives/style-map.js';

export function registerReviewRegressions(test, assert, development) {
const fixture = () => document.createElement('div');

test('keyed preserves sibling interpolation values in an attribute', () => {
  const el = fixture();
  const view = (key, value, sibling) => html`<div title="${sibling} / ${keyed(key, value)}"></div>`;
  render(view(1, 'first', 'kept'), el);
  assert.equal(el.firstElementChild.title, 'kept / first');
  render(view(2, 'second', noChange), el);
  assert.equal(el.firstElementChild.title, 'kept / second');
});

test('keyed pending compound values reset only their slot to empty text', () => {
  const el = fixture();
  const view = (key, value, sibling) => html`<div title="${sibling} / ${keyed(key, value)}"></div>`;
  render(view(1, 'old', 'kept'), el);
  render(view(2, noChange, noChange), el);
  assert.equal(el.firstElementChild.title, 'kept / ');
  render(view(3, until(new Promise(() => {})), noChange), el);
  assert.equal(el.firstElementChild.title, 'kept / ');
  render(nothing, el);
});

test('replacing a template with an iterable disposes nested async directives once', () => {
  let disconnected = 0;
  class Resource extends AsyncDirective {
    render() { return 'resource'; }
    disconnected() { disconnected++; }
  }
  const resource = directive(Resource);
  const el = fixture();
  const part = render(html`<span>${resource()}</span>`, el);
  render(['replacement'], el);
  assert.equal(disconnected, 1);
  assert.equal(el.textContent, 'replacement');
  part.setConnected(false);
  assert.equal(disconnected, 1);
});

test('static template cache cannot collide at a string separator', () => {
  const el = fixture();
  render(staticHtml`${unsafeStatic('a$$lit$$b')}${'X'}c`, el);
  assert.equal(el.textContent, 'a$$lit$$bXc');
  render(staticHtml`${unsafeStatic('a')}${'Y'}b$$lit$$c`, el);
  assert.equal(el.textContent, 'aYb$$lit$$c');
});

test('static segment caches keep terminal templates and longer prefixes distinct', () => {
  const el = fixture();
  for (const prefix of ['a', 'strings', '0:', '😀']) {
    const only = () => staticHtml`${unsafeStatic(prefix)}`;
    const longer = value => staticHtml`${unsafeStatic(prefix)}${value}`;
    for (const make of [only, () => longer('first'), only, () => longer('second')]) {
      const result = make();
      render(result, el);
      assert.equal(el.textContent, result.values.length ? prefix + result.values[0] : prefix);
    }
  }
  const longerFirst = value => staticHtml`${unsafeStatic('reverse')}${value}`;
  render(longerFirst('first'), el);
  render(staticHtml`${unsafeStatic('reverse')}`, el);
  assert.equal(el.textContent, 'reverse');
  render(longerFirst('second'), el);
  assert.equal(el.textContent, 'reversesecond');
});

test('static template cache separates HTML SVG and MathML parsing', () => {
  const tag = unsafeStatic('a');
  for (const [make, namespace] of [[staticHtml, 'http://www.w3.org/1999/xhtml'], [staticSvg, 'http://www.w3.org/2000/svg'], [staticMathml, 'http://www.w3.org/1998/Math/MathML']]) {
    const el = fixture();
    render(make`<${tag}></${tag}>`, el);
    assert.equal(el.firstElementChild.namespaceURI, namespace);
  }
});

test('literal rejects JSON-shaped unbranded static values', () => {
  const value = JSON.parse('{"_$mnHtmlStatic$":"<img src=x>"}');
  assert.throws(() => literal`${value}`, /literal|static/i);
  assert.doesNotThrow(() => literal`${literal`span`}`);
  assert.doesNotThrow(() => literal`${unsafeStatic('span')}`);
});

test('styleMap keeps camelCase important properties equivalent on update', () => {
  const el = fixture();
  const view = value => html`<div style=${styleMap({backgroundColor: value})}></div>`;
  render(view('red !important'), el);
  render(view('blue !important'), el);
  assert.equal(el.firstElementChild.style.backgroundColor, 'blue');
  assert.equal(el.firstElementChild.style.getPropertyPriority('background-color'), 'important');
  render(view('green'), el);
  assert.equal(el.firstElementChild.style.backgroundColor, 'green');
  assert.equal(el.firstElementChild.style.getPropertyPriority('background-color'), '');
  render(view(null), el);
  assert.equal(el.firstElementChild.style.backgroundColor, '');
});

test('range rejects zero step before yielding in either direction', () => {
  assert.throws(() => range(3, 0, 0)[Symbol.iterator]().next(), /step/i);
  assert.throws(() => range(0, 3, 0)[Symbol.iterator]().next(), /step/i);
});

for (const prefix of ['<!-->', '<!--->']) {
  test(`abrupt empty comment ${prefix} does not hide following bindings`, () => {
    const el = fixture();
    const view = value => staticHtml`${unsafeStatic(prefix)}<span title=${value}>${value}</span>`;
    render(view('first'), el);
    render(view('second'), el);
    assert.equal(el.firstElementChild.title, 'second');
    assert.equal(el.firstElementChild.textContent, 'second');
  });
}

test('classMap handles reordered and changing maps without touching static or external classes', () => {
  const el = fixture();
  const view = value => html`<div class="fixed ${classMap(value)}"></div>`;
  render(view({a: true, b: true, c: true, fixed: false}), el);
  el.firstElementChild.classList.add('external');
  const cases = [
    {c: true, b: true, a: true},
    {x: true, b: true, y: true},
    {x: true, b: true, y: true, z: true},
    {b: true},
    {},
    {a: true, b: true, c: true},
    {a: true, x: true, y: true, c: true},
    {a: true, b: true, c: true},
    {a: true, b: false, c: true},
  ];
  for (const value of cases) {
    render(view(value), el);
    const expected = ['fixed', 'external', ...Object.keys(value).filter(key => value[key])].sort().join(' ');
    assert.equal([...el.firstElementChild.classList].sort().join(' '), expected);
  }
});

test('classMap matches own enumerable truthy keys through deterministic map churn', () => {
  const el = fixture();
  const view = value => html`<div class="fixed ${classMap(value)}"></div>`;
  let seed = 3809;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let iteration = 0; iteration < 100; iteration++) {
    const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    for (let i = names.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [names[i], names[j]] = [names[j], names[i]];
    }
    const value = Object.create({inherited: true});
    for (const name of names) {
      if (random() < 0.75) Object.defineProperty(value, name, {
        value: random() < 0.6, enumerable: random() < 0.85,
      });
    }
    render(view(value), el);
    const expected = ['fixed', ...Object.keys(value).filter(name => value[name])].sort().join(' ');
    assert.equal([...el.firstElementChild.classList].sort().join(' '), expected);
  }
});

test('classMap consistently ignores inherited properties and removes former own keys', () => {
  const el = fixture();
  const view = value => html`<div class=${classMap(value)}></div>`;
  render(view(Object.assign(Object.create({inherited: true}), {own: true})), el);
  assert.equal(el.firstElementChild.className.trim(), 'own');
  render(view(Object.assign(Object.create({own: true, inherited: true}), {next: true})), el);
  assert.equal(el.firstElementChild.className.trim(), 'next');
  render(view(Object.defineProperty({}, 'next', {value: true, enumerable: false})), el);
  assert.equal(el.firstElementChild.className.trim(), '');
  render(nothing, el);
});

test('development diagnostics give package-specific guidance without lit.dev links', {skip: !development}, () => {
  const warnings = [];
  const previousWarn = console.warn;
  console.warn = value => warnings.push(String(value));
  try {
    html`${literal`span`}`;
    render(html`<textarea>${'value'}</textarea>`, fixture());
    assert.throws(() => render(html`<template>${'value'}</template>`, fixture()), error => {
      assert.doesNotMatch(error.message, /lit\.dev/);
      assert.match(error.message, /outside the template/);
      return true;
    });
    assert.throws(() => render(html`<${'div'}></div>`, fixture()), error => {
      assert.doesNotMatch(error.message, /lit\.dev/);
      assert.match(error.message, /@mnjs\/html\/static/);
      return true;
    });
    assert.ok(warnings.some(value => value.includes('@mnjs/html/static')));
    assert.ok(warnings.some(value => value.includes('.value')));
    assert.ok(warnings.every(value => !value.includes('lit.dev')));
  } finally {
    console.warn = previousWarn;
  }
});

}
