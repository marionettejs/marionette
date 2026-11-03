import { Region, View } from 'marionette';
import { FieldView, FormView, SchemaView, createSchemaRenderer, createViewComponents } from '@mnjs/formkit';

export function mountIconPointer() {
  const container = document.body.appendChild(document.createElement('div'));
  const state = { clicks: 0, blurs: 0,
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><path d="M0 0h40v40H0z" /></svg>',
    click() { state.clicks++; },
    blur() { state.blurs++; queueMicrotask(() => renderer.update(state)); } };
  const renderer = createSchemaRenderer(container, { allowHTML: true, data: state, schema: [
    { $el: 'input', attrs: { id: 'icon-input', onBlur: '$blur' } },
    { $el: 'div', attrs: { id: 'icon-open', role: 'button', tabindex: '0', onClick: '$click',
      style: { width: '40px', height: '40px' } }, children: { $el: 'span', attrs: { innerHTML: '$icon' } } }
  ] });
  return { state, destroy() { renderer.destroy(); container.remove(); } };
}

export function mountRegisteredControls() {
  let form;
  const mounted = [];
  const saved = [];
  class Section extends View {
    onRender() {
      this.showChildView('field', new FieldView({ form, name: 'second', removal: 'preserve',
        input: { type: 'text', id: 'registered-second', label: 'Registered second', help: 'Second help', validation: 'required' } }));
    }
  }
  const components = createViewComponents({ getForm: () => form, registrations: {
    RegisteredField: { kind: 'field', create: options => new FieldView(options).render() },
    RegisteredSection: { kind: 'view', create: () => new Section({ template: () => '<div class="field"></div>', regions: { field: '.field' } }) }
  } });
  form = new FormView({ components, schema: [
    { $cmp: 'RegisteredField', props: { name: 'first', input: { type: 'text', id: 'registered-first', label: 'Registered first', help: 'First help', validation: 'required' } } },
    { $cmp: 'RegisteredSection' }
  ], submit: values => saved.push(values), plugins: [node => node.on('mounted', () => {
    if (node.props.id?.startsWith('registered-')) {
      const element = document.getElementById(node.props.id);
      mounted.push({ id: node.props.id, found: !!element, connected: !!element?.isConnected });
    }
  })] });
  const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
  region.show(form);
  return { form, mounted, saved, destroy() { region.destroy(); } };
}

export function mountInvalidFocus() {
  const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
  const external = new Region({ el: document.body.appendChild(document.createElement('div')) });
  const form = new FormView({ schema: [{ $el: 'div', attrs: { id: 'unfocusable-host', hidden: true }, children: [
    { $formkit: 'text', name: 'hidden', id: 'unfocusable-input', label: 'Hidden required', validation: 'required' }
  ] }] });
  region.show(form);
  const field = new FieldView({ form, name: 'visible', removal: 'preserve',
    input: { type: 'text', label: 'Visible required', id: 'visible-required', help: 'Visible help', validation: 'required' } });
  external.show(field);
  return { form, field, destroy() { region.destroy(); external.destroy(); } };
}

export async function mountExternalFields() {
  const owners = [];
  const show = view => {
    const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
    owners.push(region); region.show(view);
  };
  const state = { saved: true }; const origins = [];
  const form = new FormView({ template: () => '', state, stateEvents: {}, config: { delay: 0 },
    values: { name: 'Initial', choice: 'Initial', enabled: false, date: '2026-10-13' } });
  show(form);
  const field = new FieldView({ form, name: 'name', removal: 'preserve', input: { type: 'text', label: 'External name' } });
  show(field);
  const section = new SchemaView({ form, schema: [
    { $formkit: 'select', name: 'choice', label: 'External choice', options: ['Initial', 'Edited'] },
    { $formkit: 'checkbox', name: 'enabled', label: 'External enabled' },
    { $formkit: 'date', name: 'date', label: 'External date' },
    { $formkit: 'file', name: 'upload', label: 'External upload' }
  ] });
  show(section);
  await form.node.settled;
  await Promise.resolve();
  form.on('form:change', (_values, _status, metadata) => origins.push(metadata.source));
  return { form, field, section, state, origins, destroy() { owners.forEach(owner => owner.destroy()); } };
}
export function mount() {
  const values = [];
  const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
  const form = new FormView({ fields: [{ name: 'name', type: 'text', label: 'Name', value: 'Initial' }], submit: async() => {} });
  form.on('form:change', value => values.push(value));
  region.show(form);
  const schemaContainer = document.body.appendChild(document.createElement('div'));
  const items = [{ id: 'a', value: 'Alpha' }, { id: 'b', value: 'Beta' }];
  const schema = createSchemaRenderer(schemaContainer, { schema: [{ $el: 'input', for: ['item', '$items'],
    key: '$item.id', attrs: { value: '$item.value', 'aria-label': '$item.id' } }], data: { items } });
  return { region, form, values, schema, items, schemaContainer };
}

export function mountDecimals() {
  const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
  const changes = [];
  const form = new FormView({ values: { amount: 0, pending: 0 }, schema: [
    { $formkit: 'number', number: true, name: 'amount', label: 'Decimal amount' },
    { $formkit: 'number', number: true, name: 'pending', label: 'Pending decimal', delay: 1000 }
  ] });
  form.on('form:change', value => changes.push(value));
  region.show(form);
  return { region, form, changes };
}

export function mountReviewCases() {
  const element = document.createElement('form');
  element.innerHTML = '<p>Loading</p>';
  const target = document.body.appendChild(document.createElement('div'));
  const region = new Region({ el: target });
  const schema = [
    { $formkit: 'text', key: 'first', name: 'first', label: 'First', value: 'Alpha',
      help: 'Your name', validation: 'required' },
    { $formkit: 'text', key: 'second', name: 'second', label: 'Second', value: 'Beta' }
  ];
  let submissions = 0;
  const createForm = () => new FormView({ el: element, schema, submit() { submissions++; } });
  let form = createForm();
  region.show(form);
  const container = document.body.appendChild(document.createElement('div'));
  const select = createSchemaRenderer(container, { schema: { $el: 'select',
    attrs: { value: 'b', 'aria-label': 'Initial choice' }, children: [
      { $el: 'option', attrs: { value: 'a' }, children: 'Alpha' },
      { $el: 'option', attrs: { value: 'b' }, children: 'Beta' }
    ] } });
  return {
    get form() { return form; },
    get submissions() { return submissions; },
    reorder() { form.setSchema([...schema].reverse()); },
    reuse() { region.empty(); form = createForm(); region.show(form); },
    destroy() { region.destroy(); select.destroy(); container.remove(); target.remove(); }
  };
}

export function mountOwnedFields() {
  const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
  const fields = [];
  const values = [];
  const form = new FormView({ template: () => '<div class="keep"></div><div class="company"></div><button type="submit">Save conditional</button>',
    regions: { keep: '.keep', company: '.company' }, values: { invoice: false, keep: 'Sibling' }, submit: () => 'saved' });
  region.show(form);
  form.showChildView('keep', new FieldView({ form, name: 'keep', removal: 'preserve', input: { type: 'text', label: 'Keep' } }));
  form.on('form:change', snapshot => values.push(snapshot));
  function showCompany() {
    const field = new FieldView({ form, name: 'company', removal: 'clear', input: { type: 'text', label: 'Conditional company', validation: 'required' } });
    fields.push(field);
    form.showChildView('company', field);
  }
  function project(snapshot) {
    const company = form.getRegion('company');
    if (snapshot.invoice && !company.hasView()) { showCompany(); } else if (!snapshot.invoice && company.hasView()) { company.empty(); }
    form.setValues(snapshot, { notify: false });
  }
  return { form, fields, values, project, reset() {
    form.getRegion('company').empty(); form.resetForm();
  }, destroy() { region.destroy(); } };
}
