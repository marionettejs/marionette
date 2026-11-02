import { FormView } from '@mnjs/formkit';
import { getNode } from '@formkit/core';
import { initial, schema, plugins, submit, install, observations } from './shared.js';
document.querySelector('#mode').prepend('native: ');
if (observations.bootstrap === 'ready') {
  const form = new FormView({ el: document.querySelector('#form'), schema, schemaData: { localClasses: { input: 'local-first' } }, values: initial(), plugins, submit,
    config: { classes: { input: 'inherited' } } });
  form.render();
  install({ getValues: () => form.getValues(), setValues: values => form.setValues(values, { source: 'external' }),
    disable: value => { form.node.props.disabled = value; }, reset: () => form.resetForm(), destroy: () => form.destroy(),
    setErrors: (messages, fields) => form.setErrors(messages, fields), observe: callback => { form.on('form:change', callback); form.on('form:reset', callback); },
    classes: value => form.setSchemaData({ localClasses: value }), hasNode: id => !!getNode(id), form });
}
