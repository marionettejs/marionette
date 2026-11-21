import { afterEach, expect, it, vi } from 'vitest';
import { View, Region, DomApi } from 'marionette';
import { FormKitView, defaultConfig } from '@mnjs/formkit';
import { FormKitIcon } from '@mnjs/formkit/components';
const owners = [];
const svg = '<svg viewBox="0 0 10 10"><title>Icon</title><path d="M0 0L1 1"/></svg>';
function configured(label, overrides = {}) {
  const created = new WeakSet(), calls = [];
  class Form extends FormKitView {}
  const overlay = {};
  for (const name of ['createElement', 'createBuffer', 'moveEl', 'appendContents', 'replaceEl', 'detachEl', 'detachContents', 'setAttributes', 'setUnsafeHtml']) {
    overlay[name] = function(...args) {
      calls.push({ name, tag: typeof args[0] === 'string' ? args[0] : args[0]?.localName, receiver: this === Form.prototype.Dom });
      const result = DomApi[name].apply(this, args);
      if (name === 'createElement') { created.add(result); }
      return result;
    };
  }
  Form.setDomApi({ ...overlay, ...overrides });
  function make(options = {}) {
    const view = new Form({ formProps: { actions: false }, ...options }); owners.push(view); document.body.append(view.el); view.render(); return view;
  }
  return { Form, make, calls, created, label };
}
function assertOwned(view, owner) {
  expect(owner.created.has(view.el)).toBe(true);
  for (const element of view.el.querySelectorAll('*')) {
    if (element.namespaceURI === 'http://www.w3.org/1999/xhtml') { expect(owner.created.has(element)).toBe(true); }
  }
  expect(owner.calls.every(call => call.receiver)).toBe(true);
}
afterEach(() => { for (const owner of owners.splice(0).reverse()) { owner.destroy(); } document.body.replaceChildren(); });
it('routes both independent owners through direct fields, groups, lists, named and root slots', () => {
  const a = configured('A'), b = configured('B');
  const options = { fields: [{ name: 'group', type: 'group', children: [{ name: 'word', label: 'Word', children: { label: [{ $el: 'strong', children: 'Named label' }] } }] }, { name: 'rows', type: 'list', children: [{ key: 'one' }, { key: 'two' }] }, { name: 'go', type: 'button', children: { default: [{ $el: 'i', children: 'Default slot' }] } }], values: { group: { word: 'Edited' }, rows: ['One', 'Two'] }, slots: { default: [{ $el: 'main', children: '$slots.fields' }] } };
  const av = a.make(options), bv = b.make(options); assertOwned(av, a); assertOwned(bv, b);
  expect(a.created.has(bv.el)).toBe(false); expect(b.created.has(av.el)).toBe(false); expect(av.el.querySelector('strong').textContent).toBe('Named label');
  expect(av.getValues()).toEqual(options.values); expect(bv.getValues()).toEqual(options.values); expect(av.el.querySelector('button i').textContent).toBe('Default slot');
  av.setFields(options.fields.map(field => field.name === 'go' ? { ...field, children: { default: [{ $el: 'u', children: 'Replaced slot' }] } } : field));
  expect(av.el.querySelector('button u').textContent).toBe('Replaced slot'); expect(a.calls.some(call => call.name === 'replaceEl')).toBe(true); assertOwned(av, a);
});
it('keeps provider identity separate for two instances of the same application subclass', () => {
  const a = configured('A'), b = configured('B');
  class InstanceForm extends FormKitView { preinitialize(options) { this.Dom = options.ownerDom; } }
  const av = new InstanceForm({ ownerDom: a.Form.prototype.Dom, fields: [{ name: 'a' }], formProps: { actions: false } });
  const bv = new InstanceForm({ ownerDom: b.Form.prototype.Dom, fields: [{ name: 'b' }], formProps: { actions: false } });
  owners.push(av, bv); document.body.append(av.el, bv.el); av.render(); bv.render(); assertOwned(av, a); assertOwned(bv, b);
  expect(a.created.has(bv.el.querySelector('input'))).toBe(false); expect(b.created.has(av.el.querySelector('input'))).toBe(false);
});
it('carries owners through plain Schema scopes, Root and inherited Provider/LazyProvider children', async() => {
  const schema = [{ $cmp: 'FormKitRoot', children: [{ $cmp: 'FormKitProvider', props: { config: defaultConfig() }, children: [{ $cmp: 'FormKitLazyProvider', children: [{ $cmp: 'FormKitSchema', props: { schema: [{ $formkit: 'group', name: 'box', children: [{ $el: 'article', children: [{ $formkit: 'text', name: 'word', label: 'Scoped' }] }] }] } }] }] }] }];
  const a = configured('A'), b = configured('B'); const av = a.make({ schema }), bv = b.make({ schema });
  await vi.waitFor(() => { expect(av.el.querySelector('input')).not.toBeNull(); expect(bv.el.querySelector('input')).not.toBeNull(); });
  assertOwned(av, a); assertOwned(bv, b); expect(av.node.at('box.word')).toBeDefined(); expect(bv.node.at('box.word')).toBeDefined();
});
it('retains ownership for asynchronous LazyProvider activation and prevents late activation after destroy', async() => {
  const a = configured('A'); const view = a.make({ schema: [{ $cmp: 'FormKitLazyProvider', children: [{ $formkit: 'text', name: 'lazy' }] }] });
  await vi.waitFor(() => expect(view.el.querySelector('input')).not.toBeNull()); assertOwned(view, a);
  const b = configured('B'); const ended = b.make({ schema: [{ $cmp: 'FormKitLazyProvider', children: [{ $formkit: 'text', name: 'never' }] }] }); ended.destroy(); const count = b.calls.length;
  await Promise.resolve(); await Promise.resolve(); expect(b.calls).toHaveLength(count);
});
it('routes registered Messages, Summary and sanitized Icon elements for both owners', async() => {
  const schema = [{ $formkit: 'text', name: 'word' }, { $cmp: 'FormKitSummary', props: { forceShow: true } }, { $cmp: 'FormKitMessages' }, { $cmp: 'FormKitIcon', props: { icon: svg, title: 'Owned icon' } }];
  const a = configured('A'), b = configured('B'); const av = a.make({ schema }), bv = b.make({ schema });
  av.setErrors(['A issue']); bv.setErrors(['B issue']);
  await vi.waitFor(() => { expect(av.el.textContent).toContain('A issue'); expect(bv.el.textContent).toContain('B issue'); });
  expect(av.el.querySelector('svg path')).not.toBeNull(); expect(bv.el.querySelector('svg path')).not.toBeNull(); assertOwned(av, a); assertOwned(bv, b);
  expect(a.calls.some(x => x.name === 'setAttributes' && x.tag === 'path')).toBe(true); expect(b.calls.some(x => x.name === 'setAttributes' && x.tag === 'path')).toBe(true);
});
it('captures the configured default View Dom once for a standalone helper instance', () => {
  const saved = View.prototype.Dom, a = configured('A'), b = configured('B'); const host = document.createElement('aside'); document.body.append(host); let icon;
  try {
    const capture = { provider: undefined }; const defaults = {}; for (const [name, method] of Object.entries(a.Form.prototype.Dom)) { defaults[name] = typeof method === 'function' ? function(...args) { expect(this).toBe(capture.provider); return method.apply(this, args); } : method; }
    View.setDomApi(defaults); capture.provider = View.prototype.Dom; const createIcon = FormKitIcon; icon = createIcon({ host, props: { icon: svg } }); const first = host.querySelector('.formkit-icon'); expect(a.created.has(first)).toBe(true);
    View.setDomApi(b.Form.prototype.Dom); icon.update({ icon: svg, title: 'Still A' }); expect(a.created.has(host.querySelector('.formkit-icon'))).toBe(true); expect(b.calls).toHaveLength(0);
  } finally { icon?.destroy(); View.setDomApi(saved); }
});
it('does not create or mutate late Icon output after its owner is destroyed', async() => {
  let resolve; const pending = new Promise(done => { resolve = done; }); const a = configured('A');
  const view = a.make({ schema: [{ $cmp: 'FormKitIcon', props: { icon: 'owned-dom-pending', iconLoader: () => pending } }] }); view.destroy(); const count = a.calls.length;
  resolve(svg); await pending; await Promise.resolve(); await Promise.resolve(); expect(a.calls).toHaveLength(count); expect(view.el.isConnected).toBe(false);
});
it('preserves mixed loop ranges and focused edited keyed controls while routing Element moves', async() => {
  const a = configured('A'); const view = a.make({ fields: [{ name: 'a' }, { name: 'b' }], values: { a: 'Edited text', b: 'B' }, schema: [{ $el: 'div', for: ['row', '$rows'], attrs: { key: '$row.id', 'data-row': '$row.id' }, children: ['text', { $el: 'em', children: '$row.text' }] }], data: { rows: [{ id: 'one', text: 'One' }, { id: 'two', text: 'Two' }] } });
  const input = view.el.querySelector('[name="a"]'), node = view.node.at('a'), first = view.el.querySelector('[data-row="one"]'); input.focus(); input.setSelectionRange(2, 5);
  view.setFields([{ name: 'b' }, { name: 'a' }]); view.updateData({ rows: [{ id: 'two', text: 'Two' }, { id: 'one', text: 'One' }] });
  expect(view.node.at('a')).toBe(node); expect(view.el.querySelector('[name="a"]')).toBe(input); expect(input.value).toBe('Edited text'); expect(document.activeElement).toBe(input); expect([input.selectionStart, input.selectionEnd]).toEqual([2, 5]);
  expect(view.el.querySelector('[data-row="one"]')).toBe(first); expect([...view.el.querySelectorAll('[data-row]')].map(x => x.dataset.row)).toEqual(['two', 'one']); assertOwned(view, a); expect(a.calls.some(x => x.name === 'moveEl')).toBe(true);
});
it('uses native namespace creation only where required and routes SVG attributes/moves/removal plus foreignObject HTML', () => {
  const a = configured('A'); const view = a.make({ schema: [{ $el: 'svg', children: [{ $el: 'circle', if: '$shown', attrs: { r: '$radius' } }, { $el: 'foreignObject', children: [{ $el: 'div', children: 'HTML' }] }] }], data: { shown: true, radius: 2 } });
  const circle = view.el.querySelector('circle'), html = view.el.querySelector('foreignObject div'); expect(circle.namespaceURI).toBe('http://www.w3.org/2000/svg'); expect(html.namespaceURI).toBe('http://www.w3.org/1999/xhtml'); expect(a.created.has(html)).toBe(true);
  expect(a.calls.some(x => x.name === 'setAttributes' && x.tag === 'circle')).toBe(true); view.updateData({ shown: false, radius: 3 }); expect(view.el.querySelector('circle')).toBeNull(); expect(a.calls.some(x => x.name === 'detachEl' && x.tag === 'circle')).toBe(true);
});
it('routes foreign-Document Elements by nodeType without global instanceof assumptions', () => {
  const frame = document.createElement('iframe'); document.body.append(frame);
  const foreign = frame.contentDocument; let view;
  const a = configured('foreign', { createElement(tag) { const element = foreign.createElement(tag); a.created.add(element); return element; } });
  try {
    view = new a.Form({ fields: [{ name: 'word' }], values: { word: 'Foreign' }, schema: [{ $el: 'aside', if: '$show', children: 'Other' }], data: { show: true }, formProps: { actions: false } }); owners.push(view); foreign.body.append(view.el); view.render();
    const input = view.el.querySelector('input'); expect(input instanceof HTMLElement).toBe(false); expect(input.ownerDocument).toBe(foreign); expect(a.created.has(input)).toBe(true);
    view.updateData({ show: false }); expect(view.el.querySelector('aside')).toBeNull(); expect(a.calls.some(x => x.name === 'detachEl' && x.tag === 'aside')).toBe(true); expect(a.calls.every(x => x.receiver)).toBe(true);
  } finally { view?.destroy(); frame.remove(); }
});
it('normalizes constant wrapper styles without losing provider attributes or existing priorities', () => {
  const a = configured('styled', { createElement(tag) { const element = DomApi.createElement.call(this, tag); a.created.add(element); DomApi.setAttributes.call(this, element, { style: 'color: red; display: block !important' }); return element; } });
  const view = a.make({ fields: [], schema: [{ $cmp: 'Content', children: 'Owned' }], components: { Content({ renderChildren }) { const destroy = renderChildren(); return { destroy }; } } });
  const span = view.el.querySelector('span'); expect(span.style.display).toBe('contents'); expect(span.style.color).toBe('red'); expect(span.style.getPropertyPriority('display')).toBe('');
});
it('preserves normalized live properties, style/class and explicit attribute/listener removal', async() => {
  const a = configured('A'); let old = 0, current = 0;
  const view = a.make({ schema: [{ $el: 'button', attrs: { id: 'attrs', class: '$classes', style: '$style', 'aria-hidden': '$flag', 'data-flag': '$flag', title: '$title', onClick: '$clicked' }, children: 'Click' }, { $formkit: 'checkbox', name: 'check' }, { $formkit: 'text', name: 'word' }], data: { classes: { first: true }, style: { color: 'red', '--tone': '1' }, flag: false, title: 'Before', clicked: () => old++ }, values: { check: true, word: 'Initial' } });
  const button = view.el.querySelector('#attrs'), text = view.el.querySelector('[name="word"]'), check = view.el.querySelector('[type="checkbox"]'); button.click(); expect(old).toBe(1); expect(button.getAttribute('aria-hidden')).toBe('false'); expect(check.checked).toBe(true);
  view.updateData({ classes: ['next'], style: { backgroundColor: 'blue' }, flag: true, title: undefined, clicked: () => current++ }); button.click(); expect(old).toBe(1); expect(current).toBe(1); expect(button.hasAttribute('title')).toBe(false); expect(button.className).toBe('next'); expect(button.style.color).toBe(''); expect(button.style.getPropertyValue('--tone')).toBe(''); expect(button.style.backgroundColor).toBe('blue');
  view.setValues({ word: 'Updated', check: false }, { notify: false }); await vi.waitFor(() => { expect(text.value).toBe('Updated'); expect(check.checked).toBe(false); }); view.destroy(); button.click(); expect(current).toBe(1);
});
it('retains completed style-property changes if a later normalization throws', () => {
  const a = configured('A'), failure = new Error('style conversion'); const view = a.make({ fields: [], schema: [{ $el: 'button', attrs: { style: '$styles' }, children: 'Styled' }], data: { styles: {} } });
  const button = view.el.querySelector('button'); const bad = { toString() { throw failure; } };
  expect(() => view.updateData({ styles: { color: 'red', backgroundColor: bad } })).toThrow(failure); expect(button.style.color).toBe('red');
});
it('preserves provider errors without a native retry and leaves explicit owner cleanup possible', () => {
  const failure = new Error('owner create input'); const a = configured('A', { createElement(tag) { if (tag === 'input') { throw failure; } return DomApi.createElement.call(this, tag); } });
  const view = new a.Form({ fields: [{ name: 'word' }], formProps: { actions: false } }); owners.push(view); document.body.append(view.el); expect(() => view.render()).toThrow(failure); expect(view.el.querySelector('input')).toBeNull(); view.destroy(); expect(view.isDestroyed()).toBe(true);
});
it('keeps attribute-provider error identity and never retries native attribute writes', () => {
  const failure = new Error('owner attribute'); const a = configured('A', { setAttributes(element, attrs) { if ('data-fail' in attrs) { throw failure; } return DomApi.setAttributes.call(this, element, attrs); } });
  const view = new a.Form({ fields: [], schema: [{ $el: 'aside', attrs: { 'data-fail': 'value' } }], formProps: { actions: false } }); owners.push(view); document.body.append(view.el); expect(() => view.render()).toThrow(failure); view.destroy();
});
it.each(['field', 'schema'])('preserves the primary %s attribute error when cleanup also throws', mode => {
  const primary = new Error('attribute primary'), secondary = new Error('detach secondary'); let failCleanup = true;
  const a = configured('A', { setAttributes(element, attrs) { if ('data-fail' in attrs) { throw primary; } return DomApi.setAttributes.call(this, element, attrs); }, detachEl(element) { if (failCleanup) { throw secondary; } return DomApi.detachEl.call(this, element); } });
  const options = mode === 'field' ? { fields: [{ name: 'word', attrs: { 'data-fail': 'yes' } }] } : { fields: [], schema: [{ $el: 'aside', attrs: { 'data-fail': 'yes' } }] };
  const view = new a.Form({ ...options, formProps: { actions: false } }); owners.push(view); document.body.append(view.el);
  try { expect(() => view.render()).toThrow(primary); } finally { failCleanup = false; }
  view.destroy();
});
it('releases unclaimed replacement-slot factories when the owner replace operation throws', () => {
  const failure = new Error('replace failed'); let created = 0, destroyed = 0;
  const a = configured('A', { replaceEl() { throw failure; } });
  const field = text => ({ name: 'word', label: 'Label', children: { label: [{ $cmp: 'Badge', props: { text } }] } });
  const view = a.make({ fields: [field('One')], components: { Badge({ host, props }) { created++; host.textContent = props.text; return { destroy() { destroyed++; host.textContent = ''; } }; } } });
  expect(() => view.setFields([field('Two')])).toThrow(failure); view.destroy(); expect(created).toBe(2); expect(destroyed).toBe(2);
});
it('fails normally for a missing required configured element method', () => {
  const a = configured('A', { moveEl: undefined }); const view = new a.Form({ fields: [{ name: 'word' }], formProps: { actions: false } }); owners.push(view); expect(() => view.render()).toThrow(TypeError); expect(view.el.querySelector('input')).toBeNull();
});
it('retires factory content before final provider clear and preserves removal:false once-only teardown', () => {
  const order = [], a = configured('A', { detachContents(element) { order.push('clear:' + element.localName); return DomApi.detachContents.call(this, element); } }); let view;
  view = a.make({ fields: [], schema: [{ $cmp: 'Owned', children: [{ $el: 'b', children: 'Child' }] }], components: { Owned({ host, renderChildren }) { const dispose = renderChildren(); return { destroy(remove) { order.push('factory:' + remove); expect(host.querySelector('b')).not.toBeNull(); view.updateData({ ignored: true }); dispose(remove); } }; } } });
  view.destroy(); view.destroy(); expect(order.filter(x => x === 'factory:false')).toHaveLength(1); expect(order.indexOf('factory:false')).toBeLessThan(order.indexOf('clear:form')); expect(view.el.children).toHaveLength(0);
});
it('routes trusted native icon markup to its configured owner without renderer dispatch', async() => {
  let rendererCalls = 0;
  const a = configured('A', { setContents() { rendererCalls++; throw new Error('not a markup primitive'); } });
  const b = configured('B');
  const options = { fields: [{ name: 'word', prefixIcon: svg, help: '<strong>Literal help</strong>' }] };
  const av = a.make(options), bv = b.make(options);
  await vi.waitFor(() => {
    for (const view of [av, bv]) { expect(view.el.querySelector('svg')?.namespaceURI).toBe('http://www.w3.org/2000/svg'); }
  });
  for (const [view, provider] of [[av, a], [bv, b]]) {
    expect(provider.calls.filter(call => call.name === 'setUnsafeHtml')).toEqual([{ name: 'setUnsafeHtml', tag: 'label', receiver: true }]);
    expect(view.el.textContent).toContain('<strong>Literal help</strong>');
    expect(view.el.querySelector('strong')).toBeNull();
  }
  expect(rendererCalls).toBe(0);
});

it('replaces and clears trusted custom section markup through the configured owner', async() => {
  const a = configured('A');
  const view = a.make({ fields: [{ name: 'word', help: 'Visible', sectionsSchema: { help: { $el: 'div', attrs: { innerHTML: '$value' }, children: null } } }], values: { word: '<b data-raw="yes">Markup</b>' } });
  expect(view.el.querySelector('[data-raw="yes"]').textContent).toBe('Markup');
  await view.node.at('word').input('<i data-raw="yes">More</i>', false);
  expect(view.el.querySelector('[data-raw="yes"]').localName).toBe('i');
  await view.node.at('word').input(undefined, false);
  expect(view.el.querySelector('[data-raw="yes"]')).toBeNull();
  expect(a.calls.filter(call => call.name === 'setUnsafeHtml')).toHaveLength(3);
});

it('preserves provider failure identity for raw sections without falling back to native markup', () => {
  const failure = new Error('owned raw operation failed');
  const a = configured('A', { setUnsafeHtml() { throw failure; } });
  const view = new a.Form({ schema: [{ $formkit: 'text', name: 'word', sectionsSchema: { help: { $el: 'div', attrs: { innerHTML: '<b data-raw="yes">Markup</b>' }, children: null } }, help: 'Visible' }] });
  owners.push(view);
  expect(() => view.render()).toThrow(failure);
  expect(view.el.querySelector('[data-raw="yes"]')).toBeNull();
});

it('keeps ordinary sections usable without a raw operation, but does not fall back for raw sections', () => {
  const a = configured('A', { setUnsafeHtml: undefined });
  const ordinary = a.make({ fields: [{ name: 'plain', help: '<b>Text</b>' }] });
  expect(ordinary.el.textContent).toContain('<b>Text</b>');
  expect(ordinary.el.querySelector('b')).toBeNull();
  const raw = new a.Form({ fields: [{ name: 'word', help: 'Visible', sectionsSchema: { help: { $el: 'div', attrs: { innerHTML: '<b>Raw</b>' }, children: null } } }] });
  owners.push(raw);
  expect(() => raw.render()).toThrow(TypeError);
  expect(raw.el.querySelector('b')).toBeNull();
});

it('does not write raw markup over a section with managed children', () => {
  const a = configured('A');
  const view = new a.Form({ schema: [{ $formkit: 'text', name: 'word', sectionsSchema: { help: { $el: 'div', attrs: { innerHTML: '<b>Raw</b>' }, children: 'Managed' } }, help: 'Visible' }] });
  owners.push(view);
  expect(() => view.render()).toThrow('Section raw HTML requires a dedicated element');
  expect(a.calls.filter(call => call.name === 'setUnsafeHtml')).toHaveLength(0);
});

it('keeps configured form ownership through an explicitly configured parent and Region lifecycle', () => {
  const a = configured('A'); let parentDom, regionDom, parentCalls = 0, regionCalls = 0;
  class Parent extends View { get template() { return () => '<main class="content"></main>'; } }
  class ContentRegion extends Region {}
  Parent.setDomApi({ createElement(tag) { expect(this).toBe(parentDom); parentCalls++; return DomApi.createElement.call(this, tag); } }); parentDom = Parent.prototype.Dom;
  ContentRegion.setDomApi({ appendContents(element, content) { expect(this).toBe(regionDom); regionCalls++; return DomApi.appendContents.call(this, element, content); }, detachEl(element) { expect(this).toBe(regionDom); regionCalls++; return DomApi.detachEl.call(this, element); } }); regionDom = ContentRegion.prototype.Dom;
  const parent = new Parent(); owners.push(parent); document.body.append(parent.el); parent.render();
  const region = parent.addRegion('content', new ContentRegion({ el: parent.el.querySelector('main') }));
  const form = new a.Form({ fields: [{ name: 'word' }], values: { word: 'Retained' }, formProps: { actions: false } }); owners.push(form); region.show(form);
  const node = form.node.at('word'), input = form.el.querySelector('input'); expect(form.isRendered()).toBe(true); assertOwned(form, a);
  expect(region.detachView()).toBe(form); expect(form.isDestroyed()).toBe(false); region.show(form); expect(form.node.at('word')).toBe(node); expect(form.el.querySelector('input')).toBe(input); expect(input.value).toBe('Retained');
  parent.render(); expect(form.isDestroyed()).toBe(true); expect(parentCalls).toBeGreaterThan(0); expect(regionCalls).toBeGreaterThan(0);
});
it('routes a focused retained form inside a ShadowRoot without changing its Core or input identity', () => {
  const a = configured('shadow'), host = document.createElement('div'); document.body.append(host); const shadow = host.attachShadow({ mode: 'open' });
  const form = new a.Form({ fields: [{ name: 'a' }, { name: 'b' }, { name: 'c' }], values: { a: 'A', b: 'Edited', c: 'C' }, formProps: { actions: false } }); owners.push(form); shadow.append(form.el); form.render();
  const node = form.node.at('b'), input = form.el.querySelector('[name="b"]'); input.focus(); input.setSelectionRange(1, 4);
  form.setFields([{ name: 'c' }, { name: 'b' }, { name: 'a' }]); expect(shadow.activeElement).toBe(input); expect([input.selectionStart, input.selectionEnd]).toEqual([1, 4]); expect(form.node.at('b')).toBe(node); expect(form.el.querySelector('[name="b"]')).toBe(input); assertOwned(form, a);
});

it.each(['slot', 'form'])('preserves a root-slot raw error when %s cleanup also throws', cleanup => {
  const primary = new Error('raw section primary'), secondary = new Error('cleanup secondary'), calls = [];
  const a = configured('A', {
    setUnsafeHtml() { calls.push('raw'); throw primary; },
    detachEl(element) {
      if (cleanup === 'slot' && calls.includes('raw') && element.localName === 'span' && element.style.display === 'contents') { calls.push('slot cleanup'); throw secondary; }
      return DomApi.detachEl.call(this, element);
    },
    detachContents(element) {
      if (cleanup === 'form' && calls.includes('raw') && element.localName === 'form') { calls.push('form cleanup'); throw secondary; }
      return DomApi.detachContents.call(this, element);
    }
  });
  expect(() => new a.Form({ fields: [], formProps: { actions: false }, slots: { default: [{ $el: 'aside', attrs: { innerHTML: '<b>Trusted</b>' } }] } })).toThrow(primary);
  expect(calls).toEqual(['raw', `${cleanup} cleanup`]);
});
