import { createApp, h } from 'vue';
import { FormKit, defaultConfig, plugin } from '@formkit/vue';
function render({ children, ...field }) {
  return h(FormKit, field, children ? { default: () => children.map(render) } : undefined);
}
export function attach(host, root, fields) {
  const app = createApp({ render: () => render({ ...root, children: fields }) });
  app.use(plugin, defaultConfig());
  app.mount(host);
  return () => app.unmount();
}
