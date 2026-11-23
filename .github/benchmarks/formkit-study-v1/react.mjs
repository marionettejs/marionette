import { createElement as h } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { defaultConfig, FormKit, FormKitProvider } from '@formkit/react';
function render({ children, ...field }) {
  return h(FormKit, field, children?.map(render));
}
export function attach(host, form, fields) {
  const root = createRoot(host);
  flushSync(() => root.render(h(FormKitProvider, { config: defaultConfig() }, render({ ...form, children: fields }))));
  return () => root.unmount();
}
