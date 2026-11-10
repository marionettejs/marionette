import { afterEach, expect, it } from 'vitest';
import { FormView } from '@mnjs/formkit';
import { Region } from 'marionette';
import { getNode } from '@formkit/core';

const regions = [];
afterEach(() => { regions.splice(0).forEach(region => region.destroy()); document.body.replaceChildren(); });

// This verifies the adapter's public definition-prop channel without installing
// Pro in the normal unit suite. Actual Pro interaction acceptance is separate.
it('keeps declared autocomplete/popover/calendar props reactive without leaking them into HTML attrs', async() => {
  const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
  regions.push(region);
  const data = { position: 'auto', allowNew: true, panels: ['month'] };
  const form = new FormView({ formProps: { actions: false }, values: { control: 'Initial' }, schemaData: data,
    inputs: { positioned: { type: 'input', props: ['popoverPosition', 'allowNewValues', 'paginatedPanels'],
      schema: { $el: 'input', bind: '$attrs', attrs: { id: '$id', value: '$_value',
        'data-position': '$popoverPosition', 'data-panels': '$paginatedPanels', onInput: '$handlers.DOMInput' } } } },
    schema: [{ $formkit: 'positioned', name: 'control', id: 'pro-declared-props',
      popoverPosition: '$position', allowNewValues: '$allowNew', paginatedPanels: '$panels' }]
  });
  region.show(form);
  await form.node.settled;
  const node = form.node.at('control');
  const input = form.el.querySelector('input');
  expect(node.props.popoverPosition).toBe('auto');
  expect(node.props.allowNewValues).toBe(true);
  expect(node.props.paginatedPanels).toEqual(['month']);
  expect(input.dataset.position).toBe('auto');
  expect(input.dataset.panels).toBe('month');
  for (const name of ['popoverPosition', 'allowNewValues', 'paginatedPanels']) { expect(input.hasAttribute(name)).toBe(false); }
  data.position = 'above';
  data.allowNew = false;
  data.panels = ['year', 'month'];
  form.setSchemaData(data);
  expect(node.props.popoverPosition).toBe('above');
  expect(node.props.allowNewValues).toBe(false);
  expect(node.props.paginatedPanels).toEqual(['year', 'month']);
  expect(input.dataset.position).toBe('above');
  expect(input.dataset.panels).toBe('year,month');
  expect(input.value).toBe('Initial');
  expect(form.el.querySelector('input')).toBe(input);
  form.destroy();
  expect(node.context).toBeNull();
  expect(getNode('pro-declared-props')).toBeUndefined();
});
