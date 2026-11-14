import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom = new JSDOM('<body><main></main>',{url: 'http://localhost'});
for (const key of ['window','document','Document','ShadowRoot','Node','Element','HTMLElement','SVGElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver','getComputedStyle'])globalThis[key] = dom.window[key];
Object.defineProperty(globalThis,'navigator',{value: dom.window.navigator,configurable: true});
const {createConfig} = await import('@formkit/core');
const arm = process.argv[2] ?? 'adapter',host = document.querySelector('main'),shared = createConfig({locale: 'fr',rootClasses: section=>({['shared-' + section]: true})}),created = [],destroyed = [];
const capture = node=>{created.push(node);node.on('destroyed',()=>destroyed.push(node));};
let node,dispose,scope;const sleep = ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(test) {for (let i = 0;i < 80;i++) {if (test()) return;await sleep(10);}assert.ok(test(),'semantic wait');}
if (arm === 'adapter') {
  const {FormKitApplication} = await import('./index.mjs');
  const app = new FormKitApplication({region: {el: host},config: {config: {rootConfig: shared},plugins: [capture]},form: {fields: [{name: 'x',label: 'Shared config'}],formProps: {actions: false}}});
  dispose = ()=>app.destroy();await app.start();node = app.getView().node;scope = app.getFormKitScope();
} else if (arm === 'vue') {
  const {createApp,h} = await import('vue'),{FormKit,FormKitProvider,defaultConfig} = await import('@formkit/vue');
  const options = defaultConfig({plugins: [capture]});options.config = {rootConfig: shared};
  const app = createApp({render: ()=>h(FormKitProvider,{config: options},()=>h(FormKit,{type: 'form',actions: false,onNode: n=>node = n},()=>h(FormKit,{name: 'x',label: 'Shared config'})))});app.mount(host);dispose = ()=>app.unmount();
} else {
  const {createElement: h} = await import('react'),{createRoot} = await import('react-dom/client'),{flushSync} = await import('react-dom'),{FormKit,FormKitProvider,defaultConfig} = await import('@formkit/react');
  const options = defaultConfig({plugins: [capture]});options.config = {rootConfig: shared};const root = createRoot(host);flushSync(()=>root.render(h(FormKitProvider,{config: options},h(FormKit,{type: 'form',actions: false,onNode: n=>node = n},h(FormKit,{name: 'x',label: 'Shared config'})))));dispose = ()=>flushSync(()=>root.unmount());
}
try {
  await until(()=>node && host.querySelector('input'));
  const initial = {rootIdentity: node.config.rootConfig === shared,wrappedRoot: node.config.rootConfig?.rootConfig === shared,locale: node.config.locale,childLocale: node.at('x').config.locale,inputClass: host.querySelector('input').className};
  const input = host.querySelector('input'),child = node.at('x');
  if (arm === 'vue') {
    assert.equal(initial.rootIdentity,false);assert.equal(initial.wrappedRoot,true);assert.equal(initial.locale,'en');assert.equal(initial.childLocale,'en');assert.ok(input.classList.contains('formkit-input'));
    shared.locale = 'de';await sleep(30);assert.equal(node.config.locale,'en');assert.equal(child.config.locale,'en');
  } else {
    if (scope)assert.equal(scope.rootConfig,shared,'Application must preserve an already supplied Core rootConfig');
    assert.equal(node.config.rootConfig,shared);assert.equal(child.config.rootConfig,shared);assert.equal(initial.locale,'fr');assert.equal(initial.childLocale,'fr');assert.ok(input.classList.contains('shared-input'));
    shared.locale = 'de';await until(()=>node.config.locale === 'de' && child.config.locale === 'de');
  }
  assert.equal(host.querySelector('input'),input);assert.equal(node.at('x'),child);
  dispose();await until(()=>destroyed.length === created.length);assert.equal(host.childElementCount,0);assert.equal(created.length,2);assert.equal(destroyed.length,created.length);assert.equal(new Set(destroyed).size,created.length);
  console.log(JSON.stringify({passed: true,arm,observedInitial: initial,referenceDifference: arm === 'vue' ? 'Vue2.5 wraps a pre-normalized rootConfig and loses its inherited locale/classes in this fixture' : 'Preserves supplied Core rootConfig as React2.5 does',checks: ['preserve supplied Core rootConfig identity','initial shared locale/classes','notified shared locale update with retained Core/DOM','each created node destroyed once'],scope: 'Installed provider normalization counterpart; no nested-provider or browser/performance claim'}));
} finally {dispose?.();dom.window.close();}
