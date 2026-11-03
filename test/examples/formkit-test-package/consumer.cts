import { FormView } from '@mnjs/formkit';
import { mountView } from '@mnjs/test';

const form = new FormView<{ email: string }>({
  fields: [{ type: 'email', name: 'email', label: 'Email' }],
  values: { email: 'ada@example.test' }
});
const mounted = mountView(form);
const email: string = mounted.view.getValues().email;
// @ts-expect-error The CommonJS declarations retain the value type too.
const incorrect: number = mounted.view.getValues().email;
void email;
void incorrect;
void mounted.cleanup();
