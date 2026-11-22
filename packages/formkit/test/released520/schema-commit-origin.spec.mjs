import { afterEach, expect, it } from 'vitest';
import { mount } from '@mnjs/formkit';
const owners = [];
afterEach(() => { for (const api of owners.splice(0).reverse()) { api.destroy(); } document.body.replaceChildren(); });
function schema(names) {
  return [{ $formkit: 'group', name: 'box', children: [{ $cmp: 'Card', key: 'card', children: names.map(name => ({ $formkit: 'text', name, key: name })) }] }];
}
function create() {
  const host = document.createElement('main'); document.body.append(host);
  const api = mount({ host, values: { box: { old: 'Old' } }, schema: schema(['old']), formProps: { actions: false }, components: {
    Card({ host: target, renderChildren }) {
      const element = document.createElement('section'); target.append(element);
      const dispose = renderChildren(element);
      return { destroy(remove = true) { dispose(remove); if (remove) { element.remove(); } } };
    },
  } }); owners.push(api); return api;
}
it('labels newly constructed opaque schema children programmatic while retaining ordinary edit facts', async() => {
  const api = create(), facts = []; api.observeFieldCommits(fact => facts.push(fact));
  api.setSchema(schema(['old', 'added'])); await api.whenPendingEditsSettled();
  expect(facts.filter(fact => fact.path.at(-1) === 'added').length).toBeGreaterThan(0);
  expect(facts.filter(fact => fact.path.at(-1) === 'added').every(fact => fact.source === 'programmatic')).toBe(true);
  expect(facts.filter(fact => fact.source === 'unknown')).toEqual([]);
  const input = api.node.at('box.added'); input.input('Edited', false); await api.whenPendingEditsSettled();
  expect(facts.filter(fact => fact.source === 'unknown').map(fact => fact.value)).toEqual(['Edited']);
});
