import './setup.mjs';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
const { html, svg, mathml, render, nothing, noChange } = await import('@mnjs/html');
const { repeat } = await import('@mnjs/html/directives/repeat.js');
const { classMap } = await import('@mnjs/html/directives/class-map.js');
const { styleMap } = await import('@mnjs/html/directives/style-map.js');
const { live } = await import('@mnjs/html/directives/live.js');
const { ifDefined } = await import('@mnjs/html/directives/if-defined.js');
const { guard } = await import('@mnjs/html/directives/guard.js');
const { keyed } = await import('@mnjs/html/directives/keyed.js');
const { cache } = await import('@mnjs/html/directives/cache.js');
const { when } = await import('@mnjs/html/directives/when.js');
const { choose } = await import('@mnjs/html/directives/choose.js');
const { map } = await import('@mnjs/html/directives/map.js');
const { range } = await import('@mnjs/html/directives/range.js');
const { join } = await import('@mnjs/html/directives/join.js');
const roots = [];
function fixture() { const el = document.createElement('div'); document.body.append(el); roots.push(el); return el; }
afterEach(() => { for (const el of roots.splice(0)) {
    render(nothing, el).setConnected(false);
    el.remove();
} });
test('nested templates update text without replacing stable DOM', () => {
    const el = fixture();
    const template = text => html `<p>${html `<b>${text}</b>`}</p>`;
    render(template('first'), el);
    const p = el.firstElementChild;
    const b = p.firstElementChild;
    const text = b.lastChild;
    render(template('second'), el);
    assert.equal(el.firstElementChild, p);
    assert.equal(p.firstElementChild, b);
    assert.equal(b.lastChild, text);
    assert.equal(text.data, 'second');
});
test('text interpolation never parses markup', () => {
    const el = fixture();
    const input = '<img src=x onerror=alert(1)><script>alert(2)</script>';
    render(html `<p>${input}</p>`, el);
    assert.equal(el.querySelector('img'), null);
    assert.equal(el.querySelector('p').textContent, input);
});
test('attribute, property, boolean and multi-expression bindings', () => {
    const el = fixture();
    const obj = { value: 1 };
    const template = (value, disabled, data) => html `<input title="a ${value} b ${3}" .value=${value} ?disabled=${disabled} .data=${data}>`;
    render(template('x', true, obj), el);
    const input = el.firstElementChild;
    assert.equal(input.title, 'a x b 3');
    assert.equal(input.value, 'x');
    assert.equal(input.disabled, true);
    assert.equal(input.data, obj);
    render(template('y', false, nothing), el);
    assert.equal(input.value, 'y');
    assert.equal(input.disabled, false);
    assert.equal(input.data, undefined);
});
test('nullish child values and nothing clear while noChange preserves', () => {
    const el = fixture();
    const template = value => html `<p>${value}</p>`;
    for (const empty of [null, undefined, '', nothing]) {
        render(template('kept'), el);
        render(template(noChange), el);
        assert.equal(el.textContent, 'kept');
        render(template(empty), el);
        assert.equal(el.textContent, '');
    }
    render(template(0), el);
    assert.equal(el.textContent, '0');
    render(template(false), el);
    assert.equal(el.textContent, 'false');
});
test('nothing removes single and interpolated attributes', () => {
    const el = fixture();
    render(html `<p title=${nothing} data-x="a ${nothing} b" data-y=${null}></p>`, el);
    assert.equal(el.firstElementChild.hasAttribute('title'), false);
    assert.equal(el.firstElementChild.hasAttribute('data-x'), false);
    assert.equal(el.firstElementChild.getAttribute('data-y'), '');
});
test('arrays, iterables and DOM nodes preserve appropriate identity', () => {
    const el = fixture();
    const node = document.createElement('strong');
    node.textContent = 'node';
    render([1, new Set([2, 3]), node], el);
    assert.equal(el.textContent, '123node');
    assert.equal(el.querySelector('strong'), node);
    render([4], el);
    assert.equal(el.textContent, '4');
    assert.equal(node.isConnected, false);
});
test('attribute escaping prevents attribute injection', () => {
    const el = fixture();
    const value = '" onmouseover="alert(1)';
    render(html `<p title=${value}></p>`, el);
    assert.equal(el.firstElementChild.getAttribute('title'), value);
    assert.equal(el.firstElementChild.getAttribute('onmouseover'), null);
});
test('SVG and MathML retain their namespaces', () => {
    const el = fixture();
    render(html `<svg>${svg `<circle cx=${5}></circle>`}</svg><math>${mathml `<mn>${3}</mn>`}</math>`, el);
    assert.equal(el.querySelector('circle').namespaceURI, 'http://www.w3.org/2000/svg');
    assert.equal(el.querySelector('mn').namespaceURI, 'http://www.w3.org/1998/Math/MathML');
});
test('creationScope supports another document', () => {
    const el = fixture();
    const other = document.implementation.createHTMLDocument('other');
    const target = other.createElement('div');
    render(html `<b>${'other'}</b>`, target, { creationScope: other });
    assert.equal(target.firstElementChild.ownerDocument, other);
    assert.equal(target.textContent, 'other');
    el.append(target);
});
test('renderBefore confines updates and clearing to its range', () => {
    const el = fixture();
    const end = document.createComment('boundary');
    const owned = document.createElement('aside');
    owned.textContent = 'owned';
    el.append(end, owned);
    render(html `<b>${'first'}</b>`, el, { renderBefore: end });
    render('second', el, { renderBefore: end });
    assert.equal(el.lastChild, owned);
    assert.equal(owned.textContent, 'owned');
    render(nothing, el, { renderBefore: end });
    assert.equal(el.lastChild, owned);
    assert.equal(el.textContent, 'owned');
});
for (const [name, template] of [
    ['@click', f => html `<button @click=${f}>go</button>`],
    ['quoted @click', f => html `<button @click="${f}">go</button>`],
    ['nested @event', f => html `<div>${html `<button @custom-event=${f}></button>`}</div>`],
    ['.onclick', f => html `<button .onclick=${f}></button>`],
    ['onclick', f => html `<button onclick=${f}></button>`],
    ['?onload', f => html `<img ?onload=${f}>`],
    ['case-folded on*', f => html `<button onClick=${f}></button>`],
])
    test(`rejects ${name} with a stable diagnostic`, () => {
        const el = fixture();
        let calls = 0;
        assert.throws(() => render(template(() => calls++), el), /MN_HTML_EVENT_BINDING/);
        assert.equal(calls, 0);
        assert.equal(el.querySelector('button'), null);
    });
test('foreign Lit values are diagnosed in development and not evaluated as local templates in production', async () => {
    const upstream = await import('lit-html');
    const { classMap: foreignClassMap } = await import('lit-html/directives/class-map.js');
    const el = fixture();
    const templates = [upstream.html`<p>foreign</p>`, html`<p class=${foreignClassMap({ x: true })}></p>`];
    for (const template of templates) {
        if (process.execArgv.includes('--conditions=development')) {
            assert.throws(() => render(template, el), /MN_HTML_FOREIGN_VALUE/);
        } else {
            render(template, el);
            assert.equal(el.querySelector('.x'), null);
            assert.notEqual(el.textContent, 'foreign');
        }
    }
});
test('a forged template array is rejected', () => {
    const el = fixture();
    assert.throws(() => render(html(['<img src=x onerror=alert(1)>']), el), /template strings (array|to be an array)/);
});
test('repeat reorders keyed DOM and keeps user-edited input state', () => {
    const el = fixture();
    const template = ids => html `${repeat(ids, id => id, id => html `<input data-id=${id} .value=${id}>`)}`;
    render(template(['a', 'b', 'c']), el);
    const inputs = [...el.querySelectorAll('input')];
    inputs[0].value = 'edited';
    render(template(['c', 'a', 'b']), el);
    assert.deepEqual([...el.querySelectorAll('input')], [inputs[2], inputs[0], inputs[1]]);
    assert.equal(inputs[0].value, 'edited');
    render(template(['b']), el);
    assert.equal(el.querySelector('input'), inputs[1]);
});
test('classMap and styleMap remove stale values', () => {
    const el = fixture();
    const template = (classes, styles) => html `<p class="fixed ${classMap(classes)}" style=${styleMap(styles)}></p>`;
    render(template({ yes: true, no: false }, { color: 'red', '--size': '2px' }), el);
    const p = el.firstElementChild;
    assert.equal(p.className, 'fixed  yes ');
    assert.equal(p.style.color, 'red');
    render(template({ next: true }, { color: 'blue' }), el);
    assert.equal(p.classList.contains('yes'), false);
    assert.equal(p.classList.contains('next'), true);
    assert.equal(p.style.getPropertyValue('--size'), '');
});
test('live resets externally edited input properties', () => {
    const el = fixture();
    const template = v => html `<input .value=${live(v)}>`;
    render(template('saved'), el);
    const input = el.firstElementChild;
    input.value = 'edited';
    render(template('saved'), el);
    assert.equal(input.value, 'saved');
});
test('ifDefined removes absent optional attributes', () => { const el = fixture(); render(html `<p title=${ifDefined(undefined)}></p>`, el); assert.equal(el.firstElementChild.hasAttribute('title'), false); });
test('guard skips unchanged dependencies', () => { const el = fixture(); let calls = 0; const t = v => html `${guard([v], () => { calls++; return html `<b>${v}</b>`; })}`; render(t(1), el); render(t(1), el); assert.equal(calls, 1); render(t(2), el); assert.equal(calls, 2); assert.equal(el.textContent, '2'); });
test('keyed recreates its subtree only when key changes', () => { const el = fixture(); const t = k => html `${keyed(k, html `<p>same</p>`)}`; render(t(1), el); const p = el.firstElementChild; render(t(1), el); assert.equal(el.firstElementChild, p); render(t(2), el); assert.notEqual(el.firstElementChild, p); });
test('cache restores DOM for previously used templates', () => { const el = fixture(); const a = () => html `<input value="a">`; const b = () => html `<b>b</b>`; const t = v => html `${cache(v ? a() : b())}`; render(t(true), el); const input = el.firstElementChild; input.value = 'edited'; render(t(false), el); render(t(true), el); assert.equal(el.firstElementChild, input); assert.equal(input.value, 'edited'); });
test('pure helpers compose without renderer-specific state', () => { const el = fixture(); render(html `${when(true, () => 'yes')}:${choose(2, [[1, () => 'one'], [2, () => 'two']])}:${join(map(range(3), n => n * 2), ',')}`, el); assert.equal(el.textContent, 'yes:two:0,2,4'); });
