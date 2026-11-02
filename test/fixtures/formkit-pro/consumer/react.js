import { createElement as h, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { FormKit, FormKitSchema, FormKitProvider, defaultConfig, reset } from '@formkit/react';
import { getNode } from '@formkit/core';
import { initial, schema, plugins, submit, install, observations } from './shared.js';
document.querySelector('#mode').prepend('react: ');
if (observations.bootstrap === 'ready') {
  const host = document.createElement('div'); document.querySelector('#form').replaceWith(host);
  const app = createRoot(host);
  const config = defaultConfig({ plugins, config: { classes: { input: 'inherited' } } });
  function App() {
    const [values, setValues] = useState(initial);
    const [data, setData] = useState({ localClasses: { input: 'local-first' } });
    useEffect(() => {
      const root = getNode('fixture-root');
      install({ getValues: () => JSON.parse(JSON.stringify(root.value)), setValues,
        disable: value => { root.props.disabled = value; }, reset: () => reset(root), destroy: () => app.unmount(),
        setErrors: (messages, fields) => root.setErrors(messages, fields), observe: callback => root.on('commit', callback),
        classes: value => setData({ localClasses: value }), hasNode: id => !!getNode(id) });
    }, []);
    return h(FormKitProvider, { config }, h(FormKit, { type: 'form', id: 'fixture-root', modelValue: values, onUpdateModelValue: setValues, onSubmit: submit }, h(FormKitSchema, { schema, data })));
  }
  app.render(h(App));
}
