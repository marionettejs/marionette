import { afterEach, expect, it, vi } from 'vitest';
import { Region, View } from 'marionette';
import { FieldView, FormView, SubmissionError } from '@mnjs/formkit';
import { getNode } from '@formkit/core';

const owners = [];
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
function contact(removal = 'clear', extra = {}) {
  class Contact extends FormView {
    onRender() {
      this.showChildView('name', new FieldView({ form: this, name: 'name', removal: 'preserve', input: { type: 'text', label: 'Name' } }));
      this.showChildView('email', new FieldView({ form: this, name: 'email', removal: 'preserve',
        input: { type: 'email', label: 'Email', help: 'Work address', validation: 'required|email' } }));
      this.showChildView('invoice', new FieldView({ form: this, name: 'invoice', removal: 'preserve',
        input: { type: 'checkbox', label: 'Invoice' } }));
      this.updateCompany(this.getValues().invoice);
    }
    onFormChange(values) { if (this.isRendered()) {this.updateCompany(values.invoice);} }
    updateCompany(enabled) {
      const region = this.getRegion('company');
      if (enabled && !region.hasView()) {
        region.show(new FieldView({ form: this, name: 'company', removal,
          input: { type: 'text', label: 'Company', value: 'Baseline', validation: 'required' } }));
      } else if (!enabled && region.hasView()) {region.empty();}
    }
  }
  const view = new Contact({ template: () => '<fieldset><legend>Contact</legend><div class="name"></div><div class="email"></div><div class="invoice"></div><div class="company"></div></fieldset><button type="submit">Save</button><button type="reset">Reset</button>',
    regions: { name: '.name', email: '.email', invoice: '.invoice', company: '.company' },
    values: { name: 'Paul', email: '', invoice: false }, ...extra });
  const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
  owners.push(region);
  region.show(view);
  return view;
}
function edit(view, name, value) {
  const input = view.el.elements.namedItem(name);
  if (input.type === 'checkbox') {input.checked = value;} else {input.value = value;}
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return input;
}
afterEach(() => { owners.splice(0).forEach(owner => owner.destroy()); document.body.replaceChildren(); });

it('composes official fields in ordinary Regions and preserves sibling focus through clear conditions', async() => {
  const view = contact();
  edit(view, 'email', 'paul@example.com');
  const name = view.el.elements.namedItem('name');
  name.focus(); name.setSelectionRange(1, 3);
  edit(view, 'invoice', true); await tick();
  expect(view.getValues()).toEqual({ name: 'Paul', email: 'paul@example.com', invoice: true, company: 'Baseline' });
  edit(view, 'company', 'Draft'); await tick();
  edit(view, 'invoice', false); await tick();
  expect(view.getValues()).toEqual({ name: 'Paul', email: 'paul@example.com', invoice: false });
  expect(view.el.elements.namedItem('company')).toBeNull();
  expect(document.activeElement).toBe(name);
  expect(name.selectionStart).toBe(1);
  view.setValues({ company: 'Stale actor value' }, { notify: false });
  expect(view.getValues()).not.toHaveProperty('company');
  edit(view, 'invoice', true); await tick();
  expect(view.getValues().company).toBe('Baseline');
  view.resetForm(); await tick();
  expect(view.getValues()).toEqual({ name: 'Paul', email: '', invoice: false });
});

it('preserves an absent draft but resets it to its original baseline', async() => {
  const view = contact('preserve');
  edit(view, 'invoice', true); await tick();
  edit(view, 'company', 'Draft'); await tick();
  edit(view, 'invoice', false); await tick();
  expect(view.getValues().company).toBe('Draft');
  expect(view.node.at('company')).toBeUndefined();
  view.resetForm(); await tick();
  expect(view.getValues().company).toBe('Baseline');
  edit(view, 'invoice', true); await tick();
  expect(view.el.elements.namedItem('company').value).toBe('Baseline');
});

it('validates composed fields and submits one settled snapshot with server errors and reset cancellation', async() => {
  let finish;
  let signal;
  const submit = vi.fn().mockRejectedValueOnce(new SubmissionError('Rejected', { email: ['Address unavailable'] }))
    .mockImplementationOnce((_values, context) => { signal = context.signal; return new Promise(resolve => { finish = resolve; }); });
  const view = contact('clear', { submit });
  expect(await view.submit()).toBe('invalid');
  const email = edit(view, 'email', 'paul@example.com');
  expect(await view.submit()).toBe('error');
  expect(email.getAttribute('aria-invalid')).toBe('true');
  expect(view.getFormState().errors).toEqual(['Rejected']);
  edit(view, 'email', 'new@example.com'); await tick();
  const saved = vi.fn(); view.on('submit:success', saved);
  const pending = view.submit(); await tick();
  expect(email.disabled).toBe(true);
  expect(view.el.querySelector('button').disabled).toBe(true);
  view.resetForm(); finish('late');
  expect(await pending).toBe('cancelled'); await tick();
  expect(signal.aborted).toBe(true);
  expect(saved).not.toHaveBeenCalled();
  expect(view.getFormState().errors).toEqual([]);
});

it('keeps detached fields active and terminates their runtime when the form owner dies', async() => {
  const view = contact();
  const field = view.getRegion('email').detachView();
  const input = field.el.querySelector('input');
  const node = field.node;
  expect(await view.submit()).toBe('invalid');
  view.getRegion('email').show(field);
  expect(field.el.querySelector('input')).toBe(input);
  const detached = view.getRegion('email').detachView();
  view.destroy();
  expect(getNode(node.props.id)).toBeUndefined();
  const changes = vi.fn(); view.on('form:change', changes);
  input.value = 'late@example.com'; input.dispatchEvent(new Event('input'));
  expect(changes).not.toHaveBeenCalled();
  expect(detached.isDestroyed()).toBe(true);
  expect(() => new Region({ el: document.createElement('div') }).show(detached)).toThrow(/destroyed/i);
  detached.destroy();
});


it('shares validation, submission, reset and cleanup between a schema slot and an ordinary section View', async() => {
  class NotesSection extends View {
    onRender() {
      this.showChildView('notes', new FieldView({ form: this.options.form, parent: this.options.parent,
        name: 'notes', removal: 'preserve', input: { type: 'textarea', id: 'section-notes', label: 'Notes', validation: 'required' } }));
    }
  }
  class Contact extends FormView {
    onRender() {
      const group = new FieldView({ form: this, name: 'contact', removal: 'preserve',
        input: { type: 'group', slots: { default: () => [
          { $formkit: 'email', id: 'section-email', name: 'email', label: 'Email', validation: 'required|email' }
        ] } } });
      this.showChildView('contact', group);
      this.showChildView('section', new NotesSection({ form: this, parent: group.node,
        template: () => '<fieldset><legend>Notes</legend><div data-notes></div></fieldset>', regions: { notes: '[data-notes]' } }));
    }
  }
  const submitted = [];
  const view = new Contact({ template: () => '<div data-contact></div><div data-section></div><button type="submit">Save</button>',
    regions: { contact: '[data-contact]', section: '[data-section]' }, values: { contact: { email: '', notes: '' } },
    submit: values => submitted.push(values) });
  const owner = new Region({ el: document.body.appendChild(document.createElement('div')) }); owners.push(owner); owner.show(view);
  await tick();
  expect(document.querySelectorAll('form').length).toBe(1);
  expect(view.el.querySelector('legend').textContent).toBe('Notes');
  expect(await view.submit()).toBe('invalid'); expect(submitted).toEqual([]);
  const email = view.el.querySelector('#section-email'); const notes = view.el.querySelector('#section-notes');
  email.value = 'invalid'; email.dispatchEvent(new Event('input', { bubbles: true }));
  notes.value = 'Follow up'; notes.dispatchEvent(new Event('input', { bubbles: true }));
  await getNode(email.id).settled; await getNode(notes.id).settled;
  expect(await view.submit()).toBe('invalid'); expect(submitted).toEqual([]);
  email.value = 'paul@example.com'; email.dispatchEvent(new Event('input', { bubbles: true }));
  await getNode(email.id).settled;
  expect(await view.submit()).toBe('success');
  expect(submitted).toEqual([{ contact: { email: 'paul@example.com', notes: 'Follow up' } }]);
  view.resetForm(); await tick();
  expect(view.getValues()).toEqual({ contact: { email: '', notes: '' } });
  expect(email.value).toBe(''); expect(notes.value).toBe('');
  expect(await view.submit()).toBe('invalid'); expect(submitted.length).toBe(1);
  owner.destroy();
  expect(getNode(email.id)).toBeUndefined(); expect(getNode(notes.id)).toBeUndefined();
  expect(email.isConnected).toBe(false); expect(notes.isConnected).toBe(false);
});
