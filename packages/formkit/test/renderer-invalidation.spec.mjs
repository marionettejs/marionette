import { afterEach, expect, it } from 'vitest';
import { mount } from '@mnjs/formkit';
const forms = [];
async function editor() {
  const host = document.createElement('main'); document.body.append(host);
  const api = mount({ host, fields: [{ name: 'answer', label: 'Label' }], formProps: { actions: false } });
  forms.push(api); await api.node.settled; await new Promise(resolve => setTimeout(resolve, 0));
  return { api, host, core: api.node.at('answer') };
}
const flush = async api => { await api.node.settled; await new Promise(resolve => setTimeout(resolve, 0)); };
afterEach(() => { forms.splice(0).reverse().forEach(form => form.destroy()); document.body.replaceChildren(); });
it('reconciles earlier text when a later public ref changes the same Core context during draw', async() => {
  const { api, host, core } = await editor(); let armed = true;
  api.setFields([{ name: 'answer', label: 'Label', attrs: { tag: 'Before ref' }, sectionsSchema: { label: { children: [
    { $el: 'strong', children: '$attrs.tag' },
    { $el: 'span', attrs: { ref: element => { if (element && armed) { armed = false; core.props.attrs = { tag: 'After ref' }; } } } }
  ] } } }]);
  await flush(api); expect(armed).toBe(false); expect(host.querySelector('strong').textContent).toBe('After ref'); expect(api.node.at('answer')).toBe(core);
});
it('reconciles earlier text when a later caller-owned schema function changes context', async() => {
  const { api, host, core } = await editor(); let armed = true;
  const mutate = () => { if (armed) { armed = false; core.props.attrs = { tag: 'After function', mutate }; } return 'Tail'; };
  api.setFields([{ name: 'answer', label: 'Label', attrs: { tag: 'Before function', mutate }, sectionsSchema: { label: { children: [
    { $el: 'strong', children: '$attrs.tag' }, { $el: 'span', children: '$attrs.mutate()' }
  ] } } }]);
  await flush(api); expect(armed).toBe(false); expect(host.querySelector('strong').textContent).toBe('After function'); expect(core.props.attrs.tag).toBe('After function');
});
