import { afterEach, describe, expect, it, vi } from 'vitest';
import { Region } from 'marionette';
import { FormView } from '@mnjs/formkit';
import { getNode, createMessage } from '@formkit/core';
import { createMultiStepPlugin } from '@formkit/addons';

const regions = [];
function mount(options) {
  const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
  const form = new FormView(options);
  regions.push(region);
  try { region.show(form); } catch (error) { form.destroy(); throw error; }
  return { form, region, element: form.el };
}
async function flush() { for (let index = 0; index < 8; index++) { await Promise.resolve(); } }
async function edit(input, value) {
  input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); await flush();
  const node = getNode(input.id);
  await node.settled;
  await node.ledger.settled('validating');
  await flush();
}
afterEach(() => { regions.splice(0).forEach(region => region.destroy()); document.body.replaceChildren(); });

describe('@mnjs/formkit official input integration', () => {
  it('renders official sections, retains typing focus, validates, submits and resets grouped values', async() => {
    const submit = vi.fn();
    const { form, element } = mount({ schema: [
      { $formkit: 'email', name: 'email', label: 'Email', help: 'Contact address', validation: 'required|email' },
      { $formkit: 'group', name: 'profile', children: [
        { $formkit: 'text', name: 'name', label: 'Name', value: 'Paul' },
        { $formkit: 'textarea', name: 'bio', label: 'Biography' }
      ] }
    ], submit });
    await flush();
    const email = element.querySelector('input[type=email]');
    expect(element.querySelector('label').htmlFor).toBe(email.id);
    expect(element.querySelector('.formkit-outer')).not.toBeNull();
    expect(await form.submit()).toBe('invalid');
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(email);
    expect(element.textContent).toContain('Email is required.');
    await edit(email, 'paul@example.com');
    email.focus();
    form.render();
    expect(element.querySelector('input[type=email]')).toBe(email);
    expect(document.activeElement).toBe(email);
    expect(await form.submit()).toBe('success');
    expect(submit.mock.calls[0][0]).toMatchObject({ email: 'paul@example.com', profile: { name: 'Paul' } });
    form.resetForm(); await flush();
    expect(email.value).toBe('');
    expect(email.getAttribute('aria-invalid')).toBeNull();
    expect(form.getFormState().submitted).toBe(false);
  });

  it('uses the official radio, checkbox-group and select value features', async() => {
    const { form, element } = mount({ schema: [
      { $formkit: 'radio', name: 'color', label: 'Color', options: { red: 'Red', blue: 'Blue' } },
      { $formkit: 'checkbox', name: 'tags', label: 'Tags', options: ['one', 'two'] },
      { $formkit: 'checkbox', name: 'notify', label: 'Notify', onValue: 'yes', offValue: 'no' },
      { $formkit: 'select', name: 'choice', label: 'Choices', multiple: true,
        options: [{ label: 'First', value: 1 }, { label: 'Second', value: 2 }] },
      { $formkit: 'number', number: true, name: 'count', label: 'Count' }
    ] });
    await flush();
    const radio = element.querySelector('input[type=radio]'); radio.checked = true; radio.dispatchEvent(new Event('input'));
    const check = element.querySelector('input[type=checkbox]'); check.checked = true; check.dispatchEvent(new Event('input'));
    const notify = element.querySelectorAll('input[type=checkbox]')[2]; notify.checked = true; notify.dispatchEvent(new Event('input'));
    const select = element.querySelector('select'); select.options[1].selected = true; select.dispatchEvent(new Event('input'));
    await edit(element.querySelector('input[type=number]'), '4.5'); await flush();
    expect(form.getValues()).toMatchObject({ color: 'red', tags: ['one'], notify: 'yes', choice: [2], count: 4.5 });
    form.setValues({ tags: ['two'], choice: [1] }, { notify: false }); await flush();
    expect(check.checked).toBe(false);
    expect(element.querySelectorAll('input[type=checkbox]')[1].checked).toBe(true);
    expect(select.options[0].selected).toBe(true);
  });

  it('observes deep context changes and official theme classes/icons without a framework runtime', async() => {
    const { element } = mount({ schema: [
      { $el: 'p', children: '$get("deep-native").state.extra.text' },
      { $formkit: 'text', id: 'deep-native', name: 'name', label: 'Name', prefixIcon: 'native' }],
    icons: { native: '<svg viewBox="0 0 10 10"><path d="M0 0L10 10" /></svg>' },
    config: { rootClasses: section => ({ [`custom-${section}`]: true }) } });
    await flush();
    const input = element.querySelector('input[type=text]');
    const node = getNode(input.id);
    expect(element.querySelector('.custom-prefixIcon svg')).not.toBeNull();
    node.context.state.extra = { text: 'Before' };
    await flush();
    expect(element.querySelector('p').textContent).toBe('Before');
    const current = node;
    current.context.state.extra.text = 'After';
    await flush();
    expect(element.querySelector('p').textContent).toBe('After');
    current.props.label = 'Updated name'; await flush();
    expect(element.textContent).toContain('Updated name');
    current.store.set(createMessage({ key: 'server', type: 'error', value: 'Check name' })); await flush();
    expect(element.textContent).toContain('Check name');
  });

  it('renders conditional inputs and cleans removed registry entries without destroying the form', async() => {
    const { form, element } = mount({ schemaData: { show: true }, schema: [
      { $formkit: 'text', if: '$show', key: 'optional', id: 'official-optional', name: 'optional', label: 'Optional' },
      { $formkit: 'text', key: 'stable', name: 'stable', label: 'Stable' }
    ] });
    const stable = element.querySelectorAll('input[type=text]')[1]; stable.focus();
    form.setSchemaData({ show: false }); await flush();
    expect(getNode('official-optional')).toBeUndefined();
    expect(element.querySelector('input[type=text]')).toBe(stable);
    expect(document.activeElement).toBe(stable);
    form.setSchemaData({ show: true }); await flush();
    expect(getNode('official-optional')).toBeDefined();
  });

  it('retains keyed synced list nodes through external reorder and removes descendants on deletion', async() => {
    const { form, element } = mount({ values: { rows: [{ name: 'Alpha' }, { name: 'Beta' }] }, schema: [
      { $formkit: 'list', name: 'rows', dynamic: true, children: [
        { $formkit: 'group', for: ['item', 'index', '$items'], key: '$item', index: '$index', children: [
          { $formkit: 'text', name: 'name', label: 'Row name' }
        ] }
      ] }
    ] });
    await flush();
    const [alpha, beta] = element.querySelectorAll('input[type=text]');
    expect(alpha.value).toBe('Alpha'); expect(beta.value).toBe('Beta');
    beta.focus(); beta.setSelectionRange(1, 2);
    form.setValues({ rows: [{ name: 'Beta' }, { name: 'Alpha' }] }, { notify: false }); await flush();
    expect([...element.querySelectorAll('input[type=text]')]).toEqual([beta, alpha]);
    expect(document.activeElement).toBe(beta);
    expect(beta.selectionStart).toBe(1);
    const id = alpha.id;
    form.setValues({ rows: [{ name: 'Beta' }] }); await flush();
    expect(getNode(id)).toBeUndefined();
    expect(alpha.isConnected).toBe(false);
  });

  it('uses the open-source multi-step plugin for step validation and navigation', async() => {
    const { form, element } = mount({ plugins: [createMultiStepPlugin({ allowIncomplete: false })], schema: [
      { $formkit: 'multi-step', name: 'wizard', id: 'official-wizard', children: [
        { $formkit: 'step', name: 'account', label: 'Account', children: [
          { $formkit: 'email', name: 'email', label: 'Wizard email', validation: 'required|email' }
        ] },
        { $formkit: 'step', name: 'details', label: 'Details', children: [
          { $formkit: 'text', name: 'name', label: 'Wizard name' }
        ] }
      ] }
    ] });
    await flush();
    const wizard = getNode('official-wizard');
    expect(wizard.children.length).toBe(2);
    expect(element.textContent).toContain('Account');
    wizard.next(); await flush();
    expect(wizard.props.activeStep).toBe('account');
    await edit(element.querySelector('input[type=email]'), 'paul@example.com');
    wizard.next(); await flush();
    expect(wizard.props.activeStep).toBe('details');
    expect(form.getValues()).toMatchObject({ wizard: { account: { email: 'paul@example.com' } } });
  });
});
