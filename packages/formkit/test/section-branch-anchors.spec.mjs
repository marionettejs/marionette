import { expect, it } from 'vitest';
import { mount } from '@mnjs/formkit';
import { renderSections } from '../src/runtime/section-renderer.mjs';

it('clears an imperative schema slot first shown after a branch update', () => {
  const host = document.createElement('main');
  const form = mount({
    host, data: { enabled: true },
    schema: { if: '$enabled', then: { $el: 'b' }, else: '$slots.append' },
    schemaSlots: {
      append({ parent, before }) {
        const output = document.createElement('output');
        output.textContent = 'Slot output';
        parent.insertBefore(output, before);
        return remove => { if (remove) { output.remove(); } };
      },
    },
  });
  try {
    expect(host.querySelector('b')).not.toBeNull();
    expect(host.querySelector('output')).toBeNull();
    form.updateData({ enabled: false });
    expect(host.querySelector('output')?.textContent).toBe('Slot output');
    form.updateData({ enabled: true });
    expect(host.querySelector('output')).toBeNull();
    expect(host.querySelector('b')).not.toBeNull();
  } finally {
    form.destroy();
    expect(host.childNodes).toHaveLength(0);
  }
});

it('clears component children rendered alongside their conditional ancestor', () => {
  const host = document.createElement('main');
  let output;
  const form = mount({
    host, data: { enabled: true },
    schema: [{ $el: 'strong', attrs: { id: 'unrelated' }, children: 'Keep me' },
      { if: '$enabled', then: { $el: 'div', attrs: { id: 'outer' }, children: {
        $cmp: 'Outlet', children: { $el: 'output' },
      } } }],
    components: {
      Outlet({ host: ownedHost, renderChildren }) {
        const ancestor = ownedHost.closest('#outer');
        const target = ancestor.parentElement;
        const cleanup = renderChildren(target, ancestor.nextSibling);
        output = target.querySelector('output');
        return { destroy: cleanup };
      },
    },
  });
  try {
    const ancestor = host.querySelector('#outer');
    expect(output?.parentNode).toBe(ancestor.parentNode);
    const unrelated = host.querySelector('#unrelated');
    expect(unrelated?.textContent).toBe('Keep me');
    for (let i = 0; i < 2; i++) {
      form.updateData({ enabled: false });
      expect(host.querySelector('#outer')).toBeNull();
      expect(host.querySelector('output')).toBeNull();
      expect(host.querySelector('#unrelated')).toBe(unrelated);
      form.updateData({ enabled: true });
      expect(host.querySelectorAll('output')).toHaveLength(1);
    }
  } finally {
    form.destroy();
    expect(host.childNodes).toHaveLength(0);
  }
});

it.each([
  ['a conditional hides', form => form.updateData({ enabled: false })],
  ['the form is destroyed', form => form.destroy()],
])('cleans surviving shadow outlets when %s', (_scenario, remove) => {
  const host = document.createElement('main');
  const externalHost = document.createElement('aside');
  const external = externalHost.attachShadow({ mode: 'open' });
  const independent = document.createElement('small');
  external.append(independent);
  host.append(externalHost);
  const wrapper = document.createElement('div');
  host.append(wrapper);
  let inner, form;
  try {
    form = mount({
      host: wrapper, data: { enabled: true },
      schema: { if: '$enabled', then: { $el: 'div', attrs: { id: 'shadow-owner' }, children: {
        $cmp: 'Outlets', children: { $el: 'output', children: 'Owned' },
      } } },
      components: {
        Outlets({ host: ownedHost, renderChildren }) {
          inner = ownedHost.closest('#shadow-owner').attachShadow({ mode: 'open' });
          renderChildren(inner);
          renderChildren(external);
        },
      },
    });
    expect(inner.querySelector('output')).not.toBeNull();
    expect(external.querySelector('output')).not.toBeNull();
    remove(form);
    expect(host.querySelector('#shadow-owner')).toBeNull();
    expect(inner.querySelector('output')?.textContent).toBe('Owned');
    expect([...external.children]).toEqual([independent]);
  } finally {
    form?.destroy();
    externalHost.remove();
    wrapper.remove();
  }
});

it('cleans an outlet nested inside the built-in FormKitRoot when its branch hides', () => {
  const host = document.createElement('main');
  document.body.append(host);
  const external = document.createElement('aside');
  const independent = document.createElement('small');
  external.append(independent);
  const form = mount({
    host, data: { enabled: true },
    schema: { if: '$enabled', then: { $el: 'div', children: {
      $cmp: 'FormKitRoot', children: { $cmp: 'Portal', children: { $el: 'output' } },
    } } },
    components: { Portal({ renderChildren }) { renderChildren(external); } },
  });
  try {
    expect(external.querySelector('output')).not.toBeNull();
    form.updateData({ enabled: false });
    expect([...external.children]).toEqual([independent]);
  } finally {
    form.destroy();
    host.remove();
  }
});

const portal = { $cmp: 'Portal', children: { $el: 'output' } };
it.each([
  ['a schema inside a conditional', {
    schema: { if: '$enabled', then: { $el: 'div', children: {
      $cmp: 'FormKitSchema', props: { schema: [{ $el: 'div', children: portal }] },
    } } },
  }, form => form.updateData({ enabled: false })],
  ['a schema inside a destroyed form', {
    schema: { $cmp: 'FormKitSchema', props: { schema: [{ $el: 'div', children: portal }] } },
  }, form => form.destroy()],
  ['a replaced nested schema', {
    schema: { $cmp: 'FormKitSchema', props: { schema: [{ $el: 'div', children: portal }] } },
  }, form => form.setSchema(undefined)],
  ['a named help slot inside a destroyed form', {
    fields: [{ name: 'answer', help: 'Help', children: { help: portal } }],
  }, form => form.destroy()],
  ['a native group layout inside a destroyed form', {
    schema: [{ $formkit: 'group', name: 'group', children: [{ $el: 'div', children: portal }] }],
  }, form => form.destroy()],
])('cleans an external outlet owned by %s', (_scenario, declaration, remove) => {
  const host = document.createElement('main');
  const external = document.createElement('aside');
  const independent = document.createElement('small');
  external.append(independent);
  const form = mount({
    host, data: { enabled: true }, ...declaration,
    components: { Portal({ renderChildren }) { renderChildren(external); } },
  });
  try {
    expect(external.querySelector('output')).not.toBeNull();
    remove(form);
    expect([...external.children]).toEqual([independent]);
  } finally {
    form.destroy();
  }
});

const authoredOutletSchemas = [
  ['opaque group', { $cmp: 'FormKitRoot', children: {
    $cmp: 'FormKit', props: { type: 'group', name: 'group' }, children: portal,
  } }],
  ['authored named Schema slot', { $cmp: 'FormKitSchema',
    props: { schema: ['$slots.details'] }, slots: { details: portal },
  }],
  ['authored default Schema slot', { $cmp: 'FormKitSchema',
    props: { schema: ['$slots.default'] }, children: portal,
  }],
  ['custom message section', { $cmp: 'FormKitMessages',
    props: { sectionsSchema: { messages: { ...portal, if: true } } },
  }],
];
it.each(authoredOutletSchemas.flatMap(([name, children])=>[
  [name, 'hide', children, form=>form.updateData({ enabled: false })],
  [name, 'destroy', children, form=>form.destroy()],
]))('cleans an escaped %s outlet on %s', (_name, _operation, children, remove) => {
  const host = document.createElement('main');
  document.body.append(host);
  const external = document.createElement('aside');
  const independent = document.createElement('small');
  external.append(independent);
  const form = mount({
    host, data: { enabled: true },
    schema: { if: '$enabled', then: { $el: 'div', children } },
    components: { Portal({ renderChildren }) { renderChildren(external); } },
  });
  try {
    expect(external.querySelector('output')).not.toBeNull();
    remove(form);
    expect([...external.children]).toEqual([independent]);
  } finally {
    form.destroy();
    host.remove();
  }
});

it('runs the factory-selected outlet disposer before remaining outlets', () => {
  const host = document.createElement('main');
  const external = document.createElement('aside');
  const teardown = [];
  const form = mount({
    host, data: { enabled: true },
    schema: { if: '$enabled', then: { $cmp: 'Both', children: {
      $el: 'output', attrs: { ref: '$register' },
    } } },
    components: {
      Both({ renderChildren }) {
        const register = name => element => { if (!element) { teardown.push(name); } };
        renderChildren(external, null, { register: register('first') });
        const second = renderChildren(external, null, { register: register('second') });
        return { destroy: second };
      },
    },
  });
  try {
    expect(external.children).toHaveLength(2);
    form.updateData({ enabled: false });
    expect(teardown).toEqual(['second', 'first']);
    expect(external.children).toHaveLength(0);
  } finally {
    form.destroy();
  }
});

it('respects explicit slot retention when a factory is torn down', () => {
  const host = document.createElement('main');
  const external = document.createElement('aside');
  const form = mount({
    host, data: { enabled: true },
    schema: { if: '$enabled', then: { $el: 'div', children: {
      $cmp: 'Portal', slots: { details: { $el: 'output', children: 'Keep this output' } },
    } } },
    components: {
      Portal({ renderSlot }) {
        const slot = renderSlot('details', external);
        return { destroy() { slot.destroy(false); } };
      },
    },
  });
  try {
    const output = external.querySelector('output');
    expect(output?.textContent).toBe('Keep this output');
    form.updateData({ enabled: false });
    expect(external.querySelector('output')).toBe(output);
  } finally {
    form.destroy();
    external.replaceChildren();
  }
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

it('keeps the control and connects help that first appears after a late section ref', async() => {
  const host = document.createElement('main');
  document.body.append(host);
  const field = { name: 'answer', id: 'answer', label: 'Answer', value: 'draft text' };
  const refValues = [];
  const ref = el => refValues.push(el);
  const custom = { ...field, sectionsSchema: { help: { attrs: { ref } } } };
  const form = mount({ host, fields: [field], formProps: { actions: false } });
  const flush = () => new Promise(resolve => setTimeout(resolve, 0));
  try {
    await form.node.settled;
    const input = host.querySelector('input');
    input.focus();
    input.setSelectionRange(2, 5);
    form.setFields([custom]);
    await flush();
    expect(input.hasAttribute('aria-describedby')).toBe(false);
    expect(refValues).toEqual([]);
    form.setFields([{ ...custom, help: 'Late explanation' }]);
    await flush();
    const help = document.getElementById(input.getAttribute('aria-describedby'));
    expect(help?.textContent).toBe('Late explanation');
    expect(refValues).toEqual([help]);
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([2, 5]);
    form.setFields([custom]);
    await flush();
    expect(refValues).toEqual([help, null]);
    expect(input.hasAttribute('aria-describedby')).toBe(false);
    expect(host.querySelector('input')).toBe(input);
  } finally {
    form.destroy();
    host.remove();
  }
});

it('keeps the control while a stock prefix icon is customized, toggled and activated', async() => {
  const host = document.createElement('main');
  document.body.append(host);
  const svg = '<svg viewBox="0 0 10 10"><path d="M 0 0 L 10 10"></path></svg>';
  const refValues = [];
  let clicks = 0;
  const field = { name: 'answer', id: 'answer-icon', value: 'draft text', prefixIcon: svg,
    onPrefixIconClick() { clicks++; },
  };
  const form = mount({ host, fields: [field], formProps: { actions: false } });
  const flush = () => new Promise(resolve => setTimeout(resolve, 0));
  const ref = el => refValues.push(el);
  const custom = { ...field, sectionsSchema: { prefixIcon: { attrs: { ref } } } };
  try {
    await form.node.settled;
    const input = host.querySelector('input');
    expect(host.querySelector('svg')).not.toBeNull();
    input.focus();
    input.setSelectionRange(2, 5);
    form.setFields([custom]);
    await flush();
    const icon = refValues[0];
    expect(icon?.querySelector('svg')).not.toBeNull();
    icon.click();
    expect(clicks).toBe(1);
    form.setFields([{ ...custom, prefixIcon: '' }]);
    await flush();
    expect(host.querySelector('svg')).toBeNull();
    expect(refValues).toEqual([icon, null]);
    form.setFields([custom]);
    await flush();
    const restored = refValues[2];
    expect(restored?.querySelector('svg')).not.toBeNull();
    restored.click();
    expect(clicks).toBe(2);
    expect(host.querySelector('input')).toBe(input);
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([2, 5]);
  } finally {
    form.destroy();
    host.remove();
  }
});
