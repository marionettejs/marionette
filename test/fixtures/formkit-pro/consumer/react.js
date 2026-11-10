import { createElement as h, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { FormKit, FormKitSchema, FormKitProvider, defaultConfig, reset } from '@formkit/react';
import { getNode } from '@formkit/core';
import { initial, schema, plugins, submit, install, observations, inlineRelease } from './shared.js';
document.querySelector('#mode').prepend('react: ');
if (observations.bootstrap === 'ready') {
  const host = document.createElement('div'); document.querySelector('#form').replaceWith(host);
  const app = createRoot(host);
  const config = defaultConfig({ plugins, config: { classes: { input: 'inherited' } } });
  function App() {
    const [values, setValues] = useState(initial);
    const [data, setData] = useState({ localClasses: { input: 'local-first' }, fieldConfig: {} });
    useEffect(() => {
      const root = getNode('fixture-root');
      install({ getValues: () => JSON.parse(JSON.stringify(root.value)), setValues,
        disable: value => { root.props.disabled = value; }, reset: () => reset(root), destroy: () => app.unmount(),
        setErrors: (messages, fields) => root.setErrors(messages, fields), observe: callback => root.on('commit', callback),
        classes: value => setData(previous => ({ ...previous, localClasses: value })),
        configuration: value => setData(previous => ({ ...previous, fieldConfig: value })),
        submitProps: value => { root.props.submitAttrs = value; }, hasNode: id => !!getNode(id) });
    }, []);
    const children = inlineRelease ? [
      h(FormKitSchema, { key: 'outer', schema: schema.filter(field => field.name !== 'release'), data }),
      h(FormKit, { key: 'release', type: 'group', name: 'release' },
        h(FormKitSchema, { schema: inlineRelease.referenceChildren, data }),
        h(FormKit, { ...inlineRelease.referenceCustomProps, slots: { panelWrapper: context =>
          h('div', { 'data-release-panel-slot': 'custom' }, `${context.label}:${context.value}`) } }))
    ] : h(FormKitSchema, { schema, data });
    return h(FormKitProvider, { config }, h(FormKit, { type: 'form', id: 'fixture-root', modelValue: values, onUpdateModelValue: setValues, onSubmit: submit }, children));
  }
  app.render(h(App));
}
