const params = new URLSearchParams(location.search);
const host = document.querySelector('#host');
const toggle = document.querySelector('#show');
const schema = [
  { $formkit: 'text', name: 'name', label: 'Name', id: 'name', key: 'name', delay: 150 },
  { $formkit: 'textarea', name: 'notes', label: 'Notes', id: 'notes', key: 'notes', if: '$shown', delay: 150 },
];

const submissions = [];
const events = [];
const onSubmit = values => { submissions.push(structuredClone(values)); };
for (const type of ['compositionstart', 'compositionupdate', 'compositionend', 'beforeinput', 'input', 'change', 'focusin', 'focusout']) {
  host.addEventListener(type, event => {
    events.push({
      type, target: event.target.id, trusted: event.isTrusted, text: event.data ?? null,
      value: event.target.value ?? null, composing: event.isComposing ?? null,
    });
  }, { capture: true });
}

async function mountPeer(arm) {
  if (arm === 'marionette') {
    const { mount } = await import('@mnjs/formkit');
    const stockTest = params.get('scenario') === 'stock-descriptions';
    const form = mount({
      host, schema: stockTest ? [{ ...schema[0], help: '$help' }, schema[1]] : schema,
      data: stockTest ? { shown: true, help: '' } : { shown: true }, formProps: { actions: true }, onSubmit,
    });
    return {
      show: shown => form.updateData({ shown }),
      useDefaultSections: () => form.setSectionsSchema(undefined),
      describe(help, error) {
        form.updateData({ help });
        const node = form.node.at('name');
        if (error) { node.setErrors([error]); } else { node.clearErrors(); }
      },
      destroy: () => form.destroy(),
    };
  }

  if (arm === 'vue') {
    const { createApp, h, reactive } = await import('vue');
    const { defaultConfig, FormKit, FormKitSchema, plugin } = await import('@formkit/vue');
    const data = reactive({ shown: true });
    const app = createApp({
      render: () => h(FormKit, { type: 'form', actions: true, onSubmit }, {
        default: () => h(FormKitSchema, { schema, data }),
      }),
    });
    app.use(plugin, defaultConfig);
    app.mount(host);
    return { show: shown => { data.shown = shown; }, destroy: () => app.unmount() };
  }

  if (arm === 'react') {
    const { createElement: h } = await import('react');
    const { flushSync } = await import('react-dom');
    const { createRoot } = await import('react-dom/client');
    const { defaultConfig, FormKit, FormKitSchema, FormKitProvider } = await import('@formkit/react');
    const root = createRoot(host);
    const config = defaultConfig();
    const show = shown => flushSync(() => root.render(
      h(FormKitProvider, { config }, h(FormKit, { type: 'form', actions: true, onSubmit }, h(FormKitSchema, { schema, data: { shown } }))),
    ));
    show(true);
    return { show, destroy: () => flushSync(() => root.unmount()) };
  }

  throw new Error('Choose a known FormKit peer');
}

const owner = await mountPeer(params.get('arm'));
const show = () => owner.show(toggle.checked);
toggle.addEventListener('change', show);
window.receipt = {
  submissions, events, describe: owner.describe, useDefaultSections: owner.useDefaultSections,
  destroy() {
    toggle.removeEventListener('change', show);
    owner.destroy();
  },
};
