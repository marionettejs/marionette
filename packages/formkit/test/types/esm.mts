import { FormKitView, FormKitApplication, mount, bindings, defaultConfig } from '@mnjs/formkit';
import type { ComponentLibrary, FieldSpec, FormKitViewInstance, MountOptions, FormState } from '@mnjs/formkit';
import { FormKitMessages, createFormKitHelpers } from '@mnjs/formkit/components';
interface Signup { email: string; subscribed: boolean }
const fields: FieldSpec[] = [{ name: 'email', type: 'email', validation: 'required|email' }, { name: 'subscribed', type: 'checkbox' }];
const options: MountOptions<Signup> = { host: document.createElement('main'), fields, values: { email: 'a@example.test', subscribed: false } };
const mounted = mount<Signup>(options);
const email: string = mounted.getValues().email;
const state: FormState = mounted.getFormState();
mounted.setValues({ subscribed: true }, { source: 'programmatic', notify: false });
// @ts-expect-error typed values reject the wrong primitive
mounted.setValues({ email: 42 });
// @ts-expect-error host is required for the Region-owning mount API
mount({ fields });
const mixed = mount({ host: document.createElement('main'), fields, schema: { $formkit: 'text', name: 'schemaField' }, formProps: { id: 'typed-mixed-form' } });
mixed.destroy();
const components: ComponentLibrary = {
  Badge({ host, props }) { host.textContent = String(props.text); return { update(next) { host.textContent = String(next.text); } }; }
};
const helpers: ComponentLibrary = createFormKitHelpers();
const messages = FormKitMessages({ host: document.createElement('span'), props: { node: mounted.node } });
messages.destroy?.();
const configured = defaultConfig({ plugins: [bindings], config: { locale: 'en' }, messages: { en: { validation: { required: 'Required here' } } } });
const customMessage: FieldSpec = { name: 'custom', validationMessages: { required: ({ name }) => `${name} is required` } };
mounted.setErrors('Root error', { email: 'Email error' });
void customMessage;
const view = new FormKitView({ fields, components });
const typedView = new FormKitView<Signup>({ fields, values: { email: 'typed', subscribed: true } });
const directEmail: string = typedView.getValues().email;
void directEmail;
const Extended = FormKitView.extend({ label: 'Editor', onFormState(next: FormState) { this.el.setAttribute('data-valid', String(next.valid)); } });
const extended = new Extended({ fields });
extended.setValues({ email: 'next' });
const application = new FormKitApplication({ form: { fields }, config: configured });
application.getFormOptions({ fields });
const scope = application.getFormKitScope();
const current: FormKitViewInstance | undefined = application.getView();
void [email, state, helpers, view, current, scope];
mounted.destroy();
