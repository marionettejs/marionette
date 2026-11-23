import { mount } from '#pack';
export function attach(host, { id, actions }, fields) {
  const form = mount({ host, fields, formProps: { id, actions } });
  return () => form.destroy();
}
