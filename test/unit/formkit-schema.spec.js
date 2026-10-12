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
