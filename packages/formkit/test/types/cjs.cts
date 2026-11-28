import formkit = require('@mnjs/formkit');
import components = require('@mnjs/formkit/components');
import type { MountedForm, FormKitApplicationInstance } from '@mnjs/formkit';
const mounted: MountedForm<{ title: string }> = formkit.mount<{ title: string }>({
  host: document.createElement('main'), fields: [{ name: 'title' }], values: { title: 'Title' }
});
const value: string = mounted.getValues().title;
// @ts-expect-error the value is a string
const invalid: number = mounted.getValues().title;
const application = new formkit.FormKitApplication({ form: { fields: [] } });
const instance: FormKitApplicationInstance = application;
const helpers = components.createFormKitHelpers();
void [value, invalid, instance, helpers];
mounted.destroy();
