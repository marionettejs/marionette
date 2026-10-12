import { Region } from 'marionette';
import { FieldView, FormView, SubmissionError, createSchemaRenderer } from '@mnjs/formkit';
import type { FormState, SubmitResult } from '@mnjs/formkit';
interface Profile { email: string; preferences: { newsletter: boolean } }
const view = new FormView<Profile>({
  fields: [
    { name: 'email', type: 'email', label: 'Email', validation: 'required|email' },
    { name: 'preferences', type: 'group', label: 'Preferences', children: [
      { name: 'newsletter', type: 'checkbox', label: 'Newsletter' }
    ] }
  ],
  values: { email: 'paul@example.com' },
  async submit(values, { signal, node }) {
    const email: string = values.email;
    const subscribed: boolean = values.preferences.newsletter;
    signal.throwIfAborted();
    node.setErrors([]);
    if (subscribed) { throw new SubmissionError(email, { email: ['Rejected'] }); }
  }
});
const state: FormState = view.getState();
const submitted: Promise<SubmitResult> = view.submit();
const email: string = view.getValues().email;
new Region({ el: document.body }).show(view);
class CustomForm extends FormView<Profile> {
  onFormChange(values: Profile, formState: FormState) { console.log(values.email, formState.valid); }
}
const custom = new CustomForm({ fields: [] });
custom.resetForm().render().destroy();
const schema = createSchemaRenderer(document.body, { schema: [{ $el: 'input', attrs: { value: '$value' } }] });
schema.update({ value: email });
schema.destroy();
// @ts-expect-error framework-specific or unsupported control types need another renderer
new FormView({ fields: [{ name: 'tags', type: 'taglist', label: 'Tags' }] });
// @ts-expect-error typed values are checked at the submission boundary
const invalid: number = view.getValues().email;
void [state, submitted, invalid];

const advanced = new FormView<Profile>({
  schema: [
    { $formkit: 'email', name: 'email', label: 'Email' },
    { $formkit: 'group', name: 'preferences', children: [
      { $formkit: 'checkbox', name: 'newsletter', label: 'Newsletter' }
    ] }
  ],
  schemaData: { heading: 'Profile' }, icons: { check: '<svg />' },
  sectionsSchema: { input: { attrs: { 'data-owner': 'profile' } } },
  slots: { help: scope => ({ $el: 'p', children: String(scope.label) }) },
  inputs: { output: { type: 'input', component: 'Output' } },
  components: { Output: ({ document: doc }) => {
    const element = doc.createElement('output');
    return { element, update(props, data, children) { void [props, data, children]; }, destroy() {} };
  } },
  iconLoader: async name => name === 'check' ? '<svg />' : undefined,
  formProps: { submitBehavior: 'live' }
});
advanced.setSchemaData({ heading: 'Updated' }).setSchema([]);
schema.setSchema([{ $el: 'strong', children: '$heading' }]);

const composed = new FormView<Profile>({
  template: () => '<div class="email"></div>', regions: { email: '.email' },
  values: { email: 'paul@example.com' }
});
const field = new FieldView({ form: composed, name: 'email', removal: 'preserve',
  input: { type: 'email', label: 'Email', validation: 'required|email' } });
field.setInput({ label: 'Work email', attrs: { autocomplete: 'email' } });
field.render().setValue('next@example.com', { notify: false, source: 'actor' });
const node = field.node;
const value: unknown = field.getValue();
// @ts-expect-error structural changes require a new owned field
field.setInput({ type: 'text' });
// @ts-expect-error values use setValue, not input prop patches
field.setInput({ value: 'bad' });
// @ts-expect-error ignore changes node ownership and requires a replacement
field.setInput({ ignore: true });
// @ts-expect-error removal policy is explicit
new FieldView({ form: composed, name: 'email', input: { type: 'email' } });
// @ts-expect-error authoring modes are mutually exclusive
new FormView({ fields: [], template: () => '' });
void [node, value];

// @ts-expect-error conditional registration is not part of the package API
composed.showField('email', () => field);
// @ts-expect-error conditional registration options are not exported
type RetiredConditionalOptions = import('@mnjs/formkit').ConditionalFieldOptions<Profile>;
