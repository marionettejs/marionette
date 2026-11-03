import { afterEach, describe, expect, it, vi } from 'vitest';
import { Region } from 'marionette';
import { FormView, createSchemaRenderer } from '@mnjs/formkit';
import { getNode } from '@formkit/core';

const owned = [];
const flush = async() => { for (let index = 0; index < 8; index++) { await Promise.resolve(); } };
function mount(options) {
  const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
  const form = new FormView(options);
  owned.push(region, form);
  region.show(form);
  return form;
}
function render(schema, options = {}) {
  const element = document.body.appendChild(document.createElement('div'));
  const renderer = createSchemaRenderer(element, { schema, ...options });
  owned.push(renderer);
  return { element, ...renderer };
}
async function edit(input, value) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await getNode(input.id).settled;
  await flush();
}
afterEach(() => {
  owned.splice(0).forEach(owner => owner.destroy());
  document.body.replaceChildren();
});

describe('@mnjs/formkit reviewed ownership and native behavior', () => {
  it('reorders explicitly keyed sibling fields without losing values, nodes or focus', async() => {
    const schema = [
      { $formkit: 'text', key: 'a', name: 'a', label: 'First', value: 'Alpha' },
      { $formkit: 'text', key: 'b', name: 'b', label: 'Second', value: 'Beta' }
    ];
    const form = mount({ schema });
    const [alpha, beta] = form.el.querySelectorAll('input');
    const node = getNode(alpha.id);
    await edit(alpha, 'Edited');
    alpha.focus(); alpha.setSelectionRange(1, 3);
    form.setSchema([...schema].reverse());
    await flush();
    expect(form.getValues()).toEqual({ a: 'Edited', b: 'Beta' });
    const controls = form.el.querySelectorAll('input');
    expect(controls[0]).toBe(beta); expect(controls[1]).toBe(alpha);
    expect(getNode(alpha.id)).toBe(node);
    expect(document.activeElement).toBe(alpha);
    expect([alpha.selectionStart, alpha.selectionEnd]).toEqual([1, 3]);
  });

  it('keeps explicitly keyed standalone controls when sibling positions change', () => {
    const schema = [
      { $el: 'input', key: 'a', attrs: { value: 'Alpha' } },
      { $el: 'input', key: 'b', attrs: { value: 'Beta' } }
    ];
    const view = render(schema);
    const [alpha, beta] = view.element.querySelectorAll('input');
    beta.focus(); beta.setSelectionRange(1, 2);
    view.setSchema([...schema].reverse());
    const controls = view.element.querySelectorAll('input');
    expect(controls[0]).toBe(beta); expect(controls[1]).toBe(alpha);
    expect(document.activeElement).toBe(beta);
    expect(beta.selectionStart).toBe(1);
    expect(() => view.setSchema([schema[0], schema[0]])).toThrow(/Duplicate schema key/);
  });

  it('applies select values after creating and updating native options', () => {
    const view = render({ $el: 'select', attrs: { value: '$selected' }, children: [
      { $el: 'option', for: ['option', '$options'], key: '$option', attrs: { value: '$option' }, children: '$option' }
    ] }, { data: { selected: 'b', options: ['a', 'b'] } });
    const select = view.element.querySelector('select');
    expect(select.value).toBe('b');
    select.focus();
    view.update({ selected: 'c', options: ['b', 'c'] });
    expect(select.value).toBe('c');
    expect(view.element.querySelector('select')).toBe(select);
    expect(document.activeElement).toBe(select);
  });

  it('destroys component children immediately when trusted HTML takes ownership', () => {
    const destroyed = vi.fn();
    const schema = { $el: 'section', bind: '$attrs', children: [{ $cmp: 'Child' }] };
    const view = render(schema, { allowHTML: true, data: { attrs: {} }, components: {
      Child({ document: ownerDocument }) {
        return { element: ownerDocument.createElement('button'), update() {}, destroy: destroyed };
      }
    } });
    const child = view.element.querySelector('button');
    view.update({ attrs: { innerHTML: '<p>Replacement</p>' } });
    expect(destroyed).toHaveBeenCalledTimes(1);
    expect(child.isConnected).toBe(false);
    expect(view.element.querySelector('p').textContent).toBe('Replacement');
    view.update({ attrs: {} });
    expect(view.element.querySelector('button')).not.toBe(child);
    view.destroy();
    expect(destroyed).toHaveBeenCalledTimes(2);
  });

  it.each(['fields', 'schema'])('mounts %s into an adopted form with placeholder content through a Region', mode => {
    const element = document.createElement('form');
    element.innerHTML = '<p>Loading</p>';
    const definition = mode === 'fields' ? { type: 'text' } : { $formkit: 'text' };
    const form = mount({ el: element, [mode]: [{ ...definition, name: 'name', label: 'Name', value: 'Ada' }] });
    const input = element.querySelector('input');
    expect(input.value).toBe('Ada');
    expect(element.querySelector('p')).toBeNull();
    expect(form.getValues()).toEqual({ name: 'Ada' });
    form.render();
    expect(element.querySelector('input')).toBe(input);
  });

  it('reuses an adopted form across schema owners and restores the host listener adapter', async() => {
    const element = document.createElement('form');
    const nativeAdd = element.addEventListener.bind(element);
    const hostAdapter = function(...args) { nativeAdd(...args); };
    element.addEventListener = hostAdapter;
    const external = vi.fn();
    const callbacks = [];
    for (let index = 0; index < 3; index++) {
      const submit = vi.fn(); callbacks.push(submit);
      const form = mount({ el: element, schema: [{ $formkit: 'text', name: 'name', label: 'Name' }], submit });
      const input = element.querySelector('input');
      const event = new Event('submit', { cancelable: true });
      element.dispatchEvent(event);
      await flush();
      expect(event.defaultPrevented).toBe(true);
      expect(submit).toHaveBeenCalledTimes(1);
      form.destroy();
      expect(element.addEventListener).toBe(hostAdapter);
      expect(getNode(input.id)).toBeUndefined();
    }
    element.addEventListener('host', external);
    element.dispatchEvent(new Event('host'));
    expect(external).toHaveBeenCalledTimes(1);
    callbacks.forEach(callback => expect(callback).toHaveBeenCalledTimes(1));
  });

  it('makes initial field values observable inside the Marionette render event', () => {
    const form = new FormView({ fields: [{ type: 'text', name: 'name', label: 'Name', value: 'Ada' }] });
    owned.push(form);
    const onRender = vi.fn(() => {
      expect(form.el.querySelector('input').value).toBe('Ada');
      expect(form.getValues()).toEqual({ name: 'Ada' });
    });
    const changed = vi.fn();
    form.on('render', onRender); form.on('form:change', changed);
    form.render(); form.render();
    expect(onRender).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('clears submission errors on schema edits while retaining independent validation', async() => {
    const form = mount({ schema: [
      { $formkit: 'text', name: 'name', label: 'Name', validation: 'required', validationVisibility: 'live' }
    ] });
    form.setErrors(['Submission'], { name: ['Field submission'] });
    const input = form.el.querySelector('input');
    await edit(input, 'Ada');
    expect(form.getFormState().errors).toEqual([]);
    expect(form.el.textContent).not.toContain('Field submission');
    await edit(input, '');
    await form.node.at('name').ledger.settled('validating'); await flush();
    expect(form.el.textContent).toContain('Name is required.');
    expect(form.getFormState().errors).toEqual([]);
  });

  it('retains declarative form errors when schema fields are edited', async() => {
    const form = mount({ formProps: { errors: ['Declared'] }, schema: [
      { $formkit: 'text', name: 'name', label: 'Name' }
    ] });
    await edit(form.el.querySelector('input'), 'Ada');
    expect(form.getFormState().errors).toEqual(['Declared']);
  });

  it('honors the form preserveErrors policy during a schema edit', async() => {
    const form = mount({ formProps: { preserveErrors: true }, schema: [
      { $formkit: 'text', name: 'name', label: 'Name' }
    ] });
    form.setErrors(['Submission']);
    await edit(form.el.querySelector('input'), 'Ada');
    expect(form.getFormState().errors).toEqual(['Submission']);
  });

  it('consumes a delayed user origin before a later public node input', async() => {
    const form = mount({ config: { delay: 15 }, schema: [{ $formkit: 'text', name: 'name', label: 'Name' }] });
    const changed = vi.fn(); form.on('form:change', changed);
    const input = form.el.querySelector('input');
    await edit(input, 'User');
    expect(changed.mock.lastCall[2].source).toBe('user');
    const changes = changed.mock.calls.length;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(changed).toHaveBeenCalledTimes(changes);
    await form.node.at('name').input('External'); await flush();
    expect(changed.mock.lastCall[2].source).toBe('programmatic');
  });

  it('consumes checkbox change origins before a subsequent public node edit', async() => {
    const form = mount({ schema: [{ $formkit: 'checkbox', name: 'enabled', label: 'Enabled' }] });
    const changed = vi.fn(); form.on('form:change', changed);
    const input = form.el.querySelector('input');
    input.checked = true;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await form.node.settled; await flush();
    expect(changed.mock.lastCall[2].source).toBe('user');
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await form.node.at('enabled').input(false, false); await flush();
    expect(changed.mock.lastCall[2].source).toBe('programmatic');
  });

  it('consumes a delayed edit that returns to its original value without a change event', async() => {
    const form = mount({ config: { delay: 15 }, schema: [
      { $formkit: 'text', name: 'name', label: 'Name', value: 'Base' }
    ] });
    const changed = vi.fn(); form.on('form:change', changed);
    const input = form.el.querySelector('input');
    for (const value of ['Temporary', 'Base']) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await form.node.settled; await flush();
    expect(form.getValues()).toEqual({ name: 'Base' });
    expect(changed).not.toHaveBeenCalled();
    await form.node.at('name').input('Owner', false); await flush();
    expect(changed.mock.lastCall[2].source).toBe('programmatic');
  });

  it('does not relabel a pending programmatic edit when another control emits an unchanged event', async() => {
    const form = mount({ config: { delay: 15 }, schema: [
      { $formkit: 'text', name: 'first', label: 'First', value: 'Base' },
      { $formkit: 'text', name: 'second', label: 'Second', value: 'Same' }
    ] });
    const changed = vi.fn(); form.on('form:change', changed);
    const pending = form.node.at('first').input('Owner');
    const input = form.el.querySelectorAll('input')[1];
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await pending; await flush();
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed.mock.lastCall[0]).toEqual({ first: 'Owner', second: 'Same' });
    expect(changed.mock.lastCall[2].source).toBe('programmatic');
  });

  it.each(['non-bubbling', 'stopped'])('limits native origin to dispatch for a %s input event', async mode => {
    const form = mount({ schema: [{ $formkit: 'text', name: 'name', label: 'Name' }] });
    const changed = vi.fn(); form.on('form:change', changed);
    const input = form.el.querySelector('input');
    if (mode === 'stopped') { input.addEventListener('input', event => event.stopPropagation()); }
    input.value = 'User';
    input.dispatchEvent(new Event('input', { bubbles: mode === 'stopped' }));
    await form.node.settled; await flush();
    expect(changed.mock.lastCall[2].source).toBe('user');
    await form.node.at('name').input('Owner', false); await flush();
    expect(changed.mock.lastCall[2].source).toBe('programmatic');
    // Also check a no-op event followed immediately by a public edit, before
    // any microtask can release the captured DOM event reference.
    input.dispatchEvent(new Event('input', { bubbles: mode === 'stopped' }));
    await form.node.at('name').input('Immediate owner', false);
    expect(changed.mock.lastCall[2].source).toBe('programmatic');
  });

  it('retains user origin when a native date deletion commits on blur', async() => {
    const form = mount({ schema: [{ $formkit: 'date', name: 'date', label: 'Date', value: '2026-10-11' }] });
    await flush();
    const changed = vi.fn(); form.on('form:change', changed);
    const input = form.el.querySelector('input');
    input.focus(); input.value = '';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    await flush();
    expect(form.getValues()).toEqual({ date: '2026-10-11' });
    expect(input.value).toBe('');
    expect(changed).not.toHaveBeenCalled();
    input.dispatchEvent(new FocusEvent('blur'));
    await form.node.settled; await flush();
    expect(form.getValues()).toEqual({ date: '' });
    expect(changed.mock.lastCall[2].source).toBe('user');
  });

  it('preserves unchanged multiple error entries during repeated renders', () => {
    const form = mount({ fields: [{ type: 'text', name: 'name', label: 'Name' }] });
    form.setErrors([], { name: ['First', 'Second'] });
    const entries = [...form.el.querySelectorAll('.formkit-messages li')];
    form.render(); form.render();
    const current = form.el.querySelectorAll('.formkit-messages li');
    expect(current).toHaveLength(2);
    current.forEach((entry, index) => expect(entry).toBe(entries[index]));
    form.setErrors([], { name: ['F', 'irstSecond'] });
    expect([...form.el.querySelectorAll('.formkit-messages li')].map(entry => entry.textContent)).toEqual(['F', 'irstSecond']);
  });

  it.each(['fields', 'schema'])('passes the native %s submit event and root node to onSubmitRaw', async mode => {
    const raw = vi.fn(); const saved = vi.fn();
    const definition = mode === 'fields' ? { type: 'text' } : { $formkit: 'text' };
    const form = mount({ [mode]: [{ ...definition, name: 'name', label: 'Name', value: 'Ada' }],
      formProps: { onSubmitRaw: raw }, submit: saved });
    const event = new Event('submit', { bubbles: true, cancelable: true });
    form.el.dispatchEvent(event);
    await vi.waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(event.defaultPrevented).toBe(true);
    expect(raw).toHaveBeenCalledTimes(1);
    expect(raw.mock.lastCall[0]).toBe(event);
    expect(raw.mock.lastCall[1]).toBe(form.node);
    expect(saved.mock.lastCall[0]).toEqual({ name: 'Ada' });
  });

  it('links help and visible schema errors to their real DOM IDs across validation and correction', async() => {
    const form = mount({ schema: [{ $formkit: 'email', name: 'email', label: 'Email', help: 'Contact address',
      validation: 'required|email', validationVisibility: 'live' }] });
    await flush();
    const input = form.el.querySelector('input');
    const described = () => input.getAttribute('aria-describedby').split(' ').map(id => document.getElementById(id));
    expect(input.labels[0].textContent).toBe('Email');
    expect(described()).toHaveLength(2);
    expect(described().every(element => element && form.el.contains(element))).toBe(true);
    expect(described().map(element => element.textContent)).toEqual(['Contact address', 'Email is required.']);
    await edit(input, 'ada@example.com');
    await form.node.at('email').ledger.settled('validating'); await flush();
    expect(described().map(element => element.textContent)).toEqual(['Contact address']);
    expect(input.getAttribute('aria-invalid')).toBeNull();
    form.setErrors([], { email: ['Already registered'] }); await flush();
    expect(described().map(element => element.textContent)).toEqual(['Contact address', 'Already registered']);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    await edit(input, 'other@example.com');
    expect(described().map(element => element.textContent)).toEqual(['Contact address']);
  });

  it.each(['fields', 'schema'])('retains %s draft state and owned nodes through Region detach and re-show', async mode => {
    const definition = mode === 'fields' ? { type: 'text' } : { $formkit: 'text' };
    const form = new FormView({ [mode]: [{ ...definition, name: 'name', label: 'Name', value: 'Initial' }] });
    const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
    owned.push(region, form); region.show(form);
    const input = form.el.querySelector('input');
    await edit(input, 'Draft');
    form.setErrors(['Retry'], { name: ['Check draft'] }); await flush();
    const node = getNode(input.id);
    expect(region.detachView()).toBe(form);
    expect(form.isDestroyed()).toBe(false);
    expect(input.isConnected).toBe(false);
    expect(getNode(input.id)).toBe(node);
    expect(form.getValues()).toEqual({ name: 'Draft' });
    region.show(form); await flush();
    expect(form.el.querySelector('input')).toBe(input);
    expect(form.getValues()).toEqual({ name: 'Draft' });
    expect(form.getFormState().errors).toEqual(['Retry']);
    expect(form.el.textContent).toContain('Check draft');
    await edit(input, 'Resumed');
    expect(form.getValues()).toEqual({ name: 'Resumed' });
    region.destroy();
    expect(getNode(input.id)).toBeUndefined();
  });

  it('keeps an explicitly empty schema in schema mode and can later mount and remove a field', async() => {
    const form = mount({ schema: '' });
    expect(form.getValues()).toEqual({});
    expect(form.el.querySelector('button[type=submit]')).not.toBeNull();
    form.setSchema([{ $formkit: 'text', name: 'name', label: 'Name', value: 'Ada' }]); await flush();
    const input = form.el.querySelector('input');
    expect(input.value).toBe('Ada');
    form.setSchema(''); await flush();
    expect(form.el.querySelector('input')).toBeNull();
    expect(getNode(input.id)).toBeUndefined();
    expect(form.getValues()).toEqual({});
    expect(await form.submit()).toBe('success');
  });
});
