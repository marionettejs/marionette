import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSchemaRenderer } from '@mnjs/formkit';
import { createNode } from '@formkit/core';
const renderers = [];
const nodes = [];
function render(schema, options = {}) {
  const container = document.body.appendChild(document.createElement('div'));
  const renderer = createSchemaRenderer(container, { schema, ...options });
  renderers.push(renderer);
  return { container, ...renderer };
}
afterEach(() => {
  renderers.splice(0).forEach(renderer => renderer.destroy());
  nodes.splice(0).forEach(node => node.destroy());
  document.body.replaceChildren();
});

describe('@mnjs/formkit public schema foundation', () => {
  it('reorders mixed keyed component ranges and text while inserting and removing siblings', () => {
    const destroyed = [];
    const fields = new Map();
    const pair = id => ({ $cmp: 'Pair', key: id, props: { id, label: '$label' } });
    const input = { $el: 'input', key: 'ordinary', attrs: { id: 'ordinary', value: '$value' } };
    const text = { $el: 'text', key: 'text', children: '$tail' };
    const view = render([input, pair('a'), text, pair('b'), pair('c')], {
      data: { value: 'Ordinary', label: 'Initial', tail: 'Tail' },
      components: { Pair: ({ document: doc, props }) => {
        const element = doc.createDocumentFragment();
        const control = doc.createElement('input'); control.id = props.id;
        const label = doc.createElement('span'); label.id = `${props.id}-label`;
        element.append(control, label); fields.set(props.id, control);
        return { element, update(next) { label.textContent = next.label; },
          destroy() { destroyed.push(props.id); } };
      } }
    });
    const ordinary = view.container.querySelector('#ordinary');
    const tail = [...view.container.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
    const a = fields.get('a'), b = fields.get('b'), c = fields.get('c');
    a.value = 'Edited'; a.focus(); a.setSelectionRange(1, 4);
    view.setSchema([
      { $el: 'b', key: 'new', attrs: { id: 'new' }, children: 'New' },
      pair('b'), text, pair('a'), input
    ]);
    view.update({ value: 'Changed ordinary', label: 'Updated', tail: 'Changed tail' });
    const visibleNodes = [...view.container.childNodes].filter(node => node.nodeType !== Node.COMMENT_NODE);
    expect(visibleNodes.map(node => node.nodeType === Node.TEXT_NODE ? node.textContent : node.id))
      .toEqual(['new', 'b', 'b-label', 'Changed tail', 'a', 'a-label', 'ordinary']);
    expect(view.container.querySelector('#a')).toBe(a);
    expect(view.container.querySelector('#b')).toBe(b);
    expect(view.container.querySelector('#ordinary')).toBe(ordinary);
    expect(visibleNodes[3]).toBe(tail);
    expect(a.value).toBe('Edited'); expect(ordinary.value).toBe('Changed ordinary');
    expect(view.container.querySelector('#a-label').textContent).toBe('Updated');
    expect(document.activeElement).toBe(a);
    expect([a.selectionStart, a.selectionEnd]).toEqual([1, 4]);
    expect(c.isConnected).toBe(false); expect(destroyed).toEqual(['c']);
    view.destroy(); expect(destroyed.toSorted()).toEqual(['a', 'b', 'c']);
  });

  it('preserves a literal custom event named passive', () => {
    const callback = vi.fn();
    const view = render({ $el: 'button', attrs: { onPassive: '$callback' } }, { data: { callback } });
    const button = view.container.firstElementChild;
    button.dispatchEvent(new Event('passive'));
    expect(callback).toHaveBeenCalledTimes(1);
    view.update({}); button.dispatchEvent(new Event('passive'));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('retains native receivers and distinct passive settings when authored bindings share one callback', () => {
    const calls = [];
    function shared(event) { event.preventDefault(); calls.push({ target: this, prevented: event.defaultPrevented }); }
    const view = render({ $el: 'button', attrs: { ['__raw__onTouchstartPassive']: shared, ['__raw__onTouchstart']: shared } });
    const button = view.container.firstElementChild;
    const dispatch = () => button.dispatchEvent(new Event('touchstart', { cancelable: true }));
    dispatch();
    expect(calls).toEqual([{ target: button, prevented: false }, { target: button, prevented: true }]);
    calls.length = 0;
    view.setSchema({ $el: 'button', attrs: { ['__raw__onTouchstartPassive']: shared } }); dispatch();
    expect(calls).toEqual([{ target: button, prevented: false }]);
    calls.length = 0;
    view.setSchema({ $el: 'button', attrs: { ['__raw__onTouchstart']: shared } }); dispatch();
    expect(calls).toEqual([{ target: button, prevented: true }]);
    calls.length = 0; view.destroy(); dispatch(); expect(calls).toEqual([]);
  });

  it('delivers passive schema touch bindings without cancelling the event and replaces or removes callbacks', () => {
    const calls = [];
    const handlers = label => ({ label, start(event) { event.preventDefault(); calls.push([this.label, event.type, event.defaultPrevented]); } });
    const schema = { $el: 'div', attrs: { onTouchstartPassive: '$handlers.start', onTouchmovePassive: '$handlers.start' } };
    const view = render(schema, { data: { handlers: handlers('first') } });
    const element = view.container.firstElementChild;
    element.dispatchEvent(new Event('touchstart', { cancelable: true }));
    element.dispatchEvent(new Event('touchmove', { cancelable: true }));
    expect(calls).toEqual([['first', 'touchstart', false], ['first', 'touchmove', false]]);
    view.update({ handlers: handlers('second') });
    element.dispatchEvent(new Event('touchstart', { cancelable: true }));
    expect(calls).toEqual([['first', 'touchstart', false], ['first', 'touchmove', false], ['second', 'touchstart', false]]);
    view.update({ handlers: {} });
    element.dispatchEvent(new Event('touchmove', { cancelable: true }));
    expect(calls).toHaveLength(3);
    view.update({ handlers: handlers('third') });
    view.destroy();
    element.dispatchEvent(new Event('touchstart', { cancelable: true }));
    expect(calls).toHaveLength(3);
  });

  it('keeps plain and passive callbacks distinct when their native event types coincide', () => {
    const calls = [];
    const data = { passive() { calls.push('passive'); }, plain(event) { event.preventDefault(); calls.push('plain'); } };
    const view = render({ $el: 'button', attrs: { onTouchstartPassive: '$passive', onTouchstart: '$plain' } }, { data });
    const button = view.container.firstElementChild;
    const dispatch = () => { const event = new Event('touchstart', { cancelable: true }); button.dispatchEvent(event); return event.defaultPrevented; };
    expect(dispatch()).toBe(true); expect(calls).toEqual(['passive', 'plain']);
    calls.length = 0; view.update(data);
    expect(dispatch()).toBe(true); expect(calls).toEqual(['passive', 'plain']);
    calls.length = 0;
    view.setSchema({ $el: 'button', attrs: { onTouchstartPassive: '$passive' } });
    expect(dispatch()).toBe(false); expect(calls).toEqual(['passive']);
    calls.length = 0; view.destroy();
    expect(dispatch()).toBe(false); expect(calls).toEqual([]);
  });

  it('retains non-enumerable schema accessors through scoped loops without mutating the definition', () => {
    const selected = [];
    const row = { key: '$item.id', attrs: { onClick: '$item.select' }, children: '$item.label' };
    Object.defineProperties(row, {
      $el: { get: () => 'li' },
      for: { value: ['item', '$items'] },
      if: { get: () => '$item.show' }
    });
    const item = (id, show = true) => ({ id, label: id, show, select() { selected.push(this.id); } });
    const a = item('a'); const b = item('b');
    const view = render({ $el: 'ul', children: row }, { data: { items: [a, item('hidden', false), b] } });
    const rows = [...view.container.querySelector('ul').children];
    expect(rows.map(node => node.tagName)).toEqual(['LI', 'LI']);
    expect(rows.map(node => node.textContent)).toEqual(['a', 'b']);
    rows[0].click(); expect(selected).toEqual(['a']);
    view.update({ items: [b, a] });
    expect([...view.container.querySelector('ul').children]).toEqual([rows[1], rows[0]]);
    expect(row.for).toEqual(['item', '$items']);
    view.destroy(); rows[0].click();
    expect(selected).toEqual(['a']);
    expect(rows[0].isConnected).toBe(false);
  });

  it('retains conditional, transparent and component definitions inside non-enumerable loop schemas', () => {
    const destroyed = vi.fn();
    const conditional = {};
    Object.defineProperties(conditional, {
      for: { value: ['item', '$items'] }, if: { get: () => '$item.show' },
      then: { get: () => ({ $el: 'b', children: '$item.label' }) },
      else: { get: () => ({ $el: 'i', children: 'Hidden' }) }
    });
    const transparent = { for: ['item', '$items'], children: '$item.label' };
    Object.defineProperty(transparent, '$el', { get: () => null });
    const component = { for: ['item', '$items'], props: { label: '$item.label' } };
    Object.defineProperty(component, '$cmp', { get: () => 'Badge' });
    const view = render([conditional, transparent, component], { data: { items: [{ label: 'One', show: true }, { label: 'Two', show: false }] },
      components: { Badge: () => ({ element: document.createElement('span'),
        update(props) { this.element.textContent = props.label; }, destroy: destroyed }) } });
    expect(view.container.innerHTML).toContain('<b>One</b><i>Hidden</i>OneTwo');
    expect([...view.container.querySelectorAll('span')].map(node => node.textContent)).toEqual(['One', 'Two']);
    expect(view.container.querySelector('undefined')).toBeNull();
    view.update({ items: [] });
    expect(view.container.childNodes).toHaveLength(0);
    expect(destroyed).toHaveBeenCalledTimes(2);
  });

  it('resolves live token paths and receivers without sharing scope across renderers', () => {
    const clicks = [];
    const data = label => ({ values: [{ label }], amount: 0, enabled: false, suffix: '!',
      rows: [{ label: 'Row' }], actions: { label, select() { clicks.push(this.label); }, text() { return this.label; } } });
    const schema = [
      { $el: 'button', attrs: { onClick: '$actions.select', 'data-count': '$amount', 'data-enabled': '$enabled' }, children: '$values.0.label' },
      { $el: 'output', children: '$: $amount + 1' },
      { $el: 'strong', children: '$actions.text()' },
      { $el: 'span', for: ['row', '$rows'], children: ['$row.label', '$suffix'] }
    ];
    const first = render(schema, { data: data('First') });
    const second = render(schema, { data: data('Second') });
    const button = first.container.querySelector('button');
    expect(button.textContent).toBe('First');
    expect(button.dataset).toMatchObject({ count: '0', enabled: 'false' });
    expect(first.container.querySelector('span').textContent).toBe('Row!');
    button.click();
    first.update({ ...data('Changed'), amount: 2, enabled: true, suffix: '?', rows: [{ label: 'Updated' }] });
    expect(first.container.querySelector('button')).toBe(button);
    expect(button.textContent).toBe('Changed');
    expect(button.dataset).toMatchObject({ count: '2', enabled: 'true' });
    expect(first.container.querySelector('output').textContent).toBe('3');
    expect(first.container.querySelector('strong').textContent).toBe('Changed');
    expect(first.container.querySelector('span').textContent).toBe('Updated?');
    button.click();
    second.container.querySelector('button').click();
    expect(second.container.querySelector('button').textContent).toBe('Second');
    expect(clicks).toEqual(['First', 'Changed', 'Second']);
  });

  it('retains unchanged trusted SVG nodes and replaces markup only when its binding changes', () => {
    const svg = '<svg><path d="M0 0h10v10H0z" /></svg>';
    const view = render({ $el: 'span', attrs: { innerHTML: '$icon' } }, { allowHTML: true, data: { icon: svg } });
    const icon = view.container.querySelector('svg');
    const path = icon.querySelector('path');
    view.update({ icon: svg });
    expect(view.container.querySelector('svg')).toBe(icon);
    expect(path.isConnected).toBe(true);
    view.update({ icon: '<b>Changed</b>' });
    expect(icon.isConnected).toBe(false);
    expect(view.container.querySelector('b').textContent).toBe('Changed');
    view.setSchema({ $el: 'span', children: 'Ordinary content' });
    expect(view.container.textContent).toBe('Ordinary content');
    view.setSchema({ $el: 'span', attrs: { innerHTML: '$icon' } });
    expect(view.container.querySelector('b').textContent).toBe('Changed');
    view.update({ icon: null });
    expect(view.container.textContent).toBe('');
  });

  it('renders literal text safely, expressions, conditions and transparent groups', () => {
    const schema = [{ $el: 'h2', children: '$title' }, { $el: null, children: ['<script>alert(1)</script>'] },
      { if: '$show', then: { $el: 'p', children: 'Yes' }, else: { $el: 'strong', children: 'No' } },
      { $el: 'aside', if: '$show', children: 'More' }];
    const view = render(schema, { data: { title: 'Hello', show: true } });
    expect(view.container.querySelector('h2').textContent).toBe('Hello');
    expect(view.container.querySelector('script')).toBeNull();
    expect(view.container.querySelector('p').textContent).toBe('Yes');
    view.update({ title: 'Updated', show: false });
    expect(view.container.querySelector('h2').textContent).toBe('Updated');
    expect(view.container.querySelector('p')).toBeNull();
    expect(view.container.querySelector('strong').textContent).toBe('No');
    expect(view.container.querySelector('aside')).toBeNull();
    const conditional = render({ if: '$show', then: 'Visible' }, { data: { show: false } });
    expect(conditional.container.textContent).toBe('');
    conditional.update({ show: true });
    expect(conditional.container.textContent).toBe('Visible');
  });

  it('preserves keyed controls and focus during updates and reordering', () => {
    const data = { items: [{ id: 'a', value: 'Alpha' }, { id: 'b', value: 'Beta' }] };
    const view = render([{ $el: 'input', for: ['item', '$items'], key: '$item.id', attrs: { value: '$item.value' } }], { data });
    const [alpha, beta] = view.container.querySelectorAll('input');
    alpha.focus();
    alpha.setSelectionRange(1, 2);
    view.update(data);
    expect(document.activeElement).toBe(alpha);
    expect(alpha.selectionStart).toBe(1);
    view.update({ items: [...data.items].reverse() });
    expect([...view.container.querySelectorAll('input')]).toEqual([beta, alpha]);
    view.update({ items: [data.items[1]] });
    expect(view.container.querySelector('input')).toBe(beta);
    expect(alpha.isConnected).toBe(false);
  });

  it('maps conditional/bound/raw attributes and native properties, preserving handlers receiver', () => {
    const clicked = vi.fn();
    const model = { value: 'Native', click() { clicked(this.value); } };
    const schema = [{ $el: 'input', bind: '$attrs', attrs: {
      value: '$model.value', checked: '$checked', disabled: '$disabled',
      'aria-invalid': '$checked', 'data-selected': '$checked',
      title: { if: '$checked', then: 'On', else: 'Off' }, ['__raw__placeholder']: '$Literal',
      onClick: '$model.click'
    } }];
    const view = render(schema, { data: { model, checked: true, disabled: true, attrs: { name: 'first' } } });
    const input = view.container.querySelector('input');
    expect(input.value).toBe('Native');
    expect(input.checked).toBe(true);
    expect(input.disabled).toBe(true);
    expect(input.placeholder).toBe('$Literal');
    expect(input.title).toBe('On');
    input.dispatchEvent(new Event('click'));
    expect(clicked).toHaveBeenLastCalledWith('Native');
    view.update({ model, checked: false, disabled: false, attrs: {} });
    expect(input.disabled).toBe(false);
    expect(input.getAttribute('aria-invalid')).toBe('false');
    expect(input.getAttribute('data-selected')).toBe('false');
    expect(input.name).toBe('');
    expect(input.title).toBe('Off');
  });

  it('supports numeric/object loops, scoped keys, missing paths and conditional iterations', () => {
    const numeric = render([{ $el: 'span', for: ['item', 3], children: '$item' }]);
    expect(numeric.container.textContent).toBe('012');
    const object = render([{ $el: 'span', for: ['item', 'key', '$items'], if: '$item.show', children: '$key' }],
      { data: { items: { a: { show: false }, b: { show: true } } } });
    expect(object.container.textContent).toBe('b');
    object.update({});
    expect(object.container.textContent).toBe('');
    const missing = render(['$absent.path', '$present.path'], { data: { present: {} } });
    expect(missing.container.textContent).toBe('undefinedundefined');
  });

  it('supports explicit component mount, update and terminal cleanup without a UI framework', () => {
    const mounted = vi.fn();
    const destroyed = vi.fn();
    const updated = vi.fn();
    const Component = ({ document: ownerDocument, props, children }) => {
      mounted(props, children);
      const element = ownerDocument.createElement('button');
      return { element, update(nextProps) { updated(nextProps); element.textContent = nextProps.label; }, destroy: destroyed };
    };
    const view = render([{ $cmp: 'Portable', props: { label: '$label', items: ['$label'], meta: { title: '$label' } }, children: 'Slot' }],
      { data: { label: 'First' }, components: { Portable: Component } });
    view.update({ label: 'Second' });
    expect(view.container.querySelector('button').textContent).toBe('Second');
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(updated.mock.lastCall[0]).toEqual({ label: 'Second', items: ['Second'], meta: { title: 'Second' } });
    view.destroy();
    view.destroy();
    view.update({ label: 'Ignored' });
    expect(destroyed).toHaveBeenCalledTimes(1);
    expect(view.container.childNodes.length).toBe(0);
  });

  it('exposes the public $get registry lookup without owning another view’s node', () => {
    const node = createNode({ props: { id: 'schema-lookup' } });
    nodes.push(node);
    node.context = { label: 'Registered' };
    const view = render('$get("schema-lookup").label');
    expect(view.container.textContent).toBe('Registered');
    view.destroy();
    expect(node.props.id).toBe('schema-lookup');
    const missing = render('$get("missing")');
    expect(missing.container.textContent).toBe('undefined');
  });

  it('requires native component registration, rejects unsafe event strings, and duplicate loop identities', () => {
    expect(() => render({ $formkit: 'text' })).toThrow(/No native schema component/);
    expect(() => render({ $cmp: 'Missing' })).toThrow(/Missing/);
    expect(() => render({ $el: 'button', attrs: { onclick: 'alert(1)' } })).toThrow(/function bindings/);
    expect(() => render({ $el: 'div', attrs: { innerHTML: '<b>Unsafe</b>' } })).toThrow(/innerHTML/);
    expect(() => render({ $el: 'p', for: ['item', '$items'], key: '$item.id' },
      { data: { items: [{ id: 1 }, { id: 1 }] } })).toThrow(/Duplicate schema key/);
  });

  it('removes old handlers and attribute properties when updates remove them', () => {
    const callback = vi.fn();
    const view = render({ $el: 'input', bind: '$attrs' }, { data: { attrs: { value: 'a', checked: true, onClick: callback } } });
    const input = view.container.querySelector('input');
    input.dispatchEvent(new Event('click'));
    view.update({ attrs: { onClick: null } });
    expect(input.value).toBe('');
    expect(input.checked).toBe(false);
    input.dispatchEvent(new Event('click'));
    expect(callback).toHaveBeenCalledTimes(1);
    view.destroy();
    input.dispatchEvent(new Event('click'));
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

it('retains focused keyed identity when the focused control itself moves', () => {
  const items = [{ id: 'a', value: 'Alpha' }, { id: 'b', value: 'Beta' }];
  const view = render({ $el: 'input', for: ['item', '$items'], key: '$item.id', attrs: { value: '$item.value' } }, { data: { items } });
  const beta = view.container.querySelectorAll('input')[1];
  beta.focus();
  beta.setSelectionRange(1, 2);
  view.update({ items: [...items].reverse() });
  expect(document.activeElement).toBe(beta);
  expect(beta.selectionStart).toBe(1);
  view.update({ items: [] });
  expect(beta.isConnected).toBe(false);
});

it('handles explicit empty text nodes, attributes, and omitted component props', () => {
  const view = render([{ $el: 'text' }, { $el: 'input', attrs: { value: '$missing', title: null } }]);
  expect(view.container.textContent).toBe('');
  expect(view.container.querySelector('input').value).toBe('');
  const component = render({ $cmp: 'Empty' }, { components: { Empty({ document: ownerDocument, props }) {
    expect(props).toEqual({});
    return { element: ownerDocument.createElement('div'), update(next) { expect(next).toEqual({}); }, destroy() {} };
  } } });
  component.update();
});

it('updates dirty native values from a schema snapshot and supports empty transparent groups', () => {
  const view = render([{ $el: null }, { $el: 'input', attrs: { value: '$value' } }], { data: { value: 'Original' } });
  const input = view.container.querySelector('input');
  input.value = 'Edited';
  view.update({ value: 'External' });
  expect(input.value).toBe('External');
  input.value = 'Edited again';
  view.update({});
  expect(input.value).toBe('');
});
