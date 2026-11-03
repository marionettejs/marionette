import { createApp, h, ref } from 'vue';
import { FormKit, FormKitSchema, plugin, defaultConfig, reset } from '@formkit/vue';
import { getNode } from '@formkit/core';
import { initial, schema, plugins, submit, install, observations } from './shared.js';
document.querySelector('#mode').prepend('vue: ');
if (observations.bootstrap === 'ready') {
  const values = ref(initial()); const data = ref({ localClasses: { input: 'local-first' }, fieldConfig: {} });
  const host = document.createElement('div'); document.querySelector('#form').replaceWith(host);
  const app = createApp({ render: () => h(FormKit, { type: 'form', id: 'fixture-root', modelValue: values.value,
    'onUpdate:modelValue': value => { values.value = value; }, onSubmit: submit },
  { default: () => h(FormKitSchema, { schema, data: data.value }) }) });
  app.use(plugin, defaultConfig({ plugins, config: { classes: { input: 'inherited' } } }));
  app.mount(host);
  const root = getNode('fixture-root');
  install({ getValues: () => JSON.parse(JSON.stringify(root.value)), setValues: value => { values.value = value; },
    disable: value => { root.props.disabled = value; }, reset: () => reset(root), destroy: () => app.unmount(),
    setErrors: (messages, fields) => root.setErrors(messages, fields), observe: callback => root.on('commit', callback),
    classes: value => { data.value = { ...data.value, localClasses: value }; },
    configuration: value => { data.value = { ...data.value, fieldConfig: value }; },
    submitProps: value => { root.props.submitAttrs = value; }, hasNode: id => !!getNode(id) });
}
