import { afterEach, expect, it } from 'vitest';
import { getNode } from '@formkit/core';
import { FormView } from '@mnjs/formkit';
const forms = [];
afterEach(()=>{forms.splice(0).forEach(form=>form.destroy());document.body.replaceChildren();});
async function settle(form) {await form.node.settled;await form.node.ledger.settled('validating');await new Promise(resolve=>setTimeout(resolve,0));}
const outputs = [
  {$el: 'output',attrs: {id: 'selected'},if: '$get($target)',children: '$get($target).value'},
  {$el: 'output',attrs: {id: 'note'},if: '$get($target)',children: '$get($target).note'}
];
const field = (name,extra = {})=>({$formkit: 'text',name,id: name,key: name,...extra});
it('rebinds a registry ID when a keyed input is replaced in the same schema update',async()=>{
  const host = document.body.appendChild(document.createElement('form'));
  const form = new FormView({el: host,formProps: {id: 'contract-root',actions: false},config: {delay: 0},schema: [field('one',{value: 'A'}),field('two',{value: 'B'})]});
  forms.push(form);form.render();await settle(form);
  const original = getNode('two');expect(original === form.node.at('two')).toBe(true);
  form.setSchema([field('one',{value: 'A'}),field('replacement',{id: 'two',key: 'replacement',value: 'C'})]);
  await settle(form);
  const replacement = form.node.at('replacement');
  expect(Boolean(replacement)).toBe(true);expect(replacement === original).toBe(false);
  expect(form.el.querySelector('input#two').value).toBe('C');
  expect(getNode('two') === replacement).toBe(true);
  await replacement.input('C2',false);await settle(form);
  expect(form.el.querySelector('input#two').value).toBe('C2');
});
it('rebinds borrowed $get expressions and releases the old owner',async()=>{
  const host = document.body.appendChild(document.createElement('form'));
  const form = new FormView({el: host,formProps: {id: 'contract-root',actions: false},config: {delay: 0},schemaData: {target: 'one'},schema: [...outputs,field('one',{value: 'A'}),field('two',{value: 'B'})]});
  forms.push(form);form.render();await settle(form);
  expect(form.el.querySelector('#selected').textContent).toBe('A');
  await getNode('one').input('A2',false);await settle(form);
  form.setSchemaData({target: 'two'});await settle(form);
  expect(form.el.querySelector('#selected').textContent).toBe('B');
  const old = getNode('two');
  form.setSchema([...outputs,field('one',{value: 'A'}),field('replacement',{id: 'two',key: 'replacement',value: 'C'})]);
  await settle(form);
  const replacement = form.node.at('replacement');
  expect(replacement === old).toBe(false);
  expect(getNode('two') === replacement).toBe(true);
  expect(form.el.querySelector('#selected').textContent).toBe('C');
  await replacement.input('C2',false);await settle(form);
  expect(form.el.querySelector('#selected').textContent).toBe('C2');
  replacement.context.note = 'Current';await settle(form);
  expect(form.el.querySelector('#note').textContent).toBe('Current');
});
it('registers an ID after a remove-then-insert update and clears it on destroy',async()=>{
  const form = new FormView({schema: [field('two',{value: 'B'})],formProps: {actions: false}});forms.push(form);document.body.appendChild(form.el);form.render();await settle(form);
  const old = getNode('two');expect(Boolean(old)).toBe(true);
  form.setSchema([]);await settle(form);expect(getNode('two')).toBeUndefined();
  form.setSchema([field('replacement',{id: 'two',key: 'replacement',value: 'C'})]);await settle(form);
  expect(getNode('two') === form.node.at('replacement')).toBe(true);
  form.destroy();expect(getNode('two')).toBeUndefined();
});
for (const direction of ['nested to direct', 'direct to nested']) {
  it(`preserves registry ownership across ${direction} keyed replacement`, async()=>{
    const nested = {$el: 'div',key: 'wrapper',children: [field('old',{id: 'shared',value: 'Before'})]};
    const direct = field('current',{id: 'shared',value: 'After'});
    const form = new FormView({schema: direction === 'nested to direct' ? [nested] : [direct],formProps: {actions: false}});
    forms.push(form);document.body.appendChild(form.el);form.render();await settle(form);
    const old = getNode('shared');expect(Boolean(old)).toBe(true);
    form.setSchema(direction === 'nested to direct' ? [field('current',{id: 'shared',value: 'After'})] : [
      {$el: 'div',key: 'wrapper',children: [field('current',{id: 'shared',value: 'After'})]}
    ]);
    await settle(form);
    const current = form.node.at('current');
    expect(current === old).toBe(false);
    expect(form.el.querySelector('input#shared').value).toBe('After');
    expect(getNode('shared') === current).toBe(true);
    await current.input('Edited',false);await settle(form);
    expect(form.el.querySelector('input#shared').value).toBe('Edited');
    form.destroy();expect(getNode('shared')).toBeUndefined();
  });
}
it('releases a nested owner when its wrapper remains but a preceding sibling claims its ID', async()=>{
  const wrapper = children=>({$el: 'div',key: 'wrapper',children});
  const form = new FormView({schema: [wrapper([field('old',{id: 'shared',value: 'Before'})])],formProps: {actions: false}});
  forms.push(form);document.body.appendChild(form.el);form.render();await settle(form);
  const old = getNode('shared');
  form.setSchema([field('current',{id: 'shared',value: 'After'}),wrapper([])]);
  await settle(form);
  const current = form.node.at('current');
  expect(current === old).toBe(false);
  expect(getNode('shared') === current).toBe(true);
  expect(form.el.querySelector('input#shared').value).toBe('After');
});
it('releases an obsolete nested owner across two retained wrappers in render order', async()=>{
  const wrapper = (key,children)=>({$el: 'div',key,children});
  const old = field('old',{id: 'shared',value: 'Before'});
  const current = field('current',{id: 'shared',value: 'After'});
  const form = new FormView({schema: [wrapper('B',[]),wrapper('A',[old])],formProps: {actions: false}});
  forms.push(form);document.body.appendChild(form.el);form.render();await settle(form);
  const oldOwner = getNode('shared');
  form.setSchema([wrapper('B',[current]),wrapper('A',[])]);
  await settle(form);
  expect(form.node.at('current') === oldOwner).toBe(false);
  expect(getNode('shared') === form.node.at('current')).toBe(true);
  expect(form.el.querySelector('input#shared').value).toBe('After');
});
it('preserves a retained field while transferring its old ID to a preceding new field', async()=>{
  const form = new FormView({schema: [field('A',{id: 'shared',value: 'Before'})],formProps: {actions: false}});
  forms.push(form);document.body.appendChild(form.el);form.render();await settle(form);
  const retained = form.node.at('A');
  await retained.input('Edited',false);await settle(form);
  const retainedInput = form.el.querySelector('input#shared');
  form.setSchema([field('B',{id: 'shared',value: 'New'}),field('A',{id: 'renamed',value: 'Edited'})]);
  await settle(form);
  expect(form.node.at('A') === retained).toBe(true);
  expect(form.el.querySelector('input#renamed') === retainedInput).toBe(true);
  expect(retained.value).toBe('Edited');
  expect(getNode('renamed') === retained).toBe(true);
  expect(getNode('shared') === form.node.at('B')).toBe(true);
});
it('never inspects an application component node getter while transferring an owned ID', async()=>{
  const custom = () => ({
    element: document.createElement('span'),
    get node() {throw new Error('application node getter must not be read');},
    update() {},destroy() {}
  });
  const component = {$cmp: 'Custom',key: 'custom'};
  const form = new FormView({
    schema: [component,field('old',{id: 'shared',value: 'Before'})],
    components: {Custom: custom},formProps: {actions: false}
  });
  forms.push(form);document.body.appendChild(form.el);form.render();await settle(form);
  form.setSchema([component,field('current',{id: 'shared',value: 'After'})]);await settle(form);
  expect(getNode('shared') === form.node.at('current')).toBe(true);
});
