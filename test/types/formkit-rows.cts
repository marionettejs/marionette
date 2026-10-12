import { CollectionView, View } from 'marionette';
import { FormView, FieldView, RowView, SchemaView, createViewComponents } from '@mnjs/formkit';
import type { RowOptions } from '@mnjs/formkit';

interface Contact { id: string; profile: { name: string } }
interface ContactValues { contacts: Contact[] }
class ContactRow extends RowView<ContactValues> {
  readonly form: FormView<ContactValues>;
  constructor(options: RowOptions<ContactValues>) {
    super({ ...options, template: () => '<div data-profile></div>', regions: { profile: '[data-profile]' } });
    this.form = options.form;
  }
  onRender() {
    const profile = new FieldView({ form: this.form, parent: this.node, name: 'profile', removal: 'preserve',
      input: { type: 'group', slots: { default: () => ({ $el: 'div', attrs: { 'data-schema': '' } }) } },
      regions: { schema: '[data-schema]' } });
    this.showChildView('profile', profile);
    const components = createViewComponents({ getForm: () => this.form, getOwner: () => this,
      registrations: {
        Name: { kind: 'field', create: options => new FieldView(options) },
        Guidance: { kind: 'view', create: () => new View({ template: () => '<p>Contact guidance</p>' }),
          update: (view, props) => { view.el.textContent = String(props.title); } }
      } });
    const schema: SchemaView<ContactValues> = new SchemaView({ form: this.form, parent: profile.node, components,
      schema: [
        { $cmp: 'Name', props: { name: 'name', input: { type: 'text', label: 'Name', validation: 'required' } } },
        { $cmp: 'Guidance', props: { title: '$title' } }
      ], schemaData: { title: 'Contact guidance' } });
    profile.showChildView('schema', schema);
  }
}
const form = new FormView<ContactValues>({ template: () => '',
  submit: values => values.contacts.map(contact => contact.profile.name).join(', ') });
const list = new FieldView({ form, name: 'contacts', removal: 'preserve',
  input: { type: 'list', dynamic: true, itemKey: 'id' } });
const options: RowOptions<ContactValues> = { form, parent: list.node, rowKey: 'a', removal: 'preserve' };
const inferred: RowView<ContactValues> = new RowView(options);
const rows = new CollectionView({ childView: ContactRow, childViewOptions: options });
void inferred;
void rows;
interface NestedValues { groups: { id: string; items: { id: string; name: string }[] }[] }
const nestedForm = new FormView<NestedValues>({ template: () => '', values: { groups: [] } });
const outerList = new FieldView({ form: nestedForm, name: 'groups', removal: 'preserve',
  input: { type: 'list', dynamic: true, itemKey: 'id' } });
const outerRow: RowView<NestedValues> = new RowView({ form: nestedForm, parent: outerList.node, rowKey: 'outer', removal: 'preserve' });
const innerList = new FieldView({ form: nestedForm, parent: outerRow.node, name: 'items', removal: 'preserve',
  input: { type: 'list', dynamic: true, itemKey: 'id' } });
const innerOptions: RowOptions<NestedValues> = { form: nestedForm, parent: innerList.node, rowKey: 'local', removal: 'preserve' };
const innerRow: RowView<NestedValues> = new RowView(innerOptions);
void innerRow;
const wrongForm = new FormView<{ other: string }>({ template: () => '' });
// @ts-expect-error A row's typed form must match its declared values shape.
new RowView<ContactValues>({ ...options, form: wrongForm });
