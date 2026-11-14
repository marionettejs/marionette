import {JSDOM} from 'jsdom';
import assert from 'node:assert/strict';
const dom = new JSDOM('<body><main></main>',{url: 'http://localhost'});
for (const key of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLFormElement','HTMLTextAreaElement','HTMLSelectElement','Event','CustomEvent','MutationObserver','SVGElement'])globalThis[key] = dom.window[key];
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
Object.defineProperty(globalThis,'navigator',{value: dom.window.navigator});
const arm = process.argv[2] ?? 'experiment',host = document.querySelector('main');
const initial = {profile: {name: 'Ada',tags: ['a','b']}};
const schema = [{$formkit: 'group',name: 'profile',children: [
  {$el: 'fieldset',children: [{$el: 'legend',children: '$title'},{$formkit: 'text',name: 'name',validation: 'required'},
    {$formkit: 'list',name: 'tags',children: [{$el: 'ol',children: [{$el: 'li',for: ['item','i','$rows'],attrs: {key: '$item.id','data-row': '$item.id'},children: [{$el: 'strong',children: '$item.title'},{$formkit: 'text',key: '$item.id',validation: 'required'}]}]}]},
    {if: '$extra',then: {$el: 'aside',children: [{$formkit: 'text',name: 'extra'}]}}
  ]}
]}];
let data = {title: 'Profile',rows: [{id: 'a',title: 'Alpha'},{id: 'b',title: 'Beta'}],extra: false};
let api,node,update,destroy;
if (arm === 'vue') {
  const {createApp,h,shallowRef,nextTick} = await import('vue');
  const {FormKit,FormKitSchema,plugin,defaultConfig} = await import('@formkit/vue');
  const state = shallowRef(data);const app = createApp({render: ()=>h(FormKit,{type: 'form',actions: false,value: initial,onNode: n=>node = n},{default: ()=>h(FormKitSchema,{schema,data: state.value})})});
  app.use(plugin,defaultConfig({config: {delay: 0}}));app.mount(host);await nextTick();update = async next=>{state.value = next;await nextTick();};destroy = ()=>app.unmount();
} else if (arm === 'react') {
  const React = await import('react');const {createRoot} = await import('react-dom/client');const {flushSync} = await import('react-dom');
  const {FormKit,FormKitSchema,FormKitProvider,defaultConfig} = await import('@formkit/react');const root = createRoot(host);let setData;
  function App() {const [state,set] = React.useState(data);setData = set;return React.createElement(FormKitProvider,{config: defaultConfig({config: {delay: 0}})},React.createElement(FormKit,{type: 'form',actions: false,value: initial,onNode: n=>node = n},React.createElement(FormKitSchema,{schema,data: state})));}
  flushSync(()=>root.render(React.createElement(App)));update = async next=>flushSync(()=>setData(next));destroy = ()=>flushSync(()=>root.unmount());
} else {
  const {mount} = await import('./index.mjs');api = mount({host,schema,data,values: initial,formProps: {actions: false},config: {delay: 0}});node = api.node;update = async next=>api.updateData(next);destroy = ()=>api.destroy();
}
const until = async test=>{for (let i = 0;i < 100;i++) {if (test()) return;await new Promise(r=>setTimeout(r,5));}assert.ok(test(),'bounded semantic wait');};
await until(()=>host.querySelector('li input') && node?.at('profile.tags')?.children.length === 2);
const profile = node.at('profile'),name = node.at('profile.name'),list = node.at('profile.tags');
assert.equal(host.querySelector('legend').textContent,'Profile');assert.deepEqual(node.children,[profile]);assert.deepEqual(profile.children.map(n=>n.name),['name','tags']);
assert.deepEqual(node.value,initial);assert.equal(list.children.length,2);assert.ok(list.children.every(n=>n.parent === list));
assert.ok(host.querySelector('fieldset > [data-experiment-field] input') || host.querySelector('fieldset input'));
const a = host.querySelector('[data-row="a"] input'),aNode = list.children[0],aName = aNode.name;
await aNode.input('edited');await name.input('');await until(()=>name.context.state.valid === false);assert.equal(profile.context.state.valid,false);assert.equal(node.context.state.valid,false);
data = {...data,title: 'Updated',extra: true};await update(data);await until(()=>host.querySelector('aside input') && node.at('profile.extra'));
assert.equal(node.at('profile.name'),name);assert.equal(list.children[0],aNode);assert.equal(host.querySelector('[data-row="a"] input'),a);assert.equal(a.value,'edited');assert.equal(aNode.name,aName);assert.equal(host.querySelector('legend').textContent,'Updated');
data = {...data,rows: [data.rows[1],data.rows[0]]};await update(data);await until(()=>host.querySelector('li')?.dataset.row === 'b');
assert.equal(host.querySelector('[data-row="a"] input'),a);assert.equal(aNode.parent,list);assert.equal(list.children.length,2);
data = {...data,extra: false,rows: [data.rows[1]]};await update(data);await until(()=>!node.at('profile.extra') && list.children.length === 1);
assert.equal(host.querySelector('aside'),null);assert.equal(host.querySelector('[data-row="b"]'),null);assert.equal(list.children[0],aNode);assert.equal(list.children[0].value,'edited');assert.deepEqual(Object.keys(node.value),['profile']);assert.deepEqual(Object.keys(node.value.profile),['name','tags']);
destroy();assert.equal(host.querySelector('input'),null);
console.log(JSON.stringify({arm,passed: true,checks: ['mixed native group/list DOM and text','no phantom Core nodes','native value topology','aggregate validation','data update','anonymous keyed node/DOM identity','keyed DOM reorder','conditional and row removal','cleanup']}));
