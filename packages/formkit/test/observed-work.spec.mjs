import { afterEach, expect, it } from 'vitest';
import { FormKitView } from '@mnjs/formkit';

const forms = [];
function formWith(options = {}) {
  const form = new FormKitView({ fields: [{ name: 'answer' }], instrument: true, ...options });
  forms.push(form);
  document.body.append(form.render().el);
  return form;
}
afterEach(() => {
  for (const form of forms.splice(0)) {form.destroy();}
  document.body.replaceChildren();
});

it('does not compute form-state notifications with no subscriber', async() => {
  const form = formWith();
  const before = form.metrics.stateEvents;
  await form.node.at('answer').input('changed', false);
  form.setErrors(['Example'], {});
  expect(form.metrics.stateEvents - before).toBe(0);
  expect(form.getFormState().errors).toEqual(['Example']);
});

it('notifies listeners added within the current change and preserves dispatch order', () => {
  const form = formWith();
  const events = [];
  form.onFormState = () => events.push('method');
  form.once('form:change', values => {
    events.push(values.answer);
    form.once('form:state', () => events.push('event'));
  });
  form.on('all', name => {
    if (name === 'form:state') {events.push('all');}
  });
  form.setValues({ answer: 'first' });
  form.setValues({ answer: 'second' });
  expect(events).toEqual(['first', 'method', 'event', 'all', 'method', 'all']);
});

it('rejects non-array fields and collisions with retained schema before replacing nodes', () => {
  const form = formWith({ schema: [{ $formkit: 'text', name: 'schemaField' }] });
  const answer = form.node.at('answer');
  expect(() => form.setFields(new Set([{ name: 'extra' }]))).toThrow(TypeError);
  expect(() => form.setFields([{ name: 'schemaField' }])).toThrow(/Unique sibling names/);
  expect(() => form.setFields([{ type: 'group', name: 'g', children: [{ name: 'same' }, { name: 'same' }] }])).toThrow(/Unique sibling names/);
  form.setFields([{ name: 'answer', label: 'Updated' }, { name: 'extra' }]);
  expect(form.node.at('answer')).toBe(answer);
  expect(form.node.at('extra')).toBeTruthy();
  expect(form.node.at('schemaField')).toBeTruthy();
});
