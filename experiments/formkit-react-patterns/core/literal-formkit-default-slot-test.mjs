import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom = new JSDOM('<body><main></main>',{url: 'http://localhost'});
for (const key of ['window','document','Document','ShadowRoot','Node','Element','HTMLElement','SVGElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver','getComputedStyle'])globalThis[key] = dom.window[key];
Object.defineProperty(globalThis,'navigator',{value: dom.window.navigator,configurable: true});
const arm = process.argv[2] ?? 'adapter',host = document.querySelector('main'),created = [],destroyed = [];
const capture = node=>{created.push(node);node.on('destroyed',()=>destroyed.push(node));};
const declaration = caption=>[
  {$cmp: 'FormKit',props: {type: 'button',name: 'go'},children: [{$el: 'strong',children: caption}]},
  {$cmp: 'FormKit',props: {type: 'text',name: 'kept',value: 'Start'}},
  ...(arm === 'adapter' ? [{$cmp: 'FormKit',props: {type: 'text',name: 'named'},children: {help: {$el: 'em',children: 'Named help'}}}] : [])
];
let node,set,destroy;
const wait = ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(test) {for (let i = 0;i < 120;i++) {if (test()) return;await wait(5);}assert.ok(test(),'semantic wait');}
try {
  if (arm === 'adapter') {
    const {mount} = await import('./index.mjs');
    const api = mount({host,schema: {$cmp: 'FormKitSchema',props: {schema: '$declaration',memoKey: '$memo'}},data: {declaration: declaration('Go'),memo: 'one'},plugins: [capture],config: {delay: 0},formProps: {actions: false}});
    node = api.node;set = ()=>api.updateData({declaration: [...declaration('Continue'),{$cmp: 'FormKit',props: {type: 'text',name: 'added'}}],memo: 'two'});destroy = ()=>api.destroy();
  } else if (arm === 'vue') {
    const {createApp,h,shallowRef} = await import('vue'),{FormKit,FormKitProvider,FormKitSchema,defaultConfig} = await import('@formkit/vue');
    const state = shallowRef({schema: declaration('Go'),memoKey: 'one'}),config = defaultConfig({plugins: [capture],config: {delay: 0}});
    const app = createApp({render: ()=>h(FormKitProvider,{config},()=>h(FormKit,{type: 'form',actions: false,onNode: n=>node = n},()=>h(FormKitSchema,state.value)))});
    app.mount(host);set = ()=>{state.value = {schema: [...declaration('Continue'),{$cmp: 'FormKit',props: {type: 'text',name: 'added'}}],memoKey: 'two'};};destroy = ()=>app.unmount();
  } else {
    const {createElement: h} = await import('react'),{createRoot} = await import('react-dom/client'),{flushSync} = await import('react-dom'),{FormKit,FormKitProvider,FormKitSchema,defaultConfig} = await import('@formkit/react');
    const root = createRoot(host),config = defaultConfig({plugins: [capture],config: {delay: 0}});let state = {schema: declaration('Go'),memoKey: 'one'};
    const render = ()=>flushSync(()=>root.render(h(FormKitProvider,{config},h(FormKit,{type: 'form',actions: false,onNode: n=>node = n},h(FormKitSchema,state)))));
    render();set = ()=>{state = {schema: [...declaration('Continue'),{$cmp: 'FormKit',props: {type: 'text',name: 'added'}}],memoKey: 'two'};render();};destroy = ()=>flushSync(()=>root.unmount());
  }
  await until(()=>node?.at('kept') && host.querySelector('button strong'));
  assert.equal(host.querySelector('button strong').textContent,'Go');
  const kept = node.at('kept'),input = host.querySelector('input[name=kept]');
  input.value = 'Edited';input.dispatchEvent(new Event('input',{bubbles: true}));await until(()=>kept.value === 'Edited');
  set();await until(()=>node.at('added') && host.querySelector('button strong')?.textContent === 'Continue');
  assert.equal(node.at('kept'),kept,'ordinary literal input keeps Core owner');assert.equal(kept.value,'Edited');
  assert.equal(host.querySelector('input[name=kept]'),input,'ordinary literal input keeps DOM');assert.equal(input.value,'Edited');
  if (arm === 'adapter')assert.equal(host.querySelector('em').textContent,'Named help');
  destroy();await until(()=>created.length === destroyed.length);assert.equal(new Set(destroyed).size,created.length);assert.equal(host.childElementCount,0);
  console.log(JSON.stringify({passed: true,arm,checks: ['button array default-slot markup mounts and updates','ordinary sibling input retains Core/edited value/DOM across Schema+memo replacement','named schema slots preserved on adapter','exact owned teardown'],scope: 'Portable literal FormKit children;framework function-slot syntax is not claimed equivalent'}));
} finally {destroy?.();dom.window.close();}
