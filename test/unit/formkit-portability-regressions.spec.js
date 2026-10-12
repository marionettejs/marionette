import { afterEach, expect, it } from 'vitest';
import { Region, View } from 'marionette';
import { FormView, FieldView, RowView, SchemaView, createSchemaRenderer, createViewComponents } from '@mnjs/formkit';

const owned = [];
const flush = async() => { for (let count = 0; count < 20; count++) { await Promise.resolve(); } };
function render(schema, data) {
  const container = document.body.appendChild(document.createElement('div'));
  const renderer = createSchemaRenderer(container, { schema, data });
  owned.push(renderer);
  return container;
}
function mount(options) {
  const host = document.body.appendChild(document.createElement('div'));
  const region = new Region({ el: host });
  owned.push(region);
  const form = new FormView(options);
  owned.push(form);
  region.show(form);
  return form;
}
afterEach(() => { owned.splice(0).reverse().forEach(item => item.destroy()); document.body.replaceChildren(); });

it('binds inherited caller methods to the actual instance and preserves lexical function ownership', () => {
  class Base { format(value) { return this.prefix + value; } }
  class Formatter extends Base { prefix = 'Actual '; }
  expect(render('$formatter.format("instance")', { formatter: new Formatter() }).textContent).toBe('Actual instance');
  const data = { prefix: 'Root', items: ['Loop'], describe() { return this.prefix; } };
  expect(render({ $el: 'p', for: ['prefix', '$items'], children: '$describe()' }, data).textContent).toBe('Root');
  expect(render('$format("top")', Object.assign(new Formatter(), { format: Base.prototype.format })).textContent).toBe('Actual top');
});

it('normalizes native inputErrors string shorthand', async() => {
  const form = mount({ values: { title: 'Title' }, formProps: { inputErrors: { title: 'Taken' } },
    schema: { $formkit: 'text', name: 'title', label: 'Title' } });
  await flush();
  expect(form.el.textContent).toContain('Taken');
  form.node.props.inputErrors = { title: ['Unavailable'] };
  await flush();
  expect(form.el.textContent).toContain('Unavailable');
  expect(form.el.textContent).not.toContain('Taken');
});

it('updates or clears only the inputErrors owner messages', async() => {
  const form = mount({ values: { profile: { name: 'Name', phone: 'Phone' } }, formProps: { inputErrors: { 'profile.name': ['Root name'] } },
    schema: { $formkit: 'group', name: 'profile', children: [
      { $formkit: 'text', name: 'name', label: 'Name' }, { $formkit: 'text', name: 'phone', label: 'Phone' }
    ] } });
  await flush();
  expect(form.el.textContent).toContain('Root name');
  const group = form.node.at('profile');
  group.props.inputErrors = { '$self.phone': ['Group phone'] };
  await flush();
  expect(form.el.textContent).toContain('Root name');
  expect(form.el.textContent).toContain('Group phone');
  group.props.inputErrors = {};
  await flush();
  expect(form.el.textContent).toContain('Root name');
  expect(form.el.textContent).not.toContain('Group phone');
  form.node.props.inputErrors = {};
  await flush();
  expect(form.el.textContent).not.toContain('Root name');
});

it('retires errors buffered for absent conditional targets before they mount', async() => {
  const form = mount({ schemaData: { visible: false }, formProps: { inputErrors: { title: ['Withdrawn'] } },
    schema: { $formkit: 'text', name: 'title', if: '$visible', label: 'Title' } });
  form.node.props.inputErrors = {};
  form.setSchemaData({ visible: true });
  await flush();
  expect(form.el.querySelector('input')).not.toBeNull();
  expect(form.el.textContent).not.toContain('Withdrawn');
  form.node.props.inputErrors = { title: 'Current' };
  await flush();
  expect(form.el.textContent).toContain('Current');
});

it('passes callbacks resolved from plain JSON expressions to actual named Views', async() => {
  let form;
  const calls = [];
  const components = createViewComponents({ getForm: () => form, registrations: { Choice: {
    kind: 'view',
    create({ props }) {
      let choose = props.onChoose;
      const view = new View({ template: () => '<button type="button" data-choice>Choose</button>', events: {
        'click button': () => choose('selected')
      } });
      view.replaceChoice = callback => { choose = callback; };
      return view;
    },
    update(view, props) { view.replaceChoice(props.onChoose); }
  } } });
  form = new FormView({ components, schemaData: { choose: value => calls.push(value) },
    schema: JSON.parse('{"$cmp":"Choice","props":{"onChoose":"$choose"}}') });
  owned.push(form);
  const host = document.body.appendChild(document.createElement('div'));
  const region = new Region({ el: host });
  owned.push(region);
  region.show(form);
  await flush();
  const button = form.el.querySelector('[data-choice]');
  button.click();
  expect(calls).toEqual(['selected']);
  button.focus();
  form.setSchemaData({ choose: value => calls.push(`next ${value}`) });
  await flush();
  expect(form.el.querySelector('[data-choice]')).toBe(button);
  expect(document.activeElement).toBe(button);
  button.click();
  expect(calls).toEqual(['selected', 'next selected']);
  form.destroy();
  button.click();
  expect(calls).toEqual(['selected', 'next selected']);
});

it('updates named FieldView callback and opaque file values by identity', async() => {
  let form;
  const files = [new File(['a'], 'same.txt', { lastModified: 1 }), new File(['b'], 'same.txt', { lastModified: 2 })];
  const calls = [];
  const components = createViewComponents({ getForm: () => form, registrations: { Upload: {
    kind: 'field', create: options => new FieldView(options)
  } } });
  form = new FormView({ components, schemaData: { input: { type: 'file', value: [{ name: 'same.txt', file: files[0] }], attrs: { onBlur: () => calls.push('first') } } },
    schema: { $cmp: 'Upload', props: { name: 'upload', input: '$input' } } });
  owned.push(form);
  form.render();
  await flush();
  const input = form.el.querySelector('input');
  input.dispatchEvent(new Event('blur'));
  expect(calls).toEqual(['first']);
  form.setSchemaData({ input: { type: 'file', value: [{ name: 'same.txt', file: files[1] }], attrs: { onBlur: () => calls.push('second') } } });
  await flush();
  expect(form.node.at('upload').value[0].file).toBe(files[1]);
  expect(form.el.querySelector('input')).toBe(input);
  input.dispatchEvent(new Event('blur'));
  expect(calls).toEqual(['first', 'second']);
});

it('falls back through internal lexical scopes for undefined full paths but retains null', () => {
  const data = { value: { text: 'Root' }, items: [{ text: undefined }, { text: null }, null] };
  expect(render({ $el: 'p', for: ['value', '$items'], children: '$value.text' }, data).textContent).toBe('RootnullRoot');
  expect(render({ $el: 'p', for: ['value', '$items'], children: '$value' }, { value: 'Root', items: [undefined, null] }).textContent).toBe('Rootnull');
});

it('retains native decimal text while committing a numeric value and applies later programmatic updates', async() => {
  const form = mount({ values: { amount: 0 }, schema: { $formkit: 'number', number: true, name: 'amount', label: 'Amount' } });
  const input = form.el.querySelector('input');
  input.focus();
  input.value = '1.0';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await form.node.at('amount').settled;
  await form.node.settled;
  await flush();
  expect(form.getValues()).toEqual({ amount: 1 });
  expect(input.value).toBe('1.0');
  expect(document.activeElement).toBe(input);
  form.setValues({ amount: 2 });
  await form.node.settled;
  await flush();
  expect(input.value).toBe('2');
});

it('replaces pending native decimal text with an authoritative programmatic value', async() => {
  const form = mount({ values: { amount: 0 }, schema: { $formkit: 'number', number: true, name: 'amount', delay: 1000 } });
  const input = form.el.querySelector('input');
  input.focus();
  input.value = '1.20';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(form.node.at('amount').isSettled).toBe(false);
  form.setValues({ amount: 9 }, { notify: false });
  await flush();
  expect(form.getValues()).toEqual({ amount: 9 });
  expect(input.value).toBe('9');
});

it('keeps explicitly bound root values separate from borrowed row node values', async() => {
  const form = mount({ values: { invoice: false, rows: [{ id: 'a', invoice: true }] },
    template: () => '<div data-list></div><div data-row></div>', regions: { list: '[data-list]', row: '[data-row]' } });
  const list = new FieldView({ form, name: 'rows', input: { type: 'list', dynamic: true, itemKey: 'id' } });
  form.showChildView('list', list);
  const row = new RowView({ form, parent: list.node, rowKey: 'a', removal: 'preserve', template: () => '<div data-schema></div>', regions: { schema: '[data-schema]' } });
  form.showChildView('row', row);
  const section = new SchemaView({ form, parent: row.node, schemaData: { get values() { return form.node.value; } },
    schema: [
      { $el: 'output', attrs: { 'data-root': true }, children: '$values.invoice' },
      { $el: 'output', attrs: { 'data-local': true }, children: '$node.value.invoice' },
      { $formkit: 'text', name: 'company', label: 'Company', if: '$values.invoice' }
    ] });
  row.showChildView('schema', section);
  await flush();
  expect(section.el.querySelector('[data-root]').textContent).toBe('false');
  expect(section.el.querySelector('[data-local]').textContent).toBe('true');
  expect(section.el.querySelector('input')).toBeNull();
  form.setValues({ invoice: true });
  await flush();
  expect(section.el.querySelector('[data-root]').textContent).toBe('true');
  expect(section.el.querySelector('input')).not.toBeNull();
  expect(section.node).toBe(row.node);
  expect(section.node.root).toBe(form.node);
});

it('lets direct FieldView slots explicitly replace scope with a live root binding', async() => {
  const form = mount({ values: { invoice: false, title: 'Title' },
    template: () => '<div data-field></div>', regions: { field: '[data-field]' } });
  const field = new FieldView({ form, name: 'title', input: { type: 'text', label: 'Title', slots: {
    help: scope => ({ schema: { $el: 'output', children: '$values.invoice' }, data: { ...scope, values: form.node.value } })
  } } });
  form.showChildView('field', field);
  await flush();
  expect(field.el.querySelector('output').textContent).toBe('false');
  form.setValues({ invoice: true });
  await flush();
  expect(field.el.querySelector('output').textContent).toBe('true');
  expect(field.node.value).toBe('Title');
});

it('prefers explicit caller data at the root application boundary while native child slots stay local', async() => {
  class Data {
    get items() { return ['Loop']; }
    prefix = 'Root';
    get value() { return 'Application'; }
    node = { value: 'Invented' };
    describe() { return this.prefix; }
  }
  const form = mount({ values: { title: 'Native' }, schemaData: new Data(), schema: [
    { $el: 'output', for: ['prefix', '$items'], attrs: { 'data-application': true }, children: '$describe()' },
    { $el: 'output', attrs: { 'data-reserved': true }, children: '$node.value.title' },
    { $formkit: 'text', name: 'title', children: { help: { $el: 'output', attrs: { 'data-native': true }, children: '$value' } } }
  ] });
  await flush();
  expect([...form.el.querySelectorAll('[data-application]')].map(output => output.textContent)).toEqual(['Root']);
  expect(form.el.querySelector('[data-reserved]').textContent).toBe('Native');
  expect(form.el.querySelector('[data-native]').textContent).toBe('Native');
  form.setSchemaData({ items: undefined });
  await flush();
  expect(form.el.querySelector('[data-application]')).toBeNull();
});

it('stringifies evaluated null and undefined text without changing native value attributes', () => {
  expect(render(['$nothing', '$missing', '$false', '$zero'], { nothing: null, false: false, zero: 0 }).textContent).toBe('nullundefinedfalse0');
  const container = render({ $el: 'input', attrs: { value: '$nothing', title: '$nothing' } }, { nothing: null });
  expect(container.querySelector('input').value).toBe('');
  expect(container.querySelector('input').hasAttribute('title')).toBe(false);
});

it('preserves inherited caller methods and getters in a borrowed SchemaView', async() => {
  const form = mount({ values: { title: 'Root' }, template: () => '<div data-schema></div>', regions: { schema: '[data-schema]' } });
  class Data {
    #prefix = 'Caller ';
    describe() { return this.#prefix; }
    get values() { return form.node.value; }
  }
  const view = new SchemaView({ form, schemaData: new Data(), schema: { $el: 'output', children: '$describe() + $values.title' } });
  form.showChildView('schema', view);
  await flush();
  expect(view.el.textContent).toBe('Caller Root');
  form.setValues({ title: 'Updated' });
  await flush();
  expect(view.el.textContent).toBe('Caller Updated');
  view.setSchemaData({
    prefix: 'Own ', node: { value: { title: 'Actor' } },
    describe() { return this.prefix + this.node.value.title; },
    get values() { return form.node.value; }
  });
  view.setSchema([
    { $el: 'output', children: '$describe()' },
    { $el: 'output', children: '$node.value.title' }
  ]);
  await flush();
  expect(view.el.textContent).toBe('Own ActorUpdated');
});
