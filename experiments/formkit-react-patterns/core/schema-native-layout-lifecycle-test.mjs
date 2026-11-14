import {JSDOM} from 'jsdom';import assert from 'node:assert/strict';
const dom = new JSDOM('<body><main></main>');for (const key of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver'])globalThis[key] = dom.window[key];globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
const {mount} = await import('./index.mjs');const {createLayoutController} = await import('./schema-layout.mjs');
const host = document.querySelector('main'),tick = async()=>{for (let i = 0;i < 6;i++) await new Promise(resolve=>setTimeout(resolve,0));};
let made = 0,destroyed = 0;const components = {Panel: ({props,host,renderChildren})=>{made++;const el = document.createElement('article');el.dataset.title = props.title;host.append(el);renderChildren(el);return {update(next) {el.dataset.title = next.title;},destroy() {destroyed++;}};}};
const schema = {$formkit: 'group',for: ['team','ti','$teams'],name: '$team.id',key: '$team.id',children: [{$cmp: 'Panel',props: {title: '$team.title'},children: [
  {$el: 'h2',children: '$team.title'},{$formkit: 'text',name: 'same',label: '$team.title'},
  {$formkit: 'group',children: [{$el: 'section',children: [{$formkit: 'text',name: 'nested',label: '$team.title'}]}]},
  {$el: 'p',children: '$values.a.same'},
  {if: '$values.a.same === "show"',then: {$el: 'aside',children: [{$formkit: 'text',name: 'extra'}]}}
]}]};
let data = {teams: [{id: 'a',title: 'A'},{id: 'b',title: 'B'}]};
const api = mount({instrument: true,host,schema,data,components,config: {delay: 0},formProps: {actions: false}});await tick();
const a = api.node.at('a'),b = api.node.at('b'),same = api.node.at('a.same'),anonymous = a.children.find(n=>n.type === 'group'),input = host.querySelector('[data-title="A"] input');
assert.deepEqual(api.node.children.map(n=>n.name),['a','b']);assert.equal(a.children.length,2);assert.equal(anonymous.children[0].name,'nested');assert.equal(anonymous.parent,a);assert.equal(made,2);
await same.input('show');await tick();assert.equal(a.children.length,3);assert.equal(b.children.length,3);assert.ok(host.querySelector('[data-title="B"] aside input'));assert.equal(host.querySelector('p').textContent,'show');
data = {teams: [{id: 'b',title: 'B2'},{id: 'a',title: 'A2'}]};api.updateData(data);await tick();
assert.deepEqual([...host.querySelectorAll('article h2')].map(n=>n.textContent),['B2','A2']);assert.equal(api.node.at('a'),a);assert.equal(api.node.at('a.same'),same);assert.equal(host.querySelector('[data-title="A2"] input'),input);assert.equal(a.children.find(n=>n.type === 'group'),anonymous);assert.equal(made,2);assert.equal(destroyed,0);
// A native group schema event redraws its official sections and child anchor.
a.emit('schema');await tick();assert.equal(host.querySelector('[data-title="A2"] input'),input);assert.equal(made,2);assert.equal(destroyed,0);
api.setSlots({default: {$el: 'nav',children: ['$slots.fields']}});await tick();assert.equal(host.querySelector('nav [data-title="A2"] input'),input);assert.equal(made,2);
// Replacing presentation with the same explicit key retains named Core fields.
api.setSchema({$formkit: 'group',name: 'a',key: 'a',children: [{$el: 'footer',children: [{$formkit: 'text',name: 'same'}]}]});await tick();
assert.equal(api.node.at('a'),a);assert.equal(api.node.at('a.same'),same);assert.equal(host.querySelector('footer input'),input);assert.equal(api.node.at('b'),undefined);assert.equal(destroyed,2);assert.equal(a.children.length,1);
api.destroy();assert.equal(host.querySelector('input'),null);assert.equal(destroyed,made);assert.equal(api.metrics.coreNodesCreated,api.metrics.coreNodesDestroyed);
// Destroying just the layout restores the native child outlet, retaining owners.
const plain = mount({instrument: true,host,fields: [],formProps: {actions: false}});const layout = createLayoutController({form: plain.form,schema: {$formkit: 'group',name: 'g',children: [{$cmp: 'Panel',children: [{$formkit: 'text',name: 'x'}]}]},components});const x = plain.node.at('g.x'),control = host.querySelector('input');layout.destroy();assert.equal(plain.node.at('g.x'),x);assert.equal(host.querySelector('input'),control);assert.equal(host.querySelector('article'),null);plain.destroy();assert.equal(destroyed,made);assert.equal(plain.metrics.coreNodesCreated,plain.metrics.coreNodesDestroyed);
console.log(JSON.stringify({passed: true,checks: ['factory children/props/update/disposal','independent repeated sibling names','inherited outer-loop scope','anonymous native group ownership','Core-driven conditional projection','native section redraw','root slot redraw','schema replacement retention','layout-only teardown restores children','all-created-node teardown']}));
