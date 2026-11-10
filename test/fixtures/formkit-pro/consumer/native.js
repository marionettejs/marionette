// Evaluate the bridge before shared.js imports Pro and caches the timer API.
import './lifecycle-session.js';
import { FormView } from '@mnjs/formkit';
import { getNode } from '@formkit/core';
import { initial, schema, plugins, submit, install, observations } from './shared.js';
import { runLifecycle } from './lifecycle-01307.js';
document.querySelector('#mode').prepend('native: ');
const lifecycle = observations.mode === 'pro' && new URLSearchParams(location.search).get('scenario') === 'lifecycle-01307';
if (observations.bootstrap === 'ready' && lifecycle) {
  document.querySelector('#form').remove();
  document.querySelector('#controls').hidden = true;
  window.proof = { observations, runLifecycle: () => runLifecycle({ plugins }) };
} else if (observations.bootstrap === 'ready') {
  let data = { localClasses: { input: 'local-first' }, fieldConfig: {} };
  const form = new FormView({ el: document.querySelector('#form'), formProps: { id: 'fixture-root' }, schema, schemaData: data, values: initial(), plugins, submit,
    config: { classes: { input: 'inherited' } } });
  form.render();
  install({ getValues: () => form.getValues(), setValues: values => form.setValues(values, { source: 'external' }),
    disable: value => { form.node.props.disabled = value; }, reset: () => form.resetForm(), destroy: () => form.destroy(),
    setErrors: (messages, fields) => form.setErrors(messages, fields), observe: callback => { form.on('form:change', callback); form.on('form:reset', callback); },
    classes: value => { data = { ...data, localClasses: value }; form.setSchemaData(data); },
    configuration: value => { data = { ...data, fieldConfig: value }; form.setSchemaData(data); },
    submitProps: value => { form.node.props.submitAttrs = value; }, hasNode: id => !!getNode(id), form });
}
