const items = ['Alpha', 'Beta', 'Gamma'];
const schema = [
  {
    $formkit: 'list', name: 'rows', id: 'dynamic-rows', value: items,
    dynamic: true, sync: true,
    children: [
      { $formkit: 'text', for: ['item','index','$items'], key: '$item', index: '$index', label: 'Row value' },
    ],
  },
  { $formkit: 'submit', label: 'Save rows' },
];

export async function openDynamicList({ host, arm }) {
  const { getNode } = await import('@formkit/core');
  const submissions = [];
  const onSubmit = value => submissions.push(structuredClone(value));
  let destroy;
  if (arm === 'marionette') {
    const { mount } = await import('@mnjs/formkit');
    const form = mount({ host, schema: structuredClone(schema), formProps: { actions: false }, onSubmit });
    destroy = () => form.destroy();
  } else if (arm === 'vue') {
    const { createApp, h } = await import('vue');
    const { FormKit, FormKitSchema, defaultConfig, plugin } = await import('@formkit/vue');
    const app = createApp({
      render: () => h(FormKit, { type: 'form', actions: false, onSubmit }, {
        default: () => h(FormKitSchema, { schema: structuredClone(schema) }),
      }),
    });
    app.use(plugin, defaultConfig);
    app.mount(host);
    destroy = () => app.unmount();
  } else if (arm === 'react') {
    const { createElement: h } = await import('react');
    const { flushSync } = await import('react-dom');
    const { createRoot } = await import('react-dom/client');
    const { FormKit, FormKitProvider, FormKitSchema, defaultConfig } = await import('@formkit/react');
    const root = createRoot(host);
    const config = defaultConfig();
    flushSync(() => root.render(
      h(FormKitProvider, { config }, h(FormKit, { type: 'form', actions: false, onSubmit },
        h(FormKitSchema, { schema: structuredClone(schema) }))),
    ));
    destroy = () => flushSync(() => root.unmount());
  } else {
    throw new Error('Choose a known FormKit peer');
  }
  const current = () => {
    const list = getNode('dynamic-rows');
    if (!list) { throw new Error('Expected mounted dynamic list'); }
    return list;
  };
  return {
    submissions, destroy,
    async move(from, to) {
      const list = current();
      list.children[from].index = to;
      await list.settled;
    },
    async remove(index) {
      const list = current();
      await list.input(list.value.filter((_, i) => i !== index));
    },
  };
}
