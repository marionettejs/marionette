import { expect, it, vi } from 'vitest';
import { mount } from '@mnjs/formkit';

it('does not detach the active input when default sections are already in use', async() => {
  const host = document.createElement('main');
  document.body.append(host);
  const form = mount({
    host, fields: [{ name: 'answer', validation: 'required', value: 'draft content' }],
    formProps: { actions: false },
  });
  try {
    await form.node.settled;
    const node = form.node.at('answer'), input = host.querySelector('input');
    const blur = vi.fn();
    input.addEventListener('blur', blur);
    input.focus();
    input.setSelectionRange(2, 6);
    form.setSectionsSchema(undefined);
    expect(host.querySelector('input')).toBe(input);
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([2, 6]);
    expect(form.node.at('answer')).toBe(node);
    expect(blur).not.toHaveBeenCalled();
    expect(input.value).toBe('draft content');
  } finally {
    form.destroy();
    host.remove();
  }
});

it('still applies and clears a real section override through public methods', () => {
  const host = document.createElement('main');
  document.body.append(host);
  const form = mount({ host, fields: [{ name: 'answer', value: 'draft' }], formProps: { actions: true } });
  try {
    const input = host.querySelector('input[name=answer]');
    form.setSectionsSchema({ actions: { attrs: { 'data-section-custom': 'yes' } } });
    expect(host.querySelector('[data-section-custom=yes]')).not.toBeNull();
    form.setSectionsSchema(undefined);
    expect(host.querySelector('[data-section-custom=yes]')).toBeNull();
    expect(host.querySelector('input[name=answer]')).toBe(input);
  } finally {
    form.destroy();
    host.remove();
  }
});

it('still places fields when the root default slot changes', () => {
  const host = document.createElement('main');
  document.body.append(host);
  const form = mount({ host, fields: [{ name: 'answer', value: 'draft' }], formProps: { actions: false } });
  try {
    const input = host.querySelector('input');
    form.setSlots({
      default({ parent, before, renderFields }) {
        const wrapper = document.createElement('article');
        wrapper.setAttribute('aria-label', 'Replaced root layout');
        parent.insertBefore(wrapper, before);
        renderFields(wrapper);
        return remove => { if (remove) {wrapper.remove();} };
      },
    });
    const layout = host.querySelector('article[aria-label="Replaced root layout"]');
    expect(layout?.querySelector('input')).toBe(input);
    form.setSlots({});
    expect(host.querySelector('article')).toBeNull();
    expect(host.querySelector('input')).toBe(input);
    expect(input.value).toBe('draft');
  } finally {
    form.destroy();
    host.remove();
  }
});

it('rejects a reserved root slot without disturbing the live draft', async() => {
  const host = document.createElement('main');
  document.body.append(host);
  const form = mount({ host, fields: [{ name: 'answer' }], formProps: { actions: false } });
  try {
    const node = form.node.at('answer'), input = host.querySelector('input');
    input.focus();
    input.value = 'typed draft';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.setSelectionRange(1, 5);
    expect(() => form.setSlots({ fields() {} })).toThrow('The root fields slot is reserved');
    expect(host.querySelector('input')).toBe(input);
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([1, 5]);
    expect(form.node.at('answer')).toBe(node);
    await node.settled;
    expect(form.getValues()).toEqual({ answer: 'typed draft' });
  } finally {
    form.destroy();
    host.remove();
  }
});

it('releases a fields outlet if the owning slot callback throws', () => {
  const host = document.createElement('main'), sibling = document.createElement('section');
  document.body.append(host, sibling);
  const marker = document.createElement('span');
  sibling.append(marker);
  const form = mount({ host, fields: [{ name: 'answer' }], formProps: { actions: false } });
  const failure = new Error('slot failed');
  try {
    expect(() => form.setSlots({
      default({ renderFields }) {
        renderFields(sibling, marker);
        expect(sibling.querySelector('input')).not.toBeNull();
        throw failure;
      },
    })).toThrow(failure);
    expect(Array.from(sibling.childNodes)).toEqual([marker]);
    form.setSlots({});
    expect(host.querySelector('input[name=answer]')).not.toBeNull();
  } finally {
    form.destroy();
    host.remove();
    sibling.remove();
  }
});
