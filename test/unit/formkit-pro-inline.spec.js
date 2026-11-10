import { afterEach, expect, it } from 'vitest';
import { FormView } from '@mnjs/formkit';
import { Region } from 'marionette';
import { getNode } from '@formkit/core';

const regions = [];
afterEach(() => { regions.splice(0).forEach(region => region.destroy()); document.body.replaceChildren(); });

// Ordinary native definition: this tests the adapter's declared boolean and
// named-slot channel, not actual Pro calendar, focus or panel-sequence behavior.
it('preserves a declared inline boolean and one named wrapper across explicit updates and reset', async() => {
  const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
  regions.push(region);
  const data = { inline: true, label: 'Before' };
  const form = new FormView({ formProps: { actions: false }, values: { calendar: '2026-11-09' }, schemaData: data,
    inputs: { calendarProbe: { type: 'input', props: ['inline'], schema: [
      { $el: 'input', bind: '$attrs', attrs: { id: '$id', value: '$_value', onInput: '$handlers.DOMInput' } },
      { $el: 'div', if: '$inline', children: '$slots.panelWrapper' }
    ] } },
    schema: [{ $formkit: 'calendarProbe', name: 'calendar', id: 'inline-prop-channel', label: '$label', inline: '$inline',
      children: { panelWrapper: { $el: 'output', attrs: { 'data-wrapper': 'probe' }, children: '$label + ":" + $value' } } }]
  });
  region.show(form);
  await form.node.settled;
  const node = form.node.at('calendar');
  const input = form.el.querySelector('input');
  input.focus();
  expect(node.props.inline).toBe(true);
  expect(input.hasAttribute('inline')).toBe(false);
  expect(form.el.querySelectorAll('[data-wrapper=probe]')).toHaveLength(1);
  expect(form.el.querySelector('output').textContent).toBe('Before:2026-11-09');
  data.inline = false;
  form.setSchemaData(data);
  expect(node.props.inline).toBe(false);
  expect(input.hasAttribute('inline')).toBe(false);
  expect(form.el.querySelector('output')).toBeNull();
  expect(document.activeElement).toBe(input);
  data.inline = true;
  data.label = 'After';
  form.setSchemaData(data);
  expect(form.el.querySelectorAll('[data-wrapper=probe]')).toHaveLength(1);
  expect(form.el.querySelector('output').textContent).toBe('After:2026-11-09');
  expect(form.el.querySelector('input')).toBe(input);
  form.setValues({ calendar: '2026-11-15' });
  expect(form.getValues()).toEqual({ calendar: '2026-11-15' });
  form.resetForm();
  await form.node.settled;
  expect(form.getValues()).toEqual({ calendar: '2026-11-09' });
  expect(form.node.at('calendar')).toBe(node);
  form.destroy();
  expect(node.context).toBeNull();
  expect(getNode('inline-prop-channel')).toBeUndefined();
});
