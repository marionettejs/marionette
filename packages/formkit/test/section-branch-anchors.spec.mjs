import { expect, it } from 'vitest';
import { mount } from '@mnjs/formkit';
import { renderSections } from '../src/runtime/section-renderer.mjs';

it('clears an imperative slot inserted after the original else branch changes', () => {
  const host = document.createElement('main');
  const data = { enabled: true };
  const schema = { if: '$enabled', then: { $el: 'b' }, else: { $el: 'i' } };
  const renderer = renderSections({
    host, schema, data, context: {},
    slots: {
      append({ parent, before }) {
        parent.insertBefore(document.createElement('output'), before);
      },
    },
  });
  schema.else = '$slots.append';
  data.enabled = false;
  renderer.update();
  expect(host.querySelector('output')).not.toBeNull();
  renderer.destroy();
  expect(host.childNodes).toHaveLength(0);
});

it('clears component content explicitly mounted alongside its owned ancestor', () => {
  const host = document.createElement('main');
  let output;
  const renderer = renderSections({
    host, context: {}, data: { enabled: true },
    schema: { if: '$enabled', then: { $el: 'div', children: {
      $cmp: 'Outlet', children: { $el: 'output' },
    } } },
    components: {
      Outlet({ renderChildren }) {
        // The outlet deliberately renders outside its parent's element, but
        // still within the enclosing conditional branch.
        const destroy = renderChildren(host, host.lastChild);
        output = host.querySelector('output');
        return { destroy };
      },
    },
  });
  expect(output?.parentNode).toBe(host);
  renderer.destroy();
  expect(host.childNodes).toHaveLength(0);
});

it('preserves descendants and stops updates when teardown does not remove DOM', () => {
  const host = document.createElement('main');
  const data = { enabled: true };
  const schema = { if: '$enabled', then: { $el: 'b', children: 'on' }, else: { $el: 'i', children: 'off' } };
  const renderer = renderSections({ host, schema, data, context: {} });
  const existing = [...host.childNodes];
  renderer.destroy(false);
  data.enabled = false;
  renderer.update();
  expect([...host.childNodes]).toEqual(existing);
  expect(host.querySelector('b').textContent).toBe('on');
  expect(host.querySelector('i')).toBeNull();
});

it('opens initially empty stock help without creating its own markers or replacing the control', async() => {
  const host = document.createElement('main');
  document.body.append(host);
  const field = { name: 'answer', label: 'Answer', delay: 0 };
  const form = mount({ host, fields: [field], formProps: { actions: false } });
  try {
    await form.node.settled;
    const input = host.querySelector('input');
    const node = form.node.at('answer');
    input.focus();
    const openCount = () => {
      const walker = document.createTreeWalker(host, NodeFilter.SHOW_COMMENT);
      let n = 0;
      for (let mark = walker.nextNode(); mark; mark = walker.nextNode()) {
        if (mark.data === 'section') { n++; }
      }
      return n;
    };
    const empty = openCount();
    form.setFields([{ ...field, help: 'Explanation' }]);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(host.textContent).toContain('Explanation');
    expect(openCount()).toBe(empty);
    node.setErrors(['Local message']);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(host.textContent).toContain('Local message');
    const descriptions = () => (input.getAttribute('aria-describedby') ?? '').split(/\s+/)
      .filter(Boolean).map(id => document.getElementById(id)?.textContent);
    expect(descriptions()).toContain('Explanation');
    expect(descriptions()).toContain('Local message');
    expect(host.querySelector('input')).toBe(input);
    expect(document.activeElement).toBe(input);
    form.setFields([field]);
    node.clearErrors();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(host.textContent).not.toContain('Explanation');
    expect(host.textContent).not.toContain('Local message');
    expect(descriptions()).toEqual([]);
    expect(form.node.at('answer')).toBe(node);
    expect(host.querySelector('input')).toBe(input);
  } finally {
    form.destroy();
    expect(host.childNodes).toHaveLength(0);
    host.remove();
  }
});

it('keeps explicitly customized conditional branches on the general path', async() => {
  const host = document.createElement('main');
  const form = mount({ host, fields: [{
    name: 'answer', label: 'Answer',
    children: { label: { $el: 'strong', children: 'Named slot' } },
    sectionsSchema: { inner: { attrs: { 'data-section-custom': 'yes' } } },
  }] });
  try {
    await form.node.settled;
    expect(host.querySelector('strong').textContent).toBe('Named slot');
    expect(host.querySelector('[data-section-custom]').contains(host.querySelector('input'))).toBe(true);
  } finally {
    form.destroy();
    expect(host.childNodes).toHaveLength(0);
  }
});

it('reuses a stock section after adding and removing a named help slot', async() => {
  const host = document.createElement('main');
  const field = { name: 'answer', help: 'Default help' };
  const form = mount({ host, fields: [field] });
  const flush = () => new Promise(resolve => setTimeout(resolve, 0));
  try {
    await form.node.settled;
    const original = host.querySelector('input');
    const help = () => [...host.querySelectorAll('div')].filter(el => el.textContent === 'Default help').length;
    expect(help()).toBeGreaterThan(0);
    form.setFields([{ ...field, children: { help: { $el: 'strong', children: 'Custom help' } } }]);
    await flush();
    expect(host.querySelector('strong')?.textContent).toBe('Custom help');
    expect(host.textContent).not.toContain('Default help');
    form.setFields([field]);
    await flush();
    expect(host.querySelector('strong')).toBeNull();
    expect(help()).toBeGreaterThan(0);
    expect(host.querySelector('input')).toBe(original);
  } finally {
    form.destroy();
    expect(host.childNodes).toHaveLength(0);
  }
});

it('does not sweep an independent element left by a configured help slot', async() => {
  const host = document.createElement('main');
  const field = { name: 'answer', help: 'Default help' };
  const custom = { ...field, children: { help: { $cmp: 'StatusOnDestroy' } } };
  let status;
  const form = mount({
    host, fields: [custom], components: {
      StatusOnDestroy({ host: slotContent }) {
        return { destroy(remove) {
          const wrapper = slotContent.closest('[data-experiment-slot="help"]');
          if (!status && remove && wrapper) {
            status = document.createElement('output');
            status.textContent = 'External status';
            wrapper.after(status);
          }
        } };
      }
    },
  });
  const flush = () => new Promise(resolve => setTimeout(resolve, 0));
  try {
    await form.node.settled;
    expect(host.querySelector('output')).toBeNull();
    form.setFields([field]);
    await flush();
    expect(host.querySelector('output')).toBe(status);
    expect(host.textContent).toContain('Default help');
    form.setFields([custom]);
    await flush();
    expect(host.querySelector('output')).toBe(status);
    expect(host.textContent).not.toContain('Default help');
  } finally {
    form.destroy();
    expect(host.childNodes).toHaveLength(0);
  }
});

it('retains active stock help and calls its late ref cleanup without remounting', async() => {
  const host = document.createElement('main');
  const field = { name: 'answer', help: 'Default help' };
  const form = mount({ host, fields: [field] });
  const seen = [];
  try {
    await form.node.settled;
    const input = host.querySelector('input');
    const described = input.getAttribute('aria-describedby');
    const help = host.querySelector(`[id="${described}"]`);
    expect(help?.textContent).toBe('Default help');
    form.setFields([{ ...field, sectionsSchema: { help: { attrs: { ref: node => seen.push(node) } } } }]);
    expect(host.querySelector('input')).toBe(input);
    expect(seen).toEqual([help]);
  } finally {
    form.destroy();
    expect(seen.at(-1)).toBeNull();
    expect(host.childNodes).toHaveLength(0);
  }
});

it('keeps keyed controls and their accessible labels attached during row reorder', async() => {
  const host = document.createElement('main');
  document.body.append(host);
  const left = { key: 'left', name: 'left', id: 'left', label: 'Left' };
  const right = { key: 'right', name: 'right', id: 'right', label: 'Right' };
  const form = mount({ host, fields: [left, right] });
  try {
    await form.node.settled;
    const control = host.querySelector('#right');
    control.value = 'editing';
    control.focus();
    control.setSelectionRange(2, 4);
    form.setFields([right, left]);
    expect([...host.querySelectorAll('input')].map(el => el.id)).toEqual(['right', 'left']);
    expect(host.querySelector('#right')).toBe(control);
    expect(host.querySelector('label[for="right"]').control).toBe(control);
    expect(document.activeElement).toBe(control);
    expect([control.selectionStart, control.selectionEnd]).toEqual([2, 4]);
  } finally {
    form.destroy();
    expect(host.childNodes).toHaveLength(0);
    host.remove();
  }
});

it('retires siblings from a help ref added without replacing the field', async() => {
  const host = document.createElement('main');
  document.body.append(host);
  const field = { name: 'answer', label: 'Answer', help: 'Default help', value: 'draft text' };
  const refCalls = [];
  const custom = { ...field, sectionsSchema: { help: { attrs: { ref(element) {
    refCalls.push(!!element);
    if (element) {
      const output = document.createElement('output');
      output.textContent = 'Ref-owned status';
      element.after(output);
    }
  } } } } };
  const named = { ...custom, children: { help: { $el: 'strong', children: 'Named help' } } };
  const form = mount({ host, fields: [field], formProps: { actions: false } });
  const flush = () => new Promise(resolve => setTimeout(resolve, 0));
  try {
    await form.node.settled;
    const input = host.querySelector('input');
    const defaultHelp = [...host.querySelectorAll('div')].find(el => el.textContent === 'Default help');
    input.focus();
    input.setSelectionRange(2, 5);
    form.setFields([custom]);
    await flush();
    expect(defaultHelp.isConnected).toBe(true);
    expect(host.querySelectorAll('output')).toHaveLength(1);
    for (let i = 0; i < 2; i++) {
      form.setFields([named]);
      await flush();
      expect(host.querySelector('strong')?.textContent).toBe('Named help');
      expect(host.querySelectorAll('output')).toHaveLength(0);
      form.setFields([custom]);
      await flush();
      expect(host.querySelector('strong')).toBeNull();
      expect(host.querySelectorAll('output')).toHaveLength(1);
      expect(host.querySelector('input')).toBe(input);
      expect(document.activeElement).toBe(input);
      expect([input.selectionStart, input.selectionEnd]).toEqual([2, 5]);
    }
    expect(refCalls).toEqual([true, false, true, false, true]);
  } finally {
    form.destroy();
    expect(host.childNodes).toHaveLength(0);
    host.remove();
  }
});
