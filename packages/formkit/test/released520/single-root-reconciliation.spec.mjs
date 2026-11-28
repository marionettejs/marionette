import { getNode } from '@formkit/core';
import { expect, it, vi } from 'vitest';
import { mount } from '@mnjs/formkit';

const row = (key, label) => ({
  type: 'group',
  key,
  children: [{
    name: 'entry', id: 'entry-' + key, label, value: '',
    validation: 'required|length:3', validationVisibility: 'live'
  }]
});
const rows = (...groups) => [{ type: 'list', name: 'rows', children: groups }];

it('keeps validation and keyed nested field identity on the single-root path', async() => {
  const host = document.createElement('main');
  document.body.append(host);
  const a = row('a', 'First entry');
  const b = row('b', 'Second entry');
  const form = mount({ host, fields: rows(a, b), formProps: { actions: false } });
  const control = host.querySelector('#entry-a');
  const node = getNode('entry-a');
  const sibling = getNode('entry-b');
  const described = () => (control.getAttribute('aria-describedby') ?? '')
    .split(/\s+/).filter(Boolean).map(id => document.getElementById(id)?.textContent ?? '').join(' ');
  const edit = value => {
    control.value = value;
    control.dispatchEvent(new Event('input', { bubbles: true }));
  };
  try {
    expect(control.labels[0].textContent).toBe('First entry');
    await vi.waitFor(() => expect(described()).toMatch(/required/i));
    edit('ab');
    await vi.waitFor(() => expect(described()).toMatch(/3/));
    edit('valid');
    await vi.waitFor(() => {
      expect(node.value).toBe('valid');
      expect(described()).toBe('');
    });
    expect(sibling.value).toBe('');

    // FormKit's Core list index is the owner of aggregate value order.
    node.parent.index = 1;
    form.setFields(rows(b, a));
    await form.whenPendingEditsSettled();
    await vi.waitFor(() => expect([...host.querySelectorAll('input')].map(x => x.id)).toEqual(['entry-b', 'entry-a']));
    expect(host.querySelector('#entry-a')).toBe(control);
    expect(getNode('entry-a')).toBe(node);
    expect(getNode('entry-b')).toBe(sibling);
    expect(form.getValues().rows).toEqual([{ entry: '' }, { entry: 'valid' }]);

    edit('');
    await vi.waitFor(() => expect(described()).toMatch(/required/i));
  } finally {
    form.destroy();
    expect(host.children).toHaveLength(0);
    expect(getNode('entry-a')).toBeUndefined();
    expect(getNode('entry-b')).toBeUndefined();
    host.remove();
  }
});
